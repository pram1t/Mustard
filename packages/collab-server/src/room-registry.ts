/**
 * RoomRegistry — in-memory map of roomId → live collaboration context.
 *
 * Each room owns its own:
 *   - Room record (from collab-core)
 *   - Participants list
 *   - IntentEngine, ZoneManager, AgentRegistry (from collab-ai)
 *   - ModeManager, ApprovalManager, RiskAssessor, SensitiveFileDetector,
 *     PermissionGateway (from collab-permissions)
 *   - EphemeralMemory (from collab-memory)
 *   - Bus adapters wired to a shared EventBus
 *
 * V1 ships in-memory only. Persistence (rooms, sessions, project memory,
 * checkpoints) is the responsibility of higher layers — wire SQLite-backed
 * SessionMemory / ProjectMemory / TeamMemory in via `extra` if you want them.
 *
 * Disposing the registry tears down every room (cancels timers,
 * unsubscribes bus listeners) — important for clean shutdown.
 */

import {
  IntentEngine,
  ZoneManager,
  RateLimiter,
  AgentRegistry,
  attachIntentEngineToBus,
  type AutoApprovalPolicy,
} from '@openagent/collab-ai';
import {
  ModeManager,
  ApprovalManager,
  RiskAssessor,
  SensitiveFileDetector,
  PermissionGateway,
  attachModeManagerToBus,
} from '@openagent/collab-permissions';
import { EphemeralMemory } from '@openagent/collab-memory';
import type { IMessageBus } from '@openagent/message-bus';
import type {
  CreateRoomRequest,
  Participant,
  PermissionMode,
  ParticipantType,
  Room,
} from '@openagent/collab-core';
import { createRoom } from '@openagent/collab-core';
import { randomUUID } from 'node:crypto';

// ============================================================================
// Per-room context
// ============================================================================

export interface RoomContext {
  room: Room;
  participants: Map<string, Participant>;

  intentEngine: IntentEngine;
  zoneManager: ZoneManager;
  rateLimiter: RateLimiter;
  agentRegistry: AgentRegistry;

  modeManager: ModeManager;
  approvalManager: ApprovalManager;
  riskAssessor: RiskAssessor;
  sensitiveFiles: SensitiveFileDetector;
  permissionGateway: PermissionGateway;

  ephemeral: EphemeralMemory;

  /** Disposers to run on room teardown (bus adapters, gateway). */
  disposers: Array<() => void>;
}

// ============================================================================
// Config
// ============================================================================

export interface RoomRegistryOptions {
  bus: IMessageBus;
  /** Optional auto-approval policy applied at room creation. Default: disabled. */
  autoApproval?: AutoApprovalPolicy;
}

export interface CreateRoomInput extends CreateRoomRequest {
  ownerId: string;
}

// ============================================================================
// RoomRegistry
// ============================================================================

export class RoomRegistry {
  private readonly rooms = new Map<string, RoomContext>();
  private readonly bus: IMessageBus;
  private readonly autoApproval?: AutoApprovalPolicy;

  constructor(options: RoomRegistryOptions) {
    this.bus = options.bus;
    this.autoApproval = options.autoApproval;
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Create a new room and wire its full collab stack. Returns the
   * RoomContext (caller can reach into the engines for advanced flows).
   */
  create(input: CreateRoomInput): RoomContext {
    const room = createRoom(input, input.ownerId);
    return this.registerRoom(room);
  }

  /**
   * Adopt an externally-constructed Room (e.g. loaded from a database).
   */
  adopt(room: Room): RoomContext {
    if (this.rooms.has(room.id)) {
      throw new Error(`Room already registered: ${room.id}`);
    }
    return this.registerRoom(room);
  }

  /** Tear down a room: cancel timers, dispose bus adapters, drop state. */
  destroy(roomId: string): boolean {
    const ctx = this.rooms.get(roomId);
    if (!ctx) return false;
    for (const d of ctx.disposers) {
      try {
        d();
      } catch {
        /* swallow */
      }
    }
    ctx.permissionGateway.detach();
    ctx.approvalManager.destroy();
    this.rooms.delete(roomId);
    return true;
  }

  /** Tear down every room. */
  destroyAll(): void {
    for (const id of Array.from(this.rooms.keys())) {
      this.destroy(id);
    }
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  get(roomId: string): RoomContext | undefined {
    return this.rooms.get(roomId);
  }

  has(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  list(): RoomContext[] {
    return Array.from(this.rooms.values());
  }

  size(): number {
    return this.rooms.size;
  }

  // --------------------------------------------------------------------------
  // Participants
  // --------------------------------------------------------------------------

  addParticipant(
    roomId: string,
    input: {
      participantId?: string;
      userId: string;
      name: string;
      type: ParticipantType;
      role?: 'owner' | 'admin' | 'member' | 'viewer';
    },
  ): Participant {
    const ctx = this.requireRoom(roomId);
    const id = input.participantId ?? randomUUID();
    const now = new Date();
    const participant: Participant = {
      id,
      roomId,
      userId: input.userId,
      name: input.name,
      type: input.type,
      role: input.role ?? 'member',
      status: 'online',
      joinedAt: now,
      lastSeenAt: now,
    };
    ctx.participants.set(id, participant);
    this.bus.publish('collab.room.participant_joined', participant, {
      source: roomId,
    });
    return participant;
  }

  removeParticipant(roomId: string, participantId: string): boolean {
    const ctx = this.requireRoom(roomId);
    const p = ctx.participants.get(participantId);
    if (!p) return false;
    ctx.participants.delete(participantId);
    this.bus.publish('collab.room.participant_left', p, { source: roomId });
    return true;
  }

  listParticipants(roomId: string): Participant[] {
    return Array.from(this.requireRoom(roomId).participants.values());
  }

  // --------------------------------------------------------------------------
  // Mode (proxy)
  // --------------------------------------------------------------------------

  setMode(roomId: string, mode: PermissionMode, changedBy: string): void {
    this.requireRoom(roomId).modeManager.setMode(mode, changedBy);
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  private requireRoom(roomId: string): RoomContext {
    const ctx = this.rooms.get(roomId);
    if (!ctx) throw new Error(`Room not found: ${roomId}`);
    return ctx;
  }

  private registerRoom(room: Room): RoomContext {
    const intentEngine = new IntentEngine(
      this.autoApproval ? { autoApproval: this.autoApproval } : {},
    );
    const zoneManager = new ZoneManager();
    const rateLimiter = new RateLimiter();
    const agentRegistry = new AgentRegistry();

    const modeManager = new ModeManager({
      roomId: room.id,
      initialMode: room.config.defaultMode,
      initialSetBy: room.ownerId,
    });
    const approvalManager = new ApprovalManager();
    const sensitiveFiles = new SensitiveFileDetector();
    const riskAssessor = new RiskAssessor({ sensitiveFiles });
    const permissionGateway = new PermissionGateway({
      engine: intentEngine,
      modeManager,
      approvalManager,
      riskAssessor,
      sensitiveFiles,
    });

    const ephemeral = new EphemeralMemory();

    const disposers: Array<() => void> = [];
    disposers.push(
      attachIntentEngineToBus(intentEngine, this.bus, { source: room.id }),
    );
    disposers.push(attachModeManagerToBus(modeManager, this.bus));
    disposers.push(permissionGateway.attach());

    const ctx: RoomContext = {
      room,
      participants: new Map(),
      intentEngine,
      zoneManager,
      rateLimiter,
      agentRegistry,
      modeManager,
      approvalManager,
      riskAssessor,
      sensitiveFiles,
      permissionGateway,
      ephemeral,
      disposers,
    };
    this.rooms.set(room.id, ctx);

    this.bus.publish('collab.room.created', { room }, { source: room.id });
    return ctx;
  }
}

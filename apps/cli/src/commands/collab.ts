/**
 * `openagent collab` — interact with @mustard/collab-server.
 *
 * Subcommands:
 *   collab login                            cache a JWT for future calls
 *   collab logout                           clear cached token
 *   collab room create <name> [--path P] [--mode M]
 *   collab room list
 *   collab room get <id>
 *   collab room delete <id>
 *   collab room join <id>
 *   collab room leave <id> <participantId>
 *   collab mode get <id>
 *   collab mode set <id> <mode>
 *   collab tail [roomId]                    stream live events to stdout
 *
 * Common options:
 *   --base   collab server URL (default OPENAGENT_COLLAB_URL or http://127.0.0.1:3200)
 *   --as     participant id (default OPENAGENT_PARTICIPANT or current user)
 *   --json   output JSON instead of pretty text
 */

import {
  CollabClient,
  CollabApiError,
  PermissionMode,
  type Intent,
  type Participant,
  type Room,
  clearCachedToken,
  getAuthenticatedClient,
  getCachedToken,
  TOKEN_FILE_PATH,
} from '../lib/collab-client.js';
import os from 'node:os';

// ============================================================================
// Public types
// ============================================================================

export interface CollabCommandOptions {
  /** Already-resolved subcommand path, e.g. ['room', 'create'] */
  subcommand: string[];
  /** Positional arguments after the subcommand */
  args: string[];
  /** Parsed flags */
  flags: Record<string, string | boolean | undefined>;
  /** stdout writer (override-able for tests) */
  out?: (line: string) => void;
  /** stderr writer */
  err?: (line: string) => void;
}

// ============================================================================
// Entrypoint
// ============================================================================

const VALID_MODES: ReadonlySet<PermissionMode> = new Set([
  'plan',
  'code',
  'ask',
  'auto',
]);

export async function collabCommand(opts: CollabCommandOptions): Promise<number> {
  const out = opts.out ?? ((s: string) => process.stdout.write(s + '\n'));
  const err = opts.err ?? ((s: string) => process.stderr.write(s + '\n'));

  const baseUrl =
    coerceString(opts.flags.base) ??
    process.env.OPENAGENT_COLLAB_URL ??
    'http://127.0.0.1:3200';
  const participantId =
    coerceString(opts.flags.as) ??
    process.env.OPENAGENT_PARTICIPANT ??
    os.userInfo().username;
  const json = opts.flags.json === true || opts.flags.json === 'true';

  const ctx: Ctx = { baseUrl, participantId, out, err, json };

  try {
    const [head, ...rest] = opts.subcommand;
    switch (head) {
      case undefined:
      case 'help':
        out(USAGE);
        return 0;
      case 'login':
        return await loginCmd(ctx);
      case 'logout':
        return await logoutCmd(ctx);
      case 'room':
        return await roomCmd(rest, opts.args, ctx);
      case 'mode':
        return await modeCmd(rest, opts.args, ctx);
      case 'tail':
        return await tailCmd(opts.args[0], ctx);
      default:
        err(`Unknown collab subcommand: ${head}`);
        err(USAGE);
        return 2;
    }
  } catch (e) {
    if (e instanceof CollabApiError) {
      err(`error: ${e.code} ${e.status} ${e.message}`);
      return 1;
    }
    err(`error: ${(e as Error).message}`);
    return 1;
  }
}

// ============================================================================
// Subcommands
// ============================================================================

interface Ctx {
  baseUrl: string;
  participantId: string;
  out: (line: string) => void;
  err: (line: string) => void;
  json: boolean;
}

async function loginCmd(ctx: Ctx): Promise<number> {
  const client = await getAuthenticatedClient(ctx.baseUrl, ctx.participantId);
  const cached = await getCachedToken(ctx.participantId);
  if (ctx.json) {
    ctx.out(
      JSON.stringify(
        {
          baseUrl: ctx.baseUrl,
          participantId: ctx.participantId,
          expiresAt: cached?.expiresAt,
          tokenFile: TOKEN_FILE_PATH,
        },
        null,
        2,
      ),
    );
  } else {
    ctx.out(`✓ Logged in as ${ctx.participantId} → ${ctx.baseUrl}`);
    if (cached?.expiresAt) {
      const at = new Date(cached.expiresAt * 1000).toISOString();
      ctx.out(`  Token cached until ${at}`);
    }
    ctx.out(`  Cache file: ${TOKEN_FILE_PATH}`);
  }
  void client; // silence unused
  return 0;
}

async function logoutCmd(ctx: Ctx): Promise<number> {
  await clearCachedToken(ctx.participantId);
  if (ctx.json) {
    ctx.out(JSON.stringify({ logged_out: ctx.participantId }));
  } else {
    ctx.out(`✓ Cleared cached token for ${ctx.participantId}`);
  }
  return 0;
}

async function roomCmd(
  sub: string[],
  args: string[],
  ctx: Ctx,
): Promise<number> {
  const client = await getAuthenticatedClient(ctx.baseUrl, ctx.participantId);
  const [action] = sub;

  switch (action) {
    case 'create': {
      const name = args[0];
      if (!name) {
        ctx.err('usage: collab room create <name> [--path P] [--mode M]');
        return 2;
      }
      const room = await client.createRoom({
        name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        projectPath: (ctx as any).extraPath as string | undefined,
      });
      printRoom(room, ctx);
      return 0;
    }
    case 'list': {
      const rooms = await client.listRooms();
      if (ctx.json) {
        ctx.out(JSON.stringify(rooms, null, 2));
      } else if (rooms.length === 0) {
        ctx.out('(no rooms)');
      } else {
        for (const r of rooms) printRoomLine(r, ctx);
      }
      return 0;
    }
    case 'get': {
      const id = args[0];
      if (!id) {
        ctx.err('usage: collab room get <id>');
        return 2;
      }
      const detail = await client.getRoom(id);
      if (ctx.json) {
        ctx.out(JSON.stringify(detail, null, 2));
      } else {
        printRoom(detail.room, ctx);
        ctx.out(`  mode:  ${detail.mode}`);
        ctx.out(`  participants (${detail.participants.length}):`);
        for (const p of detail.participants) {
          ctx.out(`    - ${p.name} [${p.type}] ${p.role}`);
        }
      }
      return 0;
    }
    case 'delete': {
      const id = args[0];
      if (!id) {
        ctx.err('usage: collab room delete <id>');
        return 2;
      }
      await client.deleteRoom(id);
      if (ctx.json) ctx.out(JSON.stringify({ deleted: id }));
      else ctx.out(`✓ Deleted room ${id}`);
      return 0;
    }
    case 'join': {
      const id = args[0];
      if (!id) {
        ctx.err('usage: collab room join <id>');
        return 2;
      }
      const p = await client.joinRoom(id, { name: ctx.participantId, type: 'human' });
      if (ctx.json) ctx.out(JSON.stringify(p, null, 2));
      else ctx.out(`✓ Joined ${id} as ${p.name} (participant ${p.id})`);
      return 0;
    }
    case 'leave': {
      const id = args[0];
      const pid = args[1];
      if (!id || !pid) {
        ctx.err('usage: collab room leave <roomId> <participantId>');
        return 2;
      }
      await client.leaveRoom(id, pid);
      if (ctx.json) ctx.out(JSON.stringify({ left: pid }));
      else ctx.out(`✓ Left room ${id}`);
      return 0;
    }
    default:
      ctx.err(
        'usage: collab room {create|list|get|delete|join|leave} ...',
      );
      return 2;
  }
}

async function modeCmd(
  sub: string[],
  args: string[],
  ctx: Ctx,
): Promise<number> {
  const client = await getAuthenticatedClient(ctx.baseUrl, ctx.participantId);
  const [action] = sub;
  const id = args[0];
  if (!id) {
    ctx.err('usage: collab mode {get|set} <roomId> [mode]');
    return 2;
  }
  switch (action) {
    case 'get': {
      const r = await client.getMode(id);
      if (ctx.json) ctx.out(JSON.stringify(r, null, 2));
      else ctx.out(`mode: ${r.mode}`);
      return 0;
    }
    case 'set': {
      const mode = args[1];
      if (!mode || !VALID_MODES.has(mode as PermissionMode)) {
        ctx.err(`invalid mode "${mode}" — expected one of plan|code|ask|auto`);
        return 2;
      }
      const r = await client.setMode(id, mode as PermissionMode);
      if (ctx.json) ctx.out(JSON.stringify(r));
      else ctx.out(`✓ Mode is now ${r.mode}`);
      return 0;
    }
    default:
      ctx.err('usage: collab mode {get|set} <roomId> [mode]');
      return 2;
  }
}

async function tailCmd(roomId: string | undefined, ctx: Ctx): Promise<number> {
  // Ensure token is cached / fresh before opening the WS.
  await getAuthenticatedClient(ctx.baseUrl, ctx.participantId);
  const cached = await getCachedToken(ctx.participantId);
  if (!cached) {
    ctx.err('no cached token — run `openagent collab login` first');
    return 1;
  }

  // Lazy-import `ws` so the CLI doesn't fail-load when it isn't
  // installed; we only need it for `tail`. Use a local minimal type so
  // TypeScript stays happy even without @types/ws.
  interface MinimalWS {
    on(event: 'open' | 'close' | 'error' | 'message', fn: (...a: unknown[]) => void): void;
    close(code?: number, reason?: string): void;
  }
  type WSCtor = new (url: string) => MinimalWS;

  let WebSocketCtor: WSCtor;
  try {
    const mod = (await import('ws')) as unknown as {
      WebSocket?: WSCtor;
      default?: WSCtor;
    };
    WebSocketCtor = (mod.WebSocket ?? mod.default) as WSCtor;
  } catch {
    ctx.err('error: `ws` package not available — install it to use `collab tail`');
    return 1;
  }

  const wsBase = ctx.baseUrl.replace(/^http/, 'ws');
  const params = new URLSearchParams();
  params.set('token', cached.token);
  if (roomId) params.set('roomId', roomId);
  const url = `${wsBase}/ws?${params.toString()}`;

  ctx.out(`↪ tailing ${url}`);
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocketCtor(url);
    socket.on('open', () => ctx.out('✓ connected'));
    socket.on('message', (...a: unknown[]) => {
      const raw = a[0] as Buffer | string;
      const text = typeof raw === 'string' ? raw : raw.toString();
      try {
        const event = JSON.parse(text) as {
          type: string;
          source?: string;
          timestamp?: number;
        };
        if (ctx.json) {
          ctx.out(JSON.stringify(event));
        } else {
          const ts = event.timestamp
            ? new Date(event.timestamp).toISOString()
            : new Date().toISOString();
          const src = event.source ? `[${event.source}] ` : '';
          ctx.out(`${ts} ${src}${event.type}`);
        }
      } catch {
        ctx.out(`(unparseable) ${text}`);
      }
    });
    socket.on('close', (...a: unknown[]) => {
      const code = (a[0] as number) ?? 0;
      const reason = a[1];
      const reasonStr =
        reason && typeof (reason as Buffer).toString === 'function'
          ? (reason as Buffer).toString()
          : String(reason ?? '');
      ctx.err(`connection closed: ${code} ${reasonStr}`);
      resolve();
    });
    socket.on('error', (...a: unknown[]) => {
      const e = a[0] as Error;
      ctx.err(`socket error: ${e.message}`);
      reject(e);
    });
    process.on('SIGINT', () => {
      ctx.err('\n(SIGINT) closing');
      try {
        socket.close(1000, 'sigint');
      } catch {
        /* ignore */
      }
    });
  });
  return 0;
}

// ============================================================================
// Helpers
// ============================================================================

function coerceString(v: string | boolean | undefined): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function printRoom(room: Room, ctx: Ctx): void {
  if (ctx.json) {
    ctx.out(JSON.stringify(room, null, 2));
    return;
  }
  ctx.out(`${room.name}  (id: ${room.id})`);
  ctx.out(`  slug:       ${room.slug}`);
  if (room.projectPath) ctx.out(`  path:       ${room.projectPath}`);
  ctx.out(`  owner:      ${room.ownerId}`);
  ctx.out(`  mode:       ${room.config.defaultMode}`);
  ctx.out(`  visibility: ${room.config.visibility}`);
}

function printRoomLine(room: Room, ctx: Ctx): void {
  ctx.out(
    `  ${room.id.slice(0, 8)}  ${room.config.defaultMode.padEnd(4)}  ${room.name}` +
      (room.projectPath ? `  (${room.projectPath})` : ''),
  );
}

// ============================================================================
// Help text
// ============================================================================

const USAGE = `usage: openagent collab <subcommand>

Subcommands:
  login                              cache a JWT for future calls
  logout                             clear cached token
  room create <name>                 create a room
  room list                          list rooms
  room get <id>                      get room + participants + mode
  room delete <id>                   delete a room (owner only)
  room join <id>                     join a room
  room leave <id> <pid>              leave a room
  mode get <id>                      show current mode
  mode set <id> <mode>               change mode (plan|code|ask|auto)
  tail [roomId]                      stream live events to stdout

Common options:
  --base <url>     collab server (default \$OPENAGENT_COLLAB_URL)
  --as <id>        participant id (default \$OPENAGENT_PARTICIPANT)
  --json           emit JSON instead of pretty text
`;

// Tested API
export type { Intent, Participant, Room };

// ============================================================================
// argv adapter (for wiring into the main CLI dispatcher)
// ============================================================================

/**
 * Parse `argv` (the slice after 'collab') into CollabCommandOptions.
 *
 * Subcommand recognition is greedy from the start: 'room create' is one
 * subcommand path, 'tail' is one. Any --flag VALUE pairs and --flag=VALUE
 * forms are pulled out into `flags`; everything else becomes a
 * positional `arg`. Bare boolean flags (no value following) are stored
 * as `true`.
 */
export function parseCollabArgv(argv: string[]): CollabCommandOptions {
  const subcommand: string[] = [];
  const args: string[] = [];
  const flags: Record<string, string | boolean | undefined> = {};

  const TWO_WORD = new Set([
    'room create',
    'room list',
    'room get',
    'room delete',
    'room join',
    'room leave',
    'mode get',
    'mode set',
  ]);
  const ONE_WORD = new Set(['login', 'logout', 'tail', 'help']);

  let i = 0;
  if (argv.length > 0) {
    const first = argv[0];
    const second = argv[1];
    if (second && TWO_WORD.has(`${first} ${second}`)) {
      subcommand.push(first, second);
      i = 2;
    } else if (ONE_WORD.has(first)) {
      subcommand.push(first);
      i = 1;
    } else {
      // Unknown — push the head and let collabCommand error out cleanly.
      subcommand.push(first);
      i = 1;
    }
  }

  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) {
          flags[key] = true;
        } else {
          flags[key] = next;
          i += 1;
        }
      }
    } else {
      args.push(a);
    }
  }

  return { subcommand, args, flags };
}

/** Convenience entrypoint: parse argv and run the command. */
export async function collabMain(argv: string[]): Promise<number> {
  return collabCommand(parseCollabArgv(argv));
}

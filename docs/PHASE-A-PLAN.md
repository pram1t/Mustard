# Phase A: MVP Implementation Plan

> Transforming OpenAgent from single agent to multi-worker council

---

## Overview

**Goal:** Prove the multi-worker model works with 3 specialized workers collaborating on tasks.

**Duration:** 4-6 weeks

**Starting Point:** Foundation complete (CLI, 5 LLM providers, 6 tools, MCP client)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                USER REQUEST                                      │
│                        "Add a login page with auth"                              │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ORCHESTRATOR                                        │
│  • Analyzes request                                                             │
│  • Creates task breakdown                                                       │
│  • Assigns workers                                                              │
│  • Monitors progress                                                            │
└──────────┬─────────────────────────┬─────────────────────────┬──────────────────┘
           │                         │                         │
           ▼                         ▼                         ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  🏗️ ARCHITECT       │  │  🎨 FRONTEND        │  │  ⚙️ BACKEND         │
│                     │  │                     │  │                     │
│  • System design    │  │  • UI components    │  │  • API endpoints    │
│  • Architecture     │  │  • Pages/views      │  │  • Database         │
│  • Tech decisions   │  │  • Styling          │  │  • Business logic   │
│                     │  │                     │  │                     │
│  Artifacts:         │  │  Artifacts:         │  │  Artifacts:         │
│  - design_doc       │  │  - component_code   │  │  - api_code         │
│  - api_spec         │  │  - test_code        │  │  - test_code        │
│  - component_spec   │  │                     │  │  - migration        │
└──────────┬──────────┘  └──────────┬──────────┘  └──────────┬──────────┘
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            HANDOFF PROTOCOL                                      │
│  • Artifact passing between workers                                             │
│  • Review requests                                                              │
│  • Clarification requests                                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Worker Types & Interfaces
**File:** `packages/core/src/workers/types.ts`

```typescript
// Worker roles
export type WorkerRole =
  | 'architect'
  | 'frontend'
  | 'backend';

// Skill levels
export type SkillLevel = 'novice' | 'intermediate' | 'expert';

// Worker skills
export type Skill =
  | 'system_design'
  | 'api_design'
  | 'react'
  | 'typescript'
  | 'node'
  | 'database'
  | 'testing';

// Task status
export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'blocked'
  | 'review'
  | 'completed'
  | 'failed';

// Task priority
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

// Core interfaces
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: WorkerId;
  createdAt: Date;
  updatedAt: Date;
  dependencies: TaskId[];
  artifacts: ArtifactId[];
  parentTask?: TaskId;
  subtasks: TaskId[];
}

export interface WorkerMemory {
  projectContext: string;
  decisions: Decision[];
  learnings: Learning[];
  skillLevels: Map<Skill, SkillLevel>;
}

export interface Worker {
  id: string;
  role: WorkerRole;
  name: string;
  memory: WorkerMemory;
  skills: Skill[];
  tools: string[]; // Tool names this worker can use

  receiveTask(task: Task): Promise<void>;
  execute(): AsyncGenerator<WorkerEvent>;
  handOff(artifact: Artifact, to: WorkerId): Promise<HandoffResult>;
  requestReview(artifact: Artifact, from: WorkerId): Promise<ReviewResult>;
}
```

**Deliverables:**
- [ ] WorkerRole type
- [ ] Skill and SkillLevel types
- [ ] Task interface with full lifecycle
- [ ] WorkerMemory interface
- [ ] Worker interface
- [ ] Event types (WorkerEvent, HandoffResult, ReviewResult)

---

### Step 2: Base Worker Class
**File:** `packages/core/src/workers/base.ts`

```typescript
export abstract class BaseWorker implements Worker {
  readonly id: string;
  readonly role: WorkerRole;
  readonly name: string;

  protected memory: WorkerMemory;
  protected agentLoop: AgentLoop;
  protected currentTask: Task | null = null;

  constructor(config: WorkerConfig) {
    this.id = config.id || generateId();
    this.role = config.role;
    this.name = config.name;
    this.memory = this.initializeMemory();
    this.agentLoop = this.createAgentLoop(config);
  }

  // Abstract methods - each worker implements
  abstract get systemPrompt(): string;
  abstract get skills(): Skill[];
  abstract get tools(): string[];

  // Shared implementation
  async receiveTask(task: Task): Promise<void> {
    this.currentTask = task;
    await this.updateMemory({ currentTask: task });
  }

  async *execute(): AsyncGenerator<WorkerEvent> {
    if (!this.currentTask) throw new Error('No task assigned');

    const prompt = this.buildTaskPrompt(this.currentTask);

    for await (const event of this.agentLoop.run(prompt)) {
      yield this.transformEvent(event);
    }
  }

  async handOff(artifact: Artifact, to: WorkerId): Promise<HandoffResult> {
    // Implement handoff logic
  }
}
```

**Deliverables:**
- [ ] BaseWorker abstract class
- [ ] AgentLoop integration (reuse existing)
- [ ] Task prompt building
- [ ] Event transformation
- [ ] Memory initialization

---

### Step 3: Worker Memory System
**File:** `packages/core/src/workers/memory.ts`

```typescript
export class InMemoryWorkerMemory implements WorkerMemory {
  private store: Map<string, unknown> = new Map();

  projectContext: string = '';
  decisions: Decision[] = [];
  learnings: Learning[] = [];
  skillLevels: Map<Skill, SkillLevel> = new Map();

  async save(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async load(key: string): Promise<unknown> {
    return this.store.get(key);
  }

  async addDecision(decision: Decision): Promise<void> {
    this.decisions.push(decision);
  }

  async addLearning(learning: Learning): Promise<void> {
    this.learnings.push(learning);
  }

  getRelevantContext(task: Task): string {
    // Return context relevant to the task
  }
}
```

**Deliverables:**
- [ ] InMemoryWorkerMemory class
- [ ] Decision tracking
- [ ] Learning tracking
- [ ] Context retrieval for tasks
- [ ] Serialization for persistence (future)

---

### Step 4: Architect Worker
**File:** `packages/core/src/workers/definitions/architect.ts`

```typescript
export class ArchitectWorker extends BaseWorker {
  readonly role = 'architect' as const;

  get systemPrompt(): string {
    return `You are a Software Architect worker in a development team.

Your responsibilities:
- Analyze feature requests and break them into components
- Design system architecture and data flow
- Create API specifications
- Make technology decisions
- Review architectural decisions from other workers

You produce these artifacts:
- architecture_design: High-level system design
- api_specification: OpenAPI/REST specs
- component_spec: Component breakdown with interfaces
- tech_decision: ADR (Architecture Decision Record)

When you complete a design, hand it off to the appropriate worker:
- Frontend specs → Frontend Worker
- Backend specs → Backend Worker

Always explain your reasoning and trade-offs.`;
  }

  get skills(): Skill[] {
    return ['system_design', 'api_design', 'typescript'];
  }

  get tools(): string[] {
    return ['Read', 'Write', 'Glob', 'Grep']; // No Bash - architects don't run code
  }
}
```

**Deliverables:**
- [ ] ArchitectWorker class
- [ ] System prompt with responsibilities
- [ ] Skills and tools configuration
- [ ] Artifact types it produces
- [ ] Handoff triggers

---

### Step 5: Frontend Worker
**File:** `packages/core/src/workers/definitions/frontend.ts`

```typescript
export class FrontendWorker extends BaseWorker {
  readonly role = 'frontend' as const;

  get systemPrompt(): string {
    return `You are a Frontend Developer worker in a development team.

Your responsibilities:
- Implement UI components based on specs
- Create pages and views
- Write frontend tests
- Handle state management
- Implement styling

You work with these technologies:
- React / Next.js
- TypeScript
- Tailwind CSS / CSS-in-JS
- Testing Library / Vitest

You receive specs from the Architect and implement them.
When you need backend APIs, request them from the Backend Worker.
Request review from Architect for significant UI decisions.`;
  }

  get skills(): Skill[] {
    return ['react', 'typescript', 'testing'];
  }

  get tools(): string[] {
    return ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];
  }
}
```

**Deliverables:**
- [ ] FrontendWorker class
- [ ] System prompt with tech stack
- [ ] Skills and tools
- [ ] Review request triggers

---

### Step 6: Backend Worker
**File:** `packages/core/src/workers/definitions/backend.ts`

```typescript
export class BackendWorker extends BaseWorker {
  readonly role = 'backend' as const;

  get systemPrompt(): string {
    return `You are a Backend Developer worker in a development team.

Your responsibilities:
- Implement API endpoints based on specs
- Design and implement database schemas
- Write backend business logic
- Create database migrations
- Write API tests

You work with these technologies:
- Node.js / Bun
- TypeScript
- PostgreSQL / SQLite
- REST / tRPC
- Vitest for testing

You receive API specs from the Architect.
Coordinate with Frontend Worker on API contracts.
Request review from Architect for significant backend decisions.`;
  }

  get skills(): Skill[] {
    return ['node', 'typescript', 'database', 'api_design', 'testing'];
  }

  get tools(): string[] {
    return ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];
  }
}
```

**Deliverables:**
- [ ] BackendWorker class
- [ ] System prompt
- [ ] Database-related skills
- [ ] All tools available

---

### Step 7: Task Queue
**File:** `packages/core/src/orchestration/queue.ts`

```typescript
export class InMemoryTaskQueue implements TaskQueue {
  private tasks: Map<TaskId, Task> = new Map();
  private queue: TaskId[] = []; // Ordered by priority

  async add(task: Task): Promise<TaskId> {
    this.tasks.set(task.id, task);
    this.insertByPriority(task.id, task.priority);
    return task.id;
  }

  async claim(workerId: WorkerId, role: WorkerRole): Promise<Task | null> {
    // Find first task that matches worker's role
    for (const taskId of this.queue) {
      const task = this.tasks.get(taskId);
      if (task && task.status === 'pending' && this.matchesRole(task, role)) {
        task.status = 'assigned';
        task.assignedTo = workerId;
        return task;
      }
    }
    return null;
  }

  async complete(taskId: TaskId, result: TaskResult): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.artifacts.push(...result.artifacts);
    }
  }

  async fail(taskId: TaskId, error: Error): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'failed';
      // Could add retry logic here
    }
  }
}
```

**Deliverables:**
- [ ] InMemoryTaskQueue class
- [ ] Priority-based ordering
- [ ] Role-based task matching
- [ ] Task lifecycle management

---

### Step 8: Message Bus
**File:** `packages/core/src/orchestration/bus.ts`

```typescript
export class InMemoryMessageBus implements MessageBus {
  private subscriptions: Map<string, Set<Handler>> = new Map();
  private messageLog: Message[] = []; // For debugging/audit

  async publish(topic: string, message: Message): Promise<void> {
    this.messageLog.push(message);

    const handlers = this.subscriptions.get(topic);
    if (handlers) {
      for (const handler of handlers) {
        await handler(message);
      }
    }
  }

  async subscribe(topic: string, handler: Handler): Promise<SubscriptionId> {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    this.subscriptions.get(topic)!.add(handler);
    return generateSubscriptionId();
  }

  async unsubscribe(subscriptionId: SubscriptionId): Promise<void> {
    // Remove handler
  }
}

// Message types
type MessageTopic =
  | 'task.created'
  | 'task.assigned'
  | 'task.completed'
  | 'task.failed'
  | 'handoff.initiated'
  | 'handoff.accepted'
  | 'handoff.rejected'
  | 'review.requested'
  | 'review.completed';
```

**Deliverables:**
- [ ] InMemoryMessageBus class
- [ ] Topic-based pub/sub
- [ ] Message logging for audit
- [ ] Standard message topics

---

### Step 9: Orchestrator
**File:** `packages/core/src/orchestration/orchestrator.ts`

```typescript
export class Orchestrator {
  private workers: Map<WorkerId, Worker> = new Map();
  private taskQueue: TaskQueue;
  private messageBus: MessageBus;
  private llmRouter: LLMRouter; // For planning

  constructor(config: OrchestratorConfig) {
    this.taskQueue = config.taskQueue || new InMemoryTaskQueue();
    this.messageBus = config.messageBus || new InMemoryMessageBus();
    this.llmRouter = config.llmRouter;
  }

  async processRequest(request: string): Promise<void> {
    // 1. Plan tasks using LLM
    const plan = await this.planTasks(request);

    // 2. Create tasks in queue
    for (const taskDef of plan.tasks) {
      await this.taskQueue.add(this.createTask(taskDef));
    }

    // 3. Assign and execute
    await this.executeUntilComplete();
  }

  private async planTasks(request: string): Promise<TaskPlan> {
    // Use LLM to break down request into tasks
    const prompt = `Break down this request into tasks for a dev team:
      Request: ${request}

      Available workers:
      - Architect: System design, API specs
      - Frontend: UI components, pages
      - Backend: APIs, database

      Output JSON with tasks array.`;

    // Call LLM and parse response
  }

  private async executeUntilComplete(): Promise<void> {
    while (this.hasPendingTasks()) {
      // Assign available tasks to workers
      for (const [workerId, worker] of this.workers) {
        const task = await this.taskQueue.claim(workerId, worker.role);
        if (task) {
          await this.executeWorkerTask(worker, task);
        }
      }
    }
  }
}
```

**Deliverables:**
- [ ] Orchestrator class
- [ ] LLM-based task planning
- [ ] Worker registration
- [ ] Task assignment algorithm
- [ ] Execution loop
- [ ] Progress monitoring

---

### Step 10: Artifact System
**File:** `packages/core/src/artifacts/types.ts`

```typescript
export type ArtifactType =
  | 'architecture_design'
  | 'api_specification'
  | 'component_spec'
  | 'tech_decision'
  | 'code_file'
  | 'test_file'
  | 'migration'
  | 'review_feedback';

export interface Artifact {
  id: string;
  type: ArtifactType;
  name: string;
  content: string;
  createdBy: WorkerId;
  createdAt: Date;
  version: number;
  metadata: Record<string, unknown>;
}

export class ArtifactStorage {
  private artifacts: Map<ArtifactId, Artifact> = new Map();

  async store(artifact: Artifact): Promise<ArtifactId> {
    this.artifacts.set(artifact.id, artifact);
    return artifact.id;
  }

  async get(id: ArtifactId): Promise<Artifact | null> {
    return this.artifacts.get(id) || null;
  }

  async getByType(type: ArtifactType): Promise<Artifact[]> {
    return Array.from(this.artifacts.values())
      .filter(a => a.type === type);
  }
}
```

**Deliverables:**
- [ ] ArtifactType enum
- [ ] Artifact interface
- [ ] ArtifactStorage class
- [ ] Version tracking

---

### Step 11: Handoff Protocol
**File:** `packages/core/src/handoff/protocol.ts`

```typescript
export class HandoffProtocol {
  private messageBus: MessageBus;
  private artifactStorage: ArtifactStorage;
  private pendingHandoffs: Map<HandoffId, Handoff> = new Map();

  async initiate(
    from: Worker,
    to: WorkerId,
    artifact: Artifact,
    message: string
  ): Promise<HandoffId> {
    const handoff: Handoff = {
      id: generateId(),
      from: from.id,
      to,
      artifactId: artifact.id,
      message,
      status: 'pending',
      createdAt: new Date(),
    };

    this.pendingHandoffs.set(handoff.id, handoff);

    await this.messageBus.publish('handoff.initiated', {
      handoffId: handoff.id,
      from: from.id,
      to,
      artifactType: artifact.type,
    });

    return handoff.id;
  }

  async acknowledge(
    handoffId: HandoffId,
    accepted: boolean,
    feedback?: string
  ): Promise<void> {
    const handoff = this.pendingHandoffs.get(handoffId);
    if (!handoff) throw new Error('Handoff not found');

    handoff.status = accepted ? 'accepted' : 'rejected';

    const topic = accepted ? 'handoff.accepted' : 'handoff.rejected';
    await this.messageBus.publish(topic, {
      handoffId,
      feedback,
    });
  }
}
```

**Deliverables:**
- [ ] HandoffProtocol class
- [ ] Handoff initiation
- [ ] Acceptance/rejection flow
- [ ] Feedback mechanism

---

### Step 12: CLI Multi-Worker Mode
**File:** `apps/cli/src/index.ts` (extend)

```typescript
// Add new command: openagent team "request"
if (args.command === 'team') {
  const orchestrator = new Orchestrator({
    llmRouter: router,
    taskQueue: new InMemoryTaskQueue(),
    messageBus: new InMemoryMessageBus(),
  });

  // Register workers
  orchestrator.registerWorker(new ArchitectWorker({ llmRouter: router }));
  orchestrator.registerWorker(new FrontendWorker({ llmRouter: router }));
  orchestrator.registerWorker(new BackendWorker({ llmRouter: router }));

  // Process request
  for await (const event of orchestrator.processRequest(args.prompt)) {
    // Display worker activity
    switch (event.type) {
      case 'task_assigned':
        console.log(`[${event.worker}] Starting: ${event.task.title}`);
        break;
      case 'worker_output':
        process.stdout.write(event.content);
        break;
      case 'handoff':
        console.log(`[Handoff] ${event.from} → ${event.to}`);
        break;
      case 'complete':
        console.log(`\n✅ All tasks completed!`);
        break;
    }
  }
}
```

**Deliverables:**
- [ ] `team` subcommand
- [ ] Worker registration in CLI
- [ ] Event display formatting
- [ ] Progress visualization

---

## Testing Strategy

### Unit Tests

```typescript
// packages/core/src/workers/__tests__/base.test.ts
describe('BaseWorker', () => {
  it('should receive and execute tasks');
  it('should track memory across tasks');
  it('should filter tools by role');
});

// packages/core/src/orchestration/__tests__/orchestrator.test.ts
describe('Orchestrator', () => {
  it('should break down requests into tasks');
  it('should assign tasks to correct workers');
  it('should handle worker handoffs');
  it('should complete when all tasks done');
});
```

### Integration Tests

```typescript
describe('Multi-Worker Flow', () => {
  it('should complete simple feature request', async () => {
    const orchestrator = createTestOrchestrator();

    const result = await orchestrator.processRequest(
      'Add a hello world page'
    );

    expect(result.completed).toBe(true);
    expect(result.artifacts).toContainEqual(
      expect.objectContaining({ type: 'code_file' })
    );
  });
});
```

---

## Success Criteria

| Criteria | Metric |
|----------|--------|
| Workers instantiate | 3 workers created successfully |
| Task planning works | Request → tasks with correct assignment |
| Handoffs work | Architect → Frontend/Backend transfers |
| E2E completion | "Add login page" completes |
| Tests pass | All 125 existing + new tests |
| Build succeeds | `npm run build` passes |

---

## Next Steps After Phase A

1. **Phase B: Growth**
   - Add 7 more workers (Designer, QA, DevOps, etc.)
   - Build web UI
   - War room feature

2. **Persistence**
   - Move from in-memory to SQLite/PostgreSQL
   - Worker memory persistence

3. **Advanced Orchestration**
   - Parallel task execution
   - Dependency graph

---

*Ready to start implementation!*

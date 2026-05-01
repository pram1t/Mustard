# OpenAgent Roadmap Tracker

> Living document tracking progress from Foundation to full Platform

---

## Progress Overview

```
FOUNDATION (Phases 1-6)     PHASE A (MVP)           PHASE B              PHASE C
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[██████████████████████]    [                    ]   [                ]   [            ]
        100%                        0%                    0%                 0%
     COMPLETE                   STARTING               PLANNED            PLANNED
```

---

## FOUNDATION - OpenAgent Core (COMPLETE)

### Phase 1: Project Setup ✅

| Task | Status | Notes |
|------|--------|-------|
| Initialize monorepo structure | ✅ Done | npm workspaces |
| Configure TypeScript | ✅ Done | Strict mode, ES modules |
| Configure Turborepo | ✅ Done | Build caching, parallel builds |
| Setup Vitest testing | ✅ Done | 125 tests passing |
| Create package structure | ✅ Done | 8 packages + 1 app |

**Artifacts:**
- `package.json` - Monorepo root
- `turbo.json` - Build pipeline
- `tsconfig.json` - Base TS config
- `vitest.config.ts` - Test config

---

### Phase 2: Core Framework ✅

| Task | Status | Notes |
|------|--------|-------|
| Agent loop implementation | ✅ Done | `packages/core/src/agent/loop.ts` |
| Event streaming | ✅ Done | AsyncGenerator pattern |
| Context management | ✅ Done | `packages/core/src/context/manager.ts` |
| System prompt generation | ✅ Done | OS-aware (Windows/Mac/Linux) |
| Tool execution pipeline | ✅ Done | Parallel execution support |

**Artifacts:**
- `@mustard/core` package
- `AgentLoop` class - main orchestration
- `ContextManager` class - memory handling
- Event types: text, tool_call, tool_result, error, done

---

### Phase 3: Built-in Tools ✅

| Task | Status | Notes |
|------|--------|-------|
| Tool interface & registry | ✅ Done | `packages/tools/src/registry.ts` |
| Bash tool | ✅ Done | Cross-platform shell execution |
| Read tool | ✅ Done | File reading with offset/limit |
| Write tool | ✅ Done | File creation/overwrite |
| Edit tool | ✅ Done | Find/replace editing |
| Glob tool | ✅ Done | File pattern matching |
| Grep tool | ✅ Done | Content search with regex |
| Security utilities | ✅ Done | Path sanitization, command validation |

**Artifacts:**
- `@mustard/tools` package
- 6 built-in tools
- `BaseTool` abstract class for custom tools
- Security layer preventing path traversal, dangerous commands

---

### Phase 4: Context & Memory ✅

| Task | Status | Notes |
|------|--------|-------|
| Token counting | ✅ Done | tiktoken integration |
| Context compaction | ✅ Done | Automatic when limit reached |
| Message history | ✅ Done | System, user, assistant, tool messages |
| Abort signal support | ✅ Done | Graceful cancellation |

**Artifacts:**
- `ContextManager` with configurable limits
- Automatic compaction strategy
- Token-aware message management

---

### Phase 5: LLM Providers ✅

| Task | Status | Notes |
|------|--------|-------|
| Provider interface | ✅ Done | `LLMProvider` abstraction |
| OpenAI adapter | ✅ Done | gpt-4o, gpt-4-turbo, etc. |
| Anthropic adapter | ✅ Done | claude-3-opus, sonnet, haiku |
| Gemini adapter | ✅ Done | gemini-1.5-pro, flash |
| Ollama adapter | ✅ Done | Local models |
| OpenAI-compatible adapter | ✅ Done | Any compatible API |
| Router | ✅ Done | `LLMRouter` for provider management |
| Streaming | ✅ Done | All providers support streaming |
| Tool calling | ✅ Done | Unified tool call format |

**Artifacts:**
- `@mustard/llm` package
- 5 provider adapters
- Unified streaming interface
- Tool call normalization

---

### Phase 6: MCP Client ✅

| Task | Status | Notes |
|------|--------|-------|
| MCP types | ✅ Done | JSON-RPC, tools, resources |
| STDIO transport | ✅ Done | Spawn process communication |
| HTTP transport | ✅ Done | REST + optional SSE |
| MCP Client | ✅ Done | Connect, initialize, list/call tools |
| MCP Registry | ✅ Done | Multi-server management |
| CLI integration | ✅ Done | `mcp add/remove/list` commands |
| Tool aggregation | ✅ Done | Prefix tools with server name |

**Artifacts:**
- `@mustard/mcp` package
- `MCPClient` class
- `MCPRegistry` for multiple servers
- CLI subcommands for server management

---

### Supporting Packages ✅

| Package | Status | Purpose |
|---------|--------|---------|
| `@mustard/config` | ✅ Done | Configuration loading, validation |
| `@mustard/logger` | ✅ Done | Pino-based structured logging |
| `@mustard/hooks` | ✅ Done | Lifecycle event hooks |
| `@mustard/test-utils` | ✅ Done | Shared test utilities |

---

### CLI Application ✅

| Task | Status | Notes |
|------|--------|-------|
| Argument parsing | ✅ Done | --provider, --model, --base-url, etc. |
| Provider selection | ✅ Done | 5 providers supported |
| Tool loading | ✅ Done | Built-in + MCP tools |
| Event streaming | ✅ Done | Real-time terminal output |
| MCP commands | ✅ Done | add, remove, list servers |
| Error handling | ✅ Done | Graceful error messages |

**Usage:**
```bash
openagent "Hello"
openagent --provider anthropic "Explain this code"
openagent --provider ollama --model llama3.2 "Hello"
openagent mcp add myserver --command "npx @some/mcp-server"
```

---

### Phase 7: Hook System ✅

| Task | Status | Notes |
|------|--------|-------|
| Hook types & interfaces | ✅ Done | `packages/hooks/src/types.ts` |
| HookExecutor class | ✅ Done | Script execution with timeout |
| Hook matching | ✅ Done | Tool name and pattern matching |
| Fail-open behavior | ✅ Done | Errors don't block execution |
| CLI integration | ✅ Done | Hooks config loading |

**Artifacts:**
- `@mustard/hooks` package
- 6 hook event types: session_start, stop, user_prompt_submit, pre_tool_use, post_tool_use, notification

---

### Phase 8: Permission System ✅

| Task | Status | Notes |
|------|--------|-------|
| Permission types | ✅ Done | Tool-based, path-based permissions |
| PermissionManager | ✅ Done | Grant, check, persist, batch operations |
| Session scope | ✅ Done | Permissions reset each session |
| Bash parsing | ✅ Done | Semantic grouping (git *, npm *, etc.) |
| UI integration | ✅ Done | CLI permission prompts |

**Artifacts:**
- `packages/core/src/permissions/` module
- `PermissionManager` class
- Default allow tools configuration
- Path-based permissions (glob patterns)

---

### Phase 8.5: Security Hardening ✅

| Task | Status | Notes |
|------|--------|-------|
| Environment filtering | ✅ Done | `filterEnvVars()` in logger package |
| Command validation | ✅ Done | Block dangerous patterns |
| Path sanitization | ✅ Done | Prevent traversal attacks |
| Test coverage | ✅ Done | 22 security tests |

---

### Phase 9: Session Management ✅

| Task | Status | Notes |
|------|--------|-------|
| Session types | ✅ Done | `packages/core/src/session/types.ts` |
| SessionManager | ✅ Done | save/load/list/delete operations |
| ContextManager.restore() | ✅ Done | Resume session context |
| CLI session commands | ✅ Done | `session list/show/delete` |
| CLI --resume flag | ✅ Done | Resume previous session |
| Auto-save | ✅ Done | Save on agent completion |

**Artifacts:**
- `packages/core/src/session/` module
- `SessionManager` class
- Sessions stored in `~/.openagent/sessions/`
- 24 session management tests

---

## Foundation Verification

**Build Status:** ✅ All 9 packages build successfully
**Test Status:** ✅ 214 tests passing
**Last Verified:** 2026-01-30

```
 Test Files  14 passed (14)
      Tests  214 passed (214)
   Duration  11.71s
```

---

---

## PHASE A: MVP - Multi-Worker System (NEXT)

> **Goal:** Prove the multi-worker model works with 3 specialized workers

### A.1 Worker Infrastructure

#### A.1.1 Worker Base Class
**Location:** `packages/core/src/workers/`

| Task | Status | Assignee |
|------|--------|----------|
| Create Worker interface | ⬜ Pending | |
| Implement BaseWorker class | ⬜ Pending | |
| Add role-based tool filtering | ⬜ Pending | |
| Implement skill tracking | ⬜ Pending | |
| Create worker factory | ⬜ Pending | |

**Types needed:**
```typescript
interface Worker {
  id: string;
  role: WorkerRole;
  memory: WorkerMemory;
  skills: Skill[];
  tools: Tool[];

  receiveTask(task: Task): Promise<void>;
  execute(): Promise<TaskResult>;
  handOff(artifact: Artifact, to: WorkerId): Promise<void>;
}

type WorkerRole =
  | 'architect'
  | 'frontend'
  | 'backend'
  | 'designer'
  | 'qa'
  | 'devops';
```

---

#### A.1.2 Worker Memory System
**Location:** `packages/core/src/workers/memory.ts`

| Task | Status | Assignee |
|------|--------|----------|
| Design memory schema | ⬜ Pending | |
| Implement in-memory store (MVP) | ⬜ Pending | |
| Add memory persistence (SQLite) | ⬜ Pending | |
| Create memory retrieval API | ⬜ Pending | |
| Add memory compaction | ⬜ Pending | |

**Types needed:**
```typescript
interface WorkerMemory {
  projectContext: ProjectContext;
  decisions: Decision[];
  learnings: Learning[];
  skillLevels: Map<Skill, SkillLevel>;
}
```

---

#### A.1.3 Three Initial Workers

**Architect Worker:**
| Task | Status |
|------|--------|
| Define system prompt | ⬜ Pending |
| Configure tools | ⬜ Pending |
| Define handoff artifacts | ⬜ Pending |
| Test in isolation | ⬜ Pending |

**Frontend Worker:**
| Task | Status |
|------|--------|
| Define system prompt | ⬜ Pending |
| Configure tools | ⬜ Pending |
| Define handoff artifacts | ⬜ Pending |
| Test in isolation | ⬜ Pending |

**Backend Worker:**
| Task | Status |
|------|--------|
| Define system prompt | ⬜ Pending |
| Configure tools | ⬜ Pending |
| Define handoff artifacts | ⬜ Pending |
| Test in isolation | ⬜ Pending |

---

### A.2 Orchestration Layer

#### A.2.1 Task Queue
**Location:** `packages/core/src/orchestration/queue.ts`

| Task | Status | Assignee |
|------|--------|----------|
| Define Task interface | ⬜ Pending | |
| Implement in-memory queue (MVP) | ⬜ Pending | |
| Add priority handling | ⬜ Pending | |
| Implement task assignment logic | ⬜ Pending | |
| Add retry logic | ⬜ Pending | |

---

#### A.2.2 Message Bus
**Location:** `packages/core/src/orchestration/bus.ts`

| Task | Status | Assignee |
|------|--------|----------|
| Define Message interface | ⬜ Pending | |
| Implement in-memory pub/sub (MVP) | ⬜ Pending | |
| Define message schemas | ⬜ Pending | |
| Add message persistence | ⬜ Pending | |
| Implement dead letter queue | ⬜ Pending | |

---

#### A.2.3 Orchestrator
**Location:** `packages/core/src/orchestration/orchestrator.ts`

| Task | Status | Assignee |
|------|--------|----------|
| Create Orchestrator class | ⬜ Pending | |
| Implement task planning | ⬜ Pending | |
| Implement worker assignment | ⬜ Pending | |
| Add progress monitoring | ⬜ Pending | |
| Add event emission | ⬜ Pending | |

---

### A.3 Handoff Protocol

#### A.3.1 Artifact Types
**Location:** `packages/core/src/artifacts/`

| Task | Status | Assignee |
|------|--------|----------|
| Define artifact types | ⬜ Pending | |
| Create validation schemas | ⬜ Pending | |
| Implement artifact storage | ⬜ Pending | |
| Add versioning | ⬜ Pending | |

---

#### A.3.2 Handoff Flow
**Location:** `packages/core/src/handoff/`

| Task | Status | Assignee |
|------|--------|----------|
| Implement handoff initiation | ⬜ Pending | |
| Implement acknowledgment | ⬜ Pending | |
| Handle rejections/clarifications | ⬜ Pending | |
| Add timeout handling | ⬜ Pending | |

---

### A.4 Basic UI (Optional for MVP)

| Task | Status | Notes |
|------|--------|-------|
| Create React app shell | ⬜ Pending | Could defer to Phase B |
| Implement project dashboard | ⬜ Pending | |
| Implement task board | ⬜ Pending | |
| Implement work stream | ⬜ Pending | |

---

### A.5 MVP Testing

| Scenario | Status | Notes |
|----------|--------|-------|
| Simple feature (login page) | ⬜ Pending | |
| Bug fix flow | ⬜ Pending | |
| Complex feature (user profiles) | ⬜ Pending | |

---

## Phase A Implementation Order

**Recommended sequence:**

```
Week 1-2: Worker Infrastructure
├── 1. Worker types & interfaces
├── 2. BaseWorker class
├── 3. Worker memory (in-memory)
├── 4. Architect worker
├── 5. Frontend worker
└── 6. Backend worker

Week 2-3: Orchestration
├── 7. Task types & queue
├── 8. Message bus (in-memory)
├── 9. Orchestrator class
└── 10. Worker assignment logic

Week 3-4: Handoff Protocol
├── 11. Artifact types
├── 12. Handoff protocol
├── 13. Integration testing
└── 14. CLI multi-worker mode

Week 4-5: Testing & Polish
├── 15. E2E test scenarios
├── 16. Bug fixes
└── 17. Documentation
```

---

## Files to Create (Phase A)

```
packages/core/src/
├── workers/
│   ├── index.ts              # Worker exports
│   ├── types.ts              # Worker interfaces
│   ├── base.ts               # BaseWorker class
│   ├── memory.ts             # WorkerMemory implementation
│   ├── factory.ts            # Worker factory
│   └── definitions/
│       ├── architect.ts      # Architect worker definition
│       ├── frontend.ts       # Frontend worker definition
│       └── backend.ts        # Backend worker definition
│
├── orchestration/
│   ├── index.ts              # Orchestration exports
│   ├── types.ts              # Task, Message types
│   ├── queue.ts              # TaskQueue implementation
│   ├── bus.ts                # MessageBus implementation
│   └── orchestrator.ts       # Orchestrator class
│
├── artifacts/
│   ├── index.ts              # Artifact exports
│   ├── types.ts              # Artifact types
│   ├── storage.ts            # Artifact storage
│   └── validation.ts         # Artifact validation
│
└── handoff/
    ├── index.ts              # Handoff exports
    ├── types.ts              # Handoff types
    └── protocol.ts           # HandoffProtocol class
```

---

## Success Criteria (Phase A)

- [ ] 3 workers can be instantiated with distinct roles
- [ ] Workers have isolated memory
- [ ] Orchestrator can break down user request into tasks
- [ ] Tasks can be assigned to appropriate workers
- [ ] Workers can execute tasks and produce artifacts
- [ ] Handoff protocol works between workers
- [ ] Simple feature request completes E2E
- [ ] All existing tests still pass
- [ ] New tests cover worker system

---

## Notes

- Start with in-memory implementations, add persistence later
- Keep workers simple - they extend existing AgentLoop
- UI can wait until Phase B - focus on backend first
- Test with CLI before building UI

---

*Last updated: 2026-01-24*

# Phase 9: Session Management

> **Status**: `pending`
> **Started**: -
> **Completed**: -
> **Tasks**: 16
> **Actions**: 48

## Overview

Implement session persistence so conversations can be saved and resumed.

## Dependencies

- [ ] Phase 4 complete (working agent)

## Deliverable

Sessions persist to disk and can be resumed across CLI invocations.

---

## Activity 9.1: Session Storage

**Status**: `pending`

### Task 9.1.1: Define Session Types
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/core/src/context/session-types.ts`
- [ ] Define SessionData with id, messages, metadata
- [ ] Define SessionMetadata with cwd, started, updated

#### Files to Create:
- `packages/core/src/context/session-types.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 9.1.2: Create Session Manager
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/core/src/context/session.ts`
- [ ] Create SessionManager class
- [ ] Define storage directory (~/.openagent/sessions)
- [ ] Generate unique session IDs

#### Files to Create:
- `packages/core/src/context/session.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 9.1.3: Implement Save
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement save(sessionId, data) method
- [ ] Serialize to JSON
- [ ] Write to ~/.openagent/sessions/{id}.json
- [ ] Update metadata timestamp

#### Files to Modify:
- `packages/core/src/context/session.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 9.1.4: Implement Load
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement load(sessionId) method
- [ ] Read from file
- [ ] Parse JSON
- [ ] Return SessionData or null

#### Files to Modify:
- `packages/core/src/context/session.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

## Activity 9.2: Context Compaction

**Status**: `pending`

### Task 9.2.1: Create Compactor Class
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/core/src/context/compactor.ts`
- [ ] Create ContextCompactor class
- [ ] Accept LLM provider for summarization

#### Files to Create:
- `packages/core/src/context/compactor.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 9.2.2: Implement Sliding Window
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Keep last N messages intact
- [ ] Remove older messages beyond window
- [ ] Preserve system message always

#### Files to Modify:
- `packages/core/src/context/compactor.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 9.2.3: Implement Summarization
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Summarize older messages using LLM
- [ ] Create summary message to replace old ones
- [ ] Preserve important tool results
- [ ] Mark summaries as such

#### Files to Modify:
- `packages/core/src/context/compactor.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 9.2.4: Implement Importance Scoring
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Score messages by importance
- [ ] Keep high-importance messages longer
- [ ] Consider tool results as higher importance
- [ ] Consider recent messages as higher importance

#### Files to Modify:
- `packages/core/src/context/compactor.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 9.2.5: Integrate with Context Manager
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Add compactor to ContextManager
- [ ] Call compactor when needsCompaction()
- [ ] Update token count after compaction

#### Files to Modify:
- `packages/core/src/context/manager.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

## Activity 9.3: CLI Commands

**Status**: `pending`

### Task 9.3.1: Add Session Subcommand
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Add `session` subcommand
- [ ] Support `session list`
- [ ] Support `session show <id>`
- [ ] Support `session delete <id>`

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
openagent session --help
```

---

### Task 9.3.2: Implement Session List
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] List all saved sessions
- [ ] Show id, date, message count
- [ ] Sort by most recent

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
openagent session list
```

---

### Task 9.3.3: Implement Resume Flag
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Add --resume <id> flag
- [ ] Load session if exists
- [ ] Restore context manager state
- [ ] Continue conversation

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
openagent --resume abc123 "Continue"
```

---

### Task 9.3.4: Auto-Save Sessions
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Save session after each agent turn
- [ ] Print session ID at start
- [ ] Allow disabling auto-save

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
openagent "Hello"
# Should print session ID
```

---

## Activity 9.4: Testing

**Status**: `pending`

### Task 9.4.1: Test Session Save/Load
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Start conversation
- [ ] Note session ID
- [ ] Resume with --resume
- [ ] Verify context restored

#### Verification:
```bash
openagent "Remember the number 42"
# Note session ID
openagent --resume <id> "What number did I say?"
```

---

### Task 9.4.2: Test Compaction
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create long conversation
- [ ] Trigger compaction
- [ ] Verify older messages summarized
- [ ] Verify agent still has context

#### Verification:
```bash
# Run many messages to trigger compaction
```

---

### Task 9.4.3: Test Session Commands
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Test `session list`
- [ ] Test `session show`
- [ ] Test `session delete`

#### Verification:
```bash
openagent session list
openagent session show <id>
openagent session delete <id>
```

---

## Phase 9 Checklist

- [ ] Session types defined
- [ ] Session manager saves
- [ ] Session manager loads
- [ ] Compactor sliding window works
- [ ] Compactor summarization works
- [ ] Context manager uses compactor
- [ ] CLI session list works
- [ ] CLI session show works
- [ ] CLI --resume works
- [ ] Auto-save works
- [ ] Compaction tested

---

## Next Phase

After completing Phase 9, proceed to [Phase 10: Subagents](./phase-10-subagents.md)

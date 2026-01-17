# Phase 7: Hook System

> **Status**: `pending`
> **Started**: -
> **Completed**: -
> **Tasks**: 15
> **Actions**: 45

## Overview

Implement lifecycle hooks that allow custom scripts to run at various agent events.

## Dependencies

- [ ] Phase 4 complete (working agent)

## Deliverable

Custom scripts can run at lifecycle events and modify agent behavior.

---

## Activity 7.1: Hook Types

**Status**: `pending`

### Task 7.1.1: Define Hook Events
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/hooks/src/types.ts`
- [ ] Define HookEvent union type
- [ ] Include: session_start, user_prompt_submit, pre_tool_use, post_tool_use, stop
- [ ] Define event data types for each

#### Files to Create:
- `packages/hooks/src/types.ts`

#### Verification:
```bash
cd packages/hooks && bunx tsc --noEmit
```

---

### Task 7.1.2: Define Hook Configuration
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Define HookConfig interface
- [ ] Include event, matcher, command, timeout
- [ ] Define matcher patterns (tool name, path)

#### Files to Modify:
- `packages/hooks/src/types.ts`

#### Verification:
```bash
cd packages/hooks && bunx tsc --noEmit
```

---

### Task 7.1.3: Define Hook Result
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Define HookResult interface
- [ ] Include blocked, message, modifiedParams
- [ ] Define result parsing rules

#### Files to Modify:
- `packages/hooks/src/types.ts`

#### Verification:
```bash
cd packages/hooks && bunx tsc --noEmit
```

---

## Activity 7.2: Hook Executor

**Status**: `pending`

### Task 7.2.1: Create Executor Class
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/hooks/src/executor.ts`
- [ ] Create HookExecutor class
- [ ] Accept hooks array in constructor
- [ ] Store hooks indexed by event

#### Files to Create:
- `packages/hooks/src/executor.ts`

#### Verification:
```bash
cd packages/hooks && bunx tsc --noEmit
```

---

### Task 7.2.2: Implement Event Matching
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement getHooksForEvent(event, context)
- [ ] Match event type
- [ ] Match tool name if pre/post_tool_use
- [ ] Match path patterns if applicable

#### Files to Modify:
- `packages/hooks/src/executor.ts`

#### Verification:
```bash
cd packages/hooks && bunx tsc --noEmit
```

---

### Task 7.2.3: Implement Script Execution
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Spawn hook command as child process
- [ ] Pass event data as JSON to stdin
- [ ] Capture stdout as JSON result
- [ ] Handle timeout (default 30s)

#### Files to Modify:
- `packages/hooks/src/executor.ts`

#### Verification:
```bash
cd packages/hooks && bunx tsc --noEmit
```

---

### Task 7.2.4: Implement Result Handling
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Parse JSON output from hook
- [ ] Check for blocked flag
- [ ] Extract modified parameters
- [ ] Handle parse errors gracefully (fail-open)

#### Files to Modify:
- `packages/hooks/src/executor.ts`

#### Verification:
```bash
cd packages/hooks && bunx tsc --noEmit
```

---

### Task 7.2.5: Implement Trigger Method
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create trigger(event, data) method
- [ ] Find matching hooks
- [ ] Execute each hook
- [ ] Combine results
- [ ] Return combined HookResult

#### Files to Modify:
- `packages/hooks/src/executor.ts`

#### Verification:
```bash
cd packages/hooks && bunx tsc --noEmit
```

---

## Activity 7.3: Agent Integration

**Status**: `pending`

### Task 7.3.1: Add Hooks to Agent
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Accept HookExecutor in AgentLoop config
- [ ] Initialize executor in constructor
- [ ] Add session_start trigger on run()

#### Files to Modify:
- `packages/core/src/agent/loop.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 7.3.2: Add Pre-Tool Hook
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Trigger pre_tool_use before each tool call
- [ ] Pass tool name and parameters
- [ ] Check for blocked result
- [ ] Apply modified parameters

#### Files to Modify:
- `packages/core/src/agent/loop.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 7.3.3: Add Post-Tool Hook
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Trigger post_tool_use after each tool call
- [ ] Pass tool name, parameters, result
- [ ] Allow result modification

#### Files to Modify:
- `packages/core/src/agent/loop.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 7.3.4: Add Stop Hook
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Trigger stop when agent loop ends
- [ ] Pass final context summary
- [ ] Allow cleanup actions

#### Files to Modify:
- `packages/core/src/agent/loop.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

## Activity 7.4: Testing

**Status**: `pending`

### Task 7.4.1: Create Test Hook
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create test hook script
- [ ] Log received data
- [ ] Return simple result

#### Verification:
```bash
echo '{"blocked": false}' > /tmp/test-hook.sh
```

---

### Task 7.4.2: Test Blocking Hook
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create hook that blocks Bash tool
- [ ] Run agent with bash command
- [ ] Verify tool is blocked

#### Verification:
```bash
openagent "Run ls command"
# Should be blocked
```

---

### Task 7.4.3: Export Package
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Update `packages/hooks/src/index.ts`
- [ ] Export HookExecutor
- [ ] Export all types

#### Files to Modify:
- `packages/hooks/src/index.ts`

#### Verification:
```bash
cd packages/hooks && bun run build
```

---

## Phase 7 Checklist

- [ ] Hook event types defined
- [ ] Hook config interface defined
- [ ] Hook result interface defined
- [ ] Executor matches events
- [ ] Executor runs scripts
- [ ] Executor handles results
- [ ] Agent triggers session_start
- [ ] Agent triggers pre_tool_use
- [ ] Agent triggers post_tool_use
- [ ] Agent triggers stop
- [ ] Blocking works
- [ ] Package exports complete

---

## Next Phase

After completing Phase 7, proceed to [Phase 8: Permissions](./phase-08-permissions.md)

# Phase 10: Subagent System

> **Status**: `pending`
> **Started**: -
> **Completed**: -
> **Tasks**: 17
> **Actions**: 51

## Overview

Implement subagent spawning for delegating complex tasks to specialized agents.

## Dependencies

- [ ] Phase 4 complete (working agent)

## Deliverable

Agent can spawn subagents with isolated contexts for parallel work.

---

## Activity 10.1: Subagent Types

**Status**: `pending`

### Task 10.1.1: Define Subagent Types
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/core/src/agent/subagent-types.ts`
- [ ] Define SubagentType: Explore, Plan, Bash, General
- [ ] Define tools available for each type
- [ ] Define system prompt additions for each

#### Files to Create:
- `packages/core/src/agent/subagent-types.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 10.1.2: Define Subagent Config
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Define SubagentConfig interface
- [ ] Include type, prompt, maxTurns, model
- [ ] Include run_in_background option

#### Files to Modify:
- `packages/core/src/agent/subagent-types.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 10.1.3: Define Built-in Types
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Define Explore type (Glob, Grep, Read tools)
- [ ] Define Plan type (all tools, planning focus)
- [ ] Define Bash type (Bash tool only)
- [ ] Export type definitions

#### Files to Modify:
- `packages/core/src/agent/subagent-types.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

## Activity 10.2: Subagent Manager

**Status**: `pending`

### Task 10.2.1: Create Manager Class
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/core/src/agent/subagent.ts`
- [ ] Create SubagentManager class
- [ ] Accept parent agent config
- [ ] Track running subagents

#### Files to Create:
- `packages/core/src/agent/subagent.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 10.2.2: Implement Spawn Method
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement spawn(config) method
- [ ] Create new AgentLoop for subagent
- [ ] Configure tools based on type
- [ ] Set isolated context

#### Files to Modify:
- `packages/core/src/agent/subagent.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 10.2.3: Implement Tool Filtering
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Filter tool registry based on subagent type
- [ ] Exclude Task tool to prevent recursion
- [ ] Apply tool restrictions from config

#### Files to Modify:
- `packages/core/src/agent/subagent.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 10.2.4: Implement Run Method
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run subagent with given prompt
- [ ] Enforce maxTurns limit
- [ ] Collect final response
- [ ] Return only final result to parent

#### Files to Modify:
- `packages/core/src/agent/subagent.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 10.2.5: Implement Background Execution
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Support run_in_background option
- [ ] Return immediately with task ID
- [ ] Store subagent for later retrieval
- [ ] Allow polling for result

#### Files to Modify:
- `packages/core/src/agent/subagent.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 10.2.6: Implement Parallel Execution
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Support spawning multiple subagents
- [ ] Run in parallel with Promise.all
- [ ] Collect all results
- [ ] Handle partial failures

#### Files to Modify:
- `packages/core/src/agent/subagent.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

## Activity 10.3: Task Tool

**Status**: `pending`

### Task 10.3.1: Create Task Tool
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create/update `packages/tools/src/builtin/task.ts`
- [ ] Define parameters: subagent_type, prompt, max_turns, model, run_in_background
- [ ] Accept SubagentManager in context

#### Files to Modify:
- `packages/tools/src/builtin/task.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 10.3.2: Implement Execute
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Get SubagentManager from context
- [ ] Build SubagentConfig from parameters
- [ ] Call manager.spawn(config)
- [ ] Return subagent result

#### Files to Modify:
- `packages/tools/src/builtin/task.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 10.3.3: Handle Background Tasks
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Return task ID for background tasks
- [ ] Create TaskOutput tool for checking
- [ ] Store output file path

#### Files to Modify:
- `packages/tools/src/builtin/task.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 10.3.4: Integrate with Agent
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Add SubagentManager to AgentLoop
- [ ] Pass to Task tool context
- [ ] Handle subagent results in main loop

#### Files to Modify:
- `packages/core/src/agent/loop.ts`

#### Verification:
```bash
cd packages/core && bun run build
```

---

## Activity 10.4: Testing

**Status**: `pending`

### Task 10.4.1: Test Explore Subagent
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run: "Explore the codebase for API endpoints"
- [ ] Verify Explore subagent spawned
- [ ] Verify only exploration tools used
- [ ] Verify result returned

#### Verification:
```bash
openagent "Explore the codebase for API endpoints"
```

---

### Task 10.4.2: Test Plan Subagent
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run: "Plan how to add a new feature"
- [ ] Verify Plan subagent spawned
- [ ] Verify plan returned

#### Verification:
```bash
openagent "Plan how to add user authentication"
```

---

### Task 10.4.3: Test Parallel Subagents
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run query requiring multiple explorations
- [ ] Verify multiple subagents spawn
- [ ] Verify parallel execution
- [ ] Verify combined results

#### Verification:
```bash
openagent "Find all error handling patterns and test patterns"
```

---

### Task 10.4.4: Test Background Tasks
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Spawn background task
- [ ] Verify immediate return
- [ ] Check task status later
- [ ] Retrieve result

#### Verification:
```bash
openagent "Start a background exploration of the codebase"
```

---

## Phase 10 Checklist

- [ ] Subagent types defined
- [ ] Built-in types configured
- [ ] SubagentManager spawns agents
- [ ] Tool filtering works
- [ ] Max turns enforced
- [ ] Background execution works
- [ ] Parallel execution works
- [ ] Task tool complete
- [ ] Agent integration complete
- [ ] Explore subagent works
- [ ] Plan subagent works
- [ ] Parallel subagents work

---

## Next Phase

After completing Phase 10, proceed to [Phase 11: Desktop](./phase-11-desktop.md)

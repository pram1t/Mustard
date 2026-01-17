# Phase 8: Permission System

> **Status**: `pending`
> **Started**: -
> **Completed**: -
> **Tasks**: 14
> **Actions**: 42

## Overview

Implement tool permission controls with allow/deny/ask rules.

## Dependencies

- [ ] Phase 4 complete (working agent)

## Deliverable

Tool execution respects permission rules and prompts user when needed.

---

## Activity 8.1: Permission Types

**Status**: `pending`

### Task 8.1.1: Define Permission Rule
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/core/src/permissions/types.ts`
- [ ] Define PermissionRule with tool, pattern, action
- [ ] Define pattern types (path glob, regex)

#### Files to Create:
- `packages/core/src/permissions/types.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 8.1.2: Define Permission Config
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Define PermissionConfig interface
- [ ] Include allow, deny, ask rule arrays
- [ ] Define rule evaluation order

#### Files to Modify:
- `packages/core/src/permissions/types.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 8.1.3: Define Permission Modes
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Define PermissionMode: normal, acceptEdits, bypassPermissions
- [ ] Document mode behaviors
- [ ] Add to config type

#### Files to Modify:
- `packages/core/src/permissions/types.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

## Activity 8.2: Permission Manager

**Status**: `pending`

### Task 8.2.1: Create Manager Class
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/core/src/permissions/manager.ts`
- [ ] Create PermissionManager class
- [ ] Accept config in constructor
- [ ] Initialize rule lists

#### Files to Create:
- `packages/core/src/permissions/manager.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 8.2.2: Implement Rule Matching
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement matchRule(rule, tool, params)
- [ ] Match tool name (exact or wildcard)
- [ ] Match path patterns for file tools
- [ ] Support glob patterns

#### Files to Modify:
- `packages/core/src/permissions/manager.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 8.2.3: Implement Check Method
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement check(tool, params) method
- [ ] Check deny rules first
- [ ] Check allow rules second
- [ ] Return 'ask' if no match
- [ ] Respect permission mode

#### Files to Modify:
- `packages/core/src/permissions/manager.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 8.2.4: Implement User Prompt
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement requestApproval(tool, params)
- [ ] Display tool and parameters
- [ ] Wait for user input (y/n/always)
- [ ] Cache "always" decisions

#### Files to Modify:
- `packages/core/src/permissions/manager.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 8.2.5: Implement Config Loading
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Load global config from ~/.openagent/permissions.json
- [ ] Load project config from .openagent/permissions.json
- [ ] Merge configs (project overrides global)
- [ ] Support environment variable overrides

#### Files to Modify:
- `packages/core/src/permissions/manager.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

## Activity 8.3: CLI Integration

**Status**: `pending`

### Task 8.3.1: Add Permission Flags
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Add --allow <tool> flag (multiple)
- [ ] Add --deny <tool> flag (multiple)
- [ ] Add --mode <mode> flag
- [ ] Apply flags to permission manager

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
openagent --help | grep -i permission
```

---

### Task 8.3.2: Integrate with Agent
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Add PermissionManager to AgentLoop
- [ ] Check permissions before tool execution
- [ ] Handle denied tools gracefully
- [ ] Prompt user for ask decisions

#### Files to Modify:
- `packages/core/src/agent/loop.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 8.3.3: Add Dangerous Flag
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Add --dangerously-skip-permissions flag
- [ ] Require explicit confirmation
- [ ] Log warning when used

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
openagent --help | grep dangerous
```

---

## Activity 8.4: Testing

**Status**: `pending`

### Task 8.4.1: Test Allow Rules
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create config allowing Read tool
- [ ] Run agent with file read
- [ ] Verify no prompt shown

#### Verification:
```bash
openagent --allow Read "Read package.json"
```

---

### Task 8.4.2: Test Deny Rules
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create config denying Bash tool
- [ ] Run agent with bash command
- [ ] Verify tool is denied

#### Verification:
```bash
openagent --deny Bash "Run ls"
```

---

### Task 8.4.3: Test Ask Prompts
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run agent without pre-configured rules
- [ ] Verify user is prompted
- [ ] Test "always" caching

#### Verification:
```bash
openagent "Write to test.txt"
# Should prompt for permission
```

---

## Phase 8 Checklist

- [ ] Permission rule types defined
- [ ] Permission config interface defined
- [ ] Permission modes defined
- [ ] Manager matches rules
- [ ] Manager checks permissions
- [ ] User prompting works
- [ ] Config loading works
- [ ] CLI flags work
- [ ] Agent integration complete
- [ ] Allow rules work
- [ ] Deny rules work
- [ ] Ask prompts work

---

## Next Phase

After completing Phase 8, proceed to [Phase 9: Sessions](./phase-09-sessions.md)

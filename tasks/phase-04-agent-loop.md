# Phase 4: Agent Loop

> **Status**: `pending`
> **Started**: -
> **Completed**: -
> **Tasks**: 23
> **Actions**: 69

## Overview

Create the core agent loop that orchestrates LLM calls, tool execution, and context management. Build the CLI entry point.

## Dependencies

- [ ] Phase 2 complete (LLM layer)
- [ ] Phase 3 complete (Tools)

## Deliverable

Working CLI agent that can chat, use tools, and maintain conversation context.

---

## Activity 4.1: Context Manager

**Status**: `pending`

### Task 4.1.1: Create Context Types
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/core/src/context/types.ts`
- [ ] Define `ContextConfig` with maxTokens, compactionThreshold
- [ ] Define `ContextState` with messages, tokenCount

#### Files to Create:
- `packages/core/src/context/types.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 4.1.2: Create Context Manager Class
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/core/src/context/manager.ts`
- [ ] Create `ContextManager` class
- [ ] Add messages array
- [ ] Add tokenCount tracking
- [ ] Implement constructor with config

#### Files to Create:
- `packages/core/src/context/manager.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 4.1.3: Implement Message Management
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement addMessage(message) method
- [ ] Update token count on add
- [ ] Implement getMessages() method
- [ ] Implement clear() method

#### Files to Modify:
- `packages/core/src/context/manager.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 4.1.4: Implement Token Tracking
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Accept LLM provider for token counting
- [ ] Count tokens when adding messages
- [ ] Implement needsCompaction() check
- [ ] Track system prompt tokens separately

#### Files to Modify:
- `packages/core/src/context/manager.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 4.1.5: Implement Basic Compaction
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement compact() method
- [ ] Keep system message
- [ ] Keep recent N messages
- [ ] Summarize or remove older messages
- [ ] Update token count after compaction

#### Files to Modify:
- `packages/core/src/context/manager.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

## Activity 4.2: Agent Loop Core

**Status**: `pending`

### Task 4.2.1: Create Agent Types
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/core/src/agent/types.ts`
- [ ] Define `AgentConfig` with llm, tools, systemPrompt
- [ ] Define `AgentEvent` union type
- [ ] Define event types: text, tool_call, tool_result, error, done

#### Files to Create:
- `packages/core/src/agent/types.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 4.2.2: Create Agent Loop Class
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/core/src/agent/loop.ts`
- [ ] Create `AgentLoop` class
- [ ] Accept config in constructor
- [ ] Initialize LLM router
- [ ] Initialize tool registry
- [ ] Initialize context manager

#### Files to Create:
- `packages/core/src/agent/loop.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 4.2.3: Implement Run Method
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create async generator `run(userMessage)` method
- [ ] Add user message to context
- [ ] Build messages array for LLM
- [ ] Call LLM with messages and tools
- [ ] Yield text chunks as they arrive

#### Files to Modify:
- `packages/core/src/agent/loop.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 4.2.4: Implement Tool Call Detection
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Collect tool calls from LLM response
- [ ] Parse tool call arguments
- [ ] Yield tool_call events
- [ ] Store tool calls for execution

#### Files to Modify:
- `packages/core/src/agent/loop.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 4.2.5: Implement Tool Execution
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Execute each tool call via registry
- [ ] Handle parallel tool execution
- [ ] Yield tool_result events
- [ ] Add tool results to context

#### Files to Modify:
- `packages/core/src/agent/loop.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 4.2.6: Implement Loop Continuation
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] After tool results, continue loop
- [ ] Call LLM again with updated context
- [ ] Break loop when no more tool calls
- [ ] Check context size, compact if needed
- [ ] Yield done event at end

#### Files to Modify:
- `packages/core/src/agent/loop.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

## Activity 4.3: Tool Execution

**Status**: `pending`

### Task 4.3.1: Create Execution Context
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/core/src/agent/execution.ts`
- [ ] Define `ExecutionContext` implementation
- [ ] Include cwd, env, abortSignal
- [ ] Include permission checker callback

#### Files to Create:
- `packages/core/src/agent/execution.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 4.3.2: Implement Tool Executor
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `executeTools(calls, context)` function
- [ ] Look up each tool in registry
- [ ] Execute with parameters and context
- [ ] Collect results
- [ ] Handle errors gracefully

#### Files to Modify:
- `packages/core/src/agent/execution.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 4.3.3: Implement Parallel Execution
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Use Promise.all for parallel tool calls
- [ ] Respect tool dependencies if any
- [ ] Return results in order of calls
- [ ] Handle partial failures

#### Files to Modify:
- `packages/core/src/agent/execution.ts`

#### Verification:
```bash
cd packages/core && bunx tsc --noEmit
```

---

### Task 4.3.4: Export from Core
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Update `packages/core/src/index.ts`
- [ ] Export AgentLoop
- [ ] Export ContextManager
- [ ] Export all types

#### Files to Modify:
- `packages/core/src/index.ts`

#### Verification:
```bash
cd packages/core && bun run build
```

---

## Activity 4.4: CLI Entry Point

**Status**: `pending`

### Task 4.4.1: Setup CLI Structure
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Update `apps/cli/src/index.ts`
- [ ] Add shebang: #!/usr/bin/env bun
- [ ] Import required packages
- [ ] Set up argument parsing

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
cd apps/cli && bunx tsc --noEmit
```

---

### Task 4.4.2: Implement Argument Parsing
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Parse positional argument as prompt
- [ ] Add --provider flag
- [ ] Add --model flag
- [ ] Add --help flag
- [ ] Add --version flag

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
cd apps/cli && bun run build && ./dist/index.js --help
```

---

### Task 4.4.3: Implement Agent Initialization
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create LLM provider based on flags
- [ ] Read API key from environment
- [ ] Create tool registry
- [ ] Create agent loop
- [ ] Set system prompt

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
cd apps/cli && bunx tsc --noEmit
```

---

### Task 4.4.4: Implement Streaming Output
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Iterate over agent events
- [ ] Print text chunks to stdout immediately
- [ ] Format tool_call events
- [ ] Format tool_result events
- [ ] Handle errors gracefully

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
cd apps/cli && bunx tsc --noEmit
```

---

### Task 4.4.5: Build and Link CLI
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Add bin field to package.json
- [ ] Build CLI: `bun run build`
- [ ] Link globally: `bun link`
- [ ] Test: `openagent --help`

#### Verification:
```bash
bun run build && cd apps/cli && bun link && openagent --help
```

---

## Activity 4.5: Integration Test

**Status**: `pending`

### Task 4.5.1: Test Basic Chat
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run: `openagent "Hello, who are you?"`
- [ ] Verify streaming response
- [ ] Verify response makes sense

#### Verification:
```bash
OPENAI_API_KEY=sk-... openagent "Hello, who are you?"
```

---

### Task 4.5.2: Test File Reading
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run: `openagent "Read the package.json file"`
- [ ] Verify Read tool is called
- [ ] Verify file contents shown
- [ ] Verify agent summarizes contents

#### Verification:
```bash
OPENAI_API_KEY=sk-... openagent "Read the package.json file"
```

---

### Task 4.5.3: Test Multi-Tool Usage
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run: `openagent "Find all .ts files and count them"`
- [ ] Verify Glob tool is called
- [ ] Verify agent counts results
- [ ] Verify sensible response

#### Verification:
```bash
OPENAI_API_KEY=sk-... openagent "Find all .ts files and count them"
```

---

## Phase 4 Checklist

- [ ] Context manager complete
- [ ] Token tracking works
- [ ] Agent loop complete
- [ ] Tool execution works
- [ ] Parallel tools work
- [ ] CLI parses arguments
- [ ] CLI streams output
- [ ] CLI linked globally
- [ ] Basic chat works
- [ ] Tool usage works
- [ ] Multi-tool works

---

## Next Phase

After completing Phase 4, proceed to [Phase 5: LLM Providers](./phase-05-llm-providers.md)

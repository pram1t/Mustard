# Phase 2: LLM Abstraction Layer

> **Status**: `pending`
> **Started**: -
> **Completed**: -
> **Tasks**: 15
> **Actions**: 48

## Overview

Create the LLM abstraction layer with provider interface, OpenAI adapter, and provider router with fallback support.

## Dependencies

- [ ] Phase 1 complete
- [ ] OpenAI API key for testing

## Deliverable

Can send messages to OpenAI and receive streaming responses with tool call support.

---

## Activity 2.1: Define Types

**Status**: `pending`

### Task 2.1.1: Create Message Types
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/llm/src/types.ts`
- [ ] Define `Role` type: 'system' | 'user' | 'assistant' | 'tool'
- [ ] Define `Message` interface with role, content
- [ ] Define `ToolCall` interface with id, name, arguments
- [ ] Define `ToolResult` interface with tool_call_id, content
- [ ] Export all types

#### Files to Create:
- `packages/llm/src/types.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 2.1.2: Create Tool Definition Types
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Define `ToolParameter` interface with JSON Schema properties
- [ ] Define `ToolDefinition` interface with name, description, parameters
- [ ] Add to types.ts

#### Files to Modify:
- `packages/llm/src/types.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 2.1.3: Create Stream Types
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Define `StreamChunk` interface with type, content
- [ ] Define chunk types: 'text', 'tool_call_start', 'tool_call_delta', 'tool_call_end', 'done'
- [ ] Add to types.ts

#### Files to Modify:
- `packages/llm/src/types.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 2.1.4: Create Provider Interface
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Define `ChatParams` interface with messages, tools, stream
- [ ] Define `LLMProvider` interface with:
  - name: string
  - chat(params): AsyncGenerator<StreamChunk>
  - countTokens(messages): number
  - maxContextLength: number
  - supportsTools: boolean
  - supportsVision: boolean
- [ ] Export interface

#### Files to Modify:
- `packages/llm/src/types.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

## Activity 2.2: OpenAI Adapter

**Status**: `pending`

### Task 2.2.1: Install OpenAI SDK
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Navigate to packages/llm
- [ ] Run `bun add openai`
- [ ] Verify in package.json dependencies

#### Verification:
```bash
cat packages/llm/package.json | grep openai
```

---

### Task 2.2.2: Create OpenAI Adapter Structure
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/llm/src/adapters/` directory
- [ ] Create `packages/llm/src/adapters/openai.ts`
- [ ] Import OpenAI SDK
- [ ] Import types
- [ ] Create `OpenAIProvider` class implementing `LLMProvider`

#### Files to Create:
- `packages/llm/src/adapters/openai.ts`

#### Verification:
```bash
ls packages/llm/src/adapters/
```

---

### Task 2.2.3: Implement Constructor and Config
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Add constructor accepting config object
- [ ] Accept apiKey, model, baseUrl options
- [ ] Initialize OpenAI client
- [ ] Set default model to 'gpt-4o'
- [ ] Implement maxContextLength getter

#### Files to Modify:
- `packages/llm/src/adapters/openai.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 2.2.4: Implement Chat Method
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement async generator `chat` method
- [ ] Convert messages to OpenAI format
- [ ] Convert tools to OpenAI function format
- [ ] Call openai.chat.completions.create with stream: true
- [ ] Yield StreamChunk for each delta
- [ ] Handle text content chunks
- [ ] Handle tool_calls chunks

#### Files to Modify:
- `packages/llm/src/adapters/openai.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 2.2.5: Implement Token Counting
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Install tiktoken: `bun add tiktoken`
- [ ] Implement `countTokens` method
- [ ] Use cl100k_base encoding for GPT-4
- [ ] Count tokens for each message
- [ ] Return total count

#### Files to Modify:
- `packages/llm/src/adapters/openai.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

## Activity 2.3: Provider Router

**Status**: `pending`

### Task 2.3.1: Create Router Structure
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/llm/src/router.ts`
- [ ] Define `RouterConfig` interface with providers, primary, fallback
- [ ] Create `LLMRouter` class
- [ ] Implement constructor accepting config

#### Files to Create:
- `packages/llm/src/router.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 2.3.2: Implement Provider Registration
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Add `providers` Map<string, LLMProvider>
- [ ] Implement `register(provider)` method
- [ ] Implement `get(name)` method
- [ ] Implement `setPrimary(name)` method
- [ ] Implement `setFallback(names[])` method

#### Files to Modify:
- `packages/llm/src/router.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 2.3.3: Implement Chat with Fallback
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement async generator `chat` method
- [ ] Try primary provider first
- [ ] On error, try fallback providers in order
- [ ] Yield chunks from successful provider
- [ ] Throw if all providers fail
- [ ] Add retry logic with exponential backoff

#### Files to Modify:
- `packages/llm/src/router.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

## Activity 2.4: Testing

**Status**: `pending`

### Task 2.4.1: Create Test File
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/llm/src/test.ts`
- [ ] Import OpenAIProvider
- [ ] Create test function
- [ ] Set up provider with API key from env

#### Files to Create:
- `packages/llm/src/test.ts`

#### Verification:
```bash
ls packages/llm/src/test.ts
```

---

### Task 2.4.2: Test Basic Chat
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Send simple message "Hello, who are you?"
- [ ] Iterate over stream chunks
- [ ] Print each text chunk
- [ ] Verify complete response received

#### Files to Modify:
- `packages/llm/src/test.ts`

#### Verification:
```bash
OPENAI_API_KEY=sk-... bun packages/llm/src/test.ts
```

---

### Task 2.4.3: Test Tool Calling
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Define a test tool (e.g., get_weather)
- [ ] Send message that should trigger tool call
- [ ] Verify tool_call chunks received
- [ ] Parse tool call arguments
- [ ] Print tool call details

#### Files to Modify:
- `packages/llm/src/test.ts`

#### Verification:
```bash
OPENAI_API_KEY=sk-... bun packages/llm/src/test.ts
```

---

## Activity 2.5: Export and Build

**Status**: `pending`

### Task 2.5.1: Update Package Exports
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Update `packages/llm/src/index.ts`
- [ ] Export all types from types.ts
- [ ] Export OpenAIProvider
- [ ] Export LLMRouter
- [ ] Export type interfaces

#### Files to Modify:
- `packages/llm/src/index.ts`

#### Verification:
```bash
cd packages/llm && bun run build
```

---

### Task 2.5.2: Verify Build
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run `bun run build` from root
- [ ] Verify packages/llm/dist created
- [ ] Verify type declarations generated
- [ ] Test import from another package

#### Verification:
```bash
bun run build && ls packages/llm/dist
```

---

## Phase 2 Checklist

- [ ] All LLM types defined
- [ ] OpenAI SDK installed
- [ ] OpenAIProvider class complete
- [ ] Streaming works
- [ ] Tool calls parsed correctly
- [ ] Token counting works
- [ ] Router with fallback works
- [ ] All exports in index.ts
- [ ] Package builds successfully

---

## Next Phase

After completing Phase 2, proceed to [Phase 3: Tools](./phase-03-tools.md)

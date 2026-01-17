# Phase 5: Additional LLM Providers

> **Status**: `pending`
> **Started**: -
> **Completed**: -
> **Tasks**: 20
> **Actions**: 60

## Overview

Add support for Anthropic (Claude), Google (Gemini), Ollama (local LLMs), and any OpenAI-compatible API.

## Dependencies

- [ ] Phase 4 complete (working agent)
- [ ] API keys for testing each provider

## Deliverable

Agent works with any major LLM provider via --provider flag.

---

## Activity 5.1: Anthropic Adapter

**Status**: `pending`

### Task 5.1.1: Install Anthropic SDK
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run `bun add @anthropic-ai/sdk` in packages/llm
- [ ] Verify installation

#### Verification:
```bash
cat packages/llm/package.json | grep anthropic
```

---

### Task 5.1.2: Create Anthropic Adapter
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/llm/src/adapters/anthropic.ts`
- [ ] Implement LLMProvider interface
- [ ] Handle Anthropic message format differences
- [ ] Set default model to 'claude-sonnet-4-20250514'

#### Files to Create:
- `packages/llm/src/adapters/anthropic.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 5.1.3: Implement Streaming
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Use Anthropic stream API
- [ ] Convert stream events to StreamChunk format
- [ ] Handle content_block_delta events
- [ ] Handle tool_use blocks

#### Files to Modify:
- `packages/llm/src/adapters/anthropic.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 5.1.4: Handle Tool Calls
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Convert tools to Anthropic format
- [ ] Parse tool_use content blocks
- [ ] Map tool_use_id for results
- [ ] Handle tool_result messages

#### Files to Modify:
- `packages/llm/src/adapters/anthropic.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

## Activity 5.2: Gemini Adapter

**Status**: `pending`

### Task 5.2.1: Install Gemini SDK
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run `bun add @google/generative-ai` in packages/llm
- [ ] Verify installation

#### Verification:
```bash
cat packages/llm/package.json | grep generative-ai
```

---

### Task 5.2.2: Create Gemini Adapter
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/llm/src/adapters/gemini.ts`
- [ ] Implement LLMProvider interface
- [ ] Handle Gemini content format
- [ ] Set default model to 'gemini-pro'

#### Files to Create:
- `packages/llm/src/adapters/gemini.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 5.2.3: Implement Streaming
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Use generateContentStream
- [ ] Convert chunks to StreamChunk format
- [ ] Handle text parts

#### Files to Modify:
- `packages/llm/src/adapters/gemini.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 5.2.4: Handle Function Calling
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Convert tools to functionDeclarations
- [ ] Parse functionCall responses
- [ ] Map function results back

#### Files to Modify:
- `packages/llm/src/adapters/gemini.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

## Activity 5.3: Ollama Adapter

**Status**: `pending`

### Task 5.3.1: Create Ollama Adapter
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/llm/src/adapters/ollama.ts`
- [ ] Implement LLMProvider interface
- [ ] Use fetch for HTTP API
- [ ] Default URL: http://localhost:11434

#### Files to Create:
- `packages/llm/src/adapters/ollama.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 5.3.2: Implement Chat Endpoint
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Call POST /api/chat
- [ ] Convert messages to Ollama format
- [ ] Handle streaming response (NDJSON)
- [ ] Parse each line as JSON

#### Files to Modify:
- `packages/llm/src/adapters/ollama.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 5.3.3: Handle Tool Calling
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Convert tools to Ollama format
- [ ] Parse tool_calls from response
- [ ] Format tool results for follow-up

#### Files to Modify:
- `packages/llm/src/adapters/ollama.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 5.3.4: Add Model Listing
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement listModels() method
- [ ] Call GET /api/tags
- [ ] Return available models

#### Files to Modify:
- `packages/llm/src/adapters/ollama.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 5.3.5: Handle Connection Errors
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Detect if Ollama is not running
- [ ] Provide helpful error message
- [ ] Suggest starting Ollama

#### Files to Modify:
- `packages/llm/src/adapters/ollama.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

## Activity 5.4: OpenAI-Compatible Adapter

**Status**: `pending`

### Task 5.4.1: Create Compatible Adapter
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/llm/src/adapters/openai-compatible.ts`
- [ ] Extend or wrap OpenAI adapter
- [ ] Accept custom baseUrl parameter
- [ ] Make apiKey optional

#### Files to Create:
- `packages/llm/src/adapters/openai-compatible.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 5.4.2: Handle API Differences
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Allow missing features (tools, streaming)
- [ ] Graceful fallback for unsupported features
- [ ] Handle different response formats

#### Files to Modify:
- `packages/llm/src/adapters/openai-compatible.ts`

#### Verification:
```bash
cd packages/llm && bunx tsc --noEmit
```

---

### Task 5.4.3: Export Adapter
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Export from adapters index
- [ ] Add to provider router options

#### Files to Modify:
- `packages/llm/src/index.ts`

#### Verification:
```bash
cd packages/llm && bun run build
```

---

## Activity 5.5: Provider Tests

**Status**: `pending`

### Task 5.5.1: Update CLI Provider Flag
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Support --provider anthropic
- [ ] Support --provider gemini
- [ ] Support --provider ollama
- [ ] Support --provider openai-compatible with --base-url

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
openagent --help
```

---

### Task 5.5.2: Test Anthropic
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run with ANTHROPIC_API_KEY
- [ ] Verify streaming works
- [ ] Verify tool calls work

#### Verification:
```bash
ANTHROPIC_API_KEY=sk-... openagent --provider anthropic "Hello"
```

---

### Task 5.5.3: Test Gemini
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run with GOOGLE_API_KEY
- [ ] Verify streaming works
- [ ] Verify function calls work

#### Verification:
```bash
GOOGLE_API_KEY=... openagent --provider gemini "Hello"
```

---

### Task 5.5.4: Test Ollama
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Start Ollama locally
- [ ] Run with --provider ollama
- [ ] Verify streaming works
- [ ] Test with different models

#### Verification:
```bash
openagent --provider ollama --model qwen2.5-coder:7b "Hello"
```

---

## Phase 5 Checklist

- [ ] Anthropic SDK installed
- [ ] Anthropic adapter complete
- [ ] Gemini SDK installed
- [ ] Gemini adapter complete
- [ ] Ollama adapter complete
- [ ] OpenAI-compatible adapter complete
- [ ] CLI supports all providers
- [ ] All providers tested

---

## Next Phase

After completing Phase 5, proceed to [Phase 6: MCP](./phase-06-mcp.md)

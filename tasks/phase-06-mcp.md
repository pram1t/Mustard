# Phase 6: MCP Client

> **Status**: `pending`
> **Started**: -
> **Completed**: -
> **Tasks**: 25
> **Actions**: 75

## Overview

Implement Model Context Protocol client for connecting to external tool servers.

## Dependencies

- [ ] Phase 4 complete (working agent)

## Deliverable

Agent can connect to MCP servers and use their tools.

---

## Activity 6.1: MCP Types

**Status**: `pending`

### Task 6.1.1: Create Protocol Types
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/mcp/src/types.ts`
- [ ] Define JSON-RPC 2.0 types (Request, Response, Error)
- [ ] Define MCP message types
- [ ] Define capability types

#### Files to Create:
- `packages/mcp/src/types.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.1.2: Define Tool Types
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Define MCPTool interface
- [ ] Define MCPToolResult interface
- [ ] Define tool list response type

#### Files to Modify:
- `packages/mcp/src/types.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.1.3: Define Resource Types
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Define MCPResource interface
- [ ] Define MCPResourceContent interface
- [ ] Define resource list response type

#### Files to Modify:
- `packages/mcp/src/types.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

## Activity 6.2: STDIO Transport

**Status**: `pending`

### Task 6.2.1: Create Transport Interface
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/mcp/src/transport/types.ts`
- [ ] Define Transport interface with send, receive, close
- [ ] Define connection state types

#### Files to Create:
- `packages/mcp/src/transport/types.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.2.2: Create STDIO Transport
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/mcp/src/transport/stdio.ts`
- [ ] Spawn child process with command
- [ ] Set up stdin/stdout communication
- [ ] Implement Transport interface

#### Files to Create:
- `packages/mcp/src/transport/stdio.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.2.3: Implement Message Sending
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Serialize JSON-RPC message
- [ ] Write to process stdin
- [ ] Add newline delimiter
- [ ] Track pending requests by ID

#### Files to Modify:
- `packages/mcp/src/transport/stdio.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.2.4: Implement Message Receiving
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Read from process stdout
- [ ] Buffer partial messages
- [ ] Parse complete JSON-RPC messages
- [ ] Route responses to pending requests

#### Files to Modify:
- `packages/mcp/src/transport/stdio.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.2.5: Handle Process Lifecycle
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Handle process spawn errors
- [ ] Handle process exit
- [ ] Implement close() to kill process
- [ ] Handle stderr for debugging

#### Files to Modify:
- `packages/mcp/src/transport/stdio.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

## Activity 6.3: HTTP Transport

**Status**: `pending`

### Task 6.3.1: Create HTTP Transport
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/mcp/src/transport/http.ts`
- [ ] Implement Transport interface
- [ ] Accept baseUrl configuration
- [ ] Handle authentication headers

#### Files to Create:
- `packages/mcp/src/transport/http.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.3.2: Implement Request/Response
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Use fetch for HTTP requests
- [ ] POST JSON-RPC to endpoint
- [ ] Parse JSON-RPC response
- [ ] Handle HTTP errors

#### Files to Modify:
- `packages/mcp/src/transport/http.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.3.3: Implement SSE Streaming
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Connect to SSE endpoint for notifications
- [ ] Parse SSE events
- [ ] Route notifications to handlers
- [ ] Handle reconnection

#### Files to Modify:
- `packages/mcp/src/transport/http.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.3.4: Export Transports
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/mcp/src/transport/index.ts`
- [ ] Export all transports
- [ ] Export Transport interface

#### Files to Create:
- `packages/mcp/src/transport/index.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

## Activity 6.4: MCP Client

**Status**: `pending`

### Task 6.4.1: Create Client Class
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/mcp/src/client.ts`
- [ ] Create MCPClient class
- [ ] Accept transport in constructor
- [ ] Track server capabilities

#### Files to Create:
- `packages/mcp/src/client.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.4.2: Implement Initialize
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Send initialize request
- [ ] Receive server capabilities
- [ ] Send initialized notification
- [ ] Store capabilities

#### Files to Modify:
- `packages/mcp/src/client.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.4.3: Implement Tool Methods
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement listTools()
- [ ] Implement callTool(name, args)
- [ ] Handle tool errors
- [ ] Cache tool list

#### Files to Modify:
- `packages/mcp/src/client.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.4.4: Implement Resource Methods
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement listResources()
- [ ] Implement readResource(uri)
- [ ] Handle resource errors

#### Files to Modify:
- `packages/mcp/src/client.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.4.5: Handle Errors
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Parse JSON-RPC error responses
- [ ] Create typed error classes
- [ ] Handle timeout errors
- [ ] Handle connection errors

#### Files to Modify:
- `packages/mcp/src/client.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

## Activity 6.5: MCP Registry

**Status**: `pending`

### Task 6.5.1: Create Registry Class
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/mcp/src/registry.ts`
- [ ] Create MCPRegistry class
- [ ] Store servers Map<string, MCPClient>
- [ ] Track server configs

#### Files to Create:
- `packages/mcp/src/registry.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.5.2: Implement Server Management
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement addServer(name, config)
- [ ] Implement removeServer(name)
- [ ] Implement getServer(name)
- [ ] Handle connection/disconnection

#### Files to Modify:
- `packages/mcp/src/registry.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.5.3: Implement Tool Aggregation
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement getAllTools()
- [ ] Prefix tool names with server name
- [ ] Handle name conflicts
- [ ] Implement callTool routing

#### Files to Modify:
- `packages/mcp/src/registry.ts`

#### Verification:
```bash
cd packages/mcp && bunx tsc --noEmit
```

---

### Task 6.5.4: Export Package
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Update `packages/mcp/src/index.ts`
- [ ] Export MCPClient
- [ ] Export MCPRegistry
- [ ] Export all types and transports

#### Files to Modify:
- `packages/mcp/src/index.ts`

#### Verification:
```bash
cd packages/mcp && bun run build
```

---

## Activity 6.6: CLI Commands

**Status**: `pending`

### Task 6.6.1: Add MCP Subcommand
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Add `mcp` subcommand to CLI
- [ ] Support `mcp add`, `mcp remove`, `mcp list`
- [ ] Parse server configuration options

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
openagent mcp --help
```

---

### Task 6.6.2: Implement MCP Add
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Parse server name and type
- [ ] Accept --command for stdio
- [ ] Accept --url for http
- [ ] Save to config file

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
openagent mcp add --help
```

---

### Task 6.6.3: Implement MCP List
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Read configured servers
- [ ] Show server name, type, status
- [ ] Option to show tools per server

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
openagent mcp list
```

---

### Task 6.6.4: Integrate with Agent
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Load MCP servers on agent start
- [ ] Add MCP tools to tool registry
- [ ] Route MCP tool calls correctly

#### Files to Modify:
- `apps/cli/src/index.ts`

#### Verification:
```bash
openagent mcp add test --type stdio --command "echo test"
openagent "Use the test tool"
```

---

## Phase 6 Checklist

- [ ] MCP types defined
- [ ] STDIO transport complete
- [ ] HTTP transport complete
- [ ] MCP client complete
- [ ] Initialize handshake works
- [ ] Tool listing works
- [ ] Tool calling works
- [ ] Registry aggregates tools
- [ ] CLI commands work
- [ ] Agent uses MCP tools

---

## Next Phase

After completing Phase 6, proceed to [Phase 7: Hooks](./phase-07-hooks.md)

# Phase 3: Core Tool System

> **Status**: `pending`
> **Started**: -
> **Completed**: -
> **Tasks**: 29
> **Actions**: 87

## Overview

Implement all built-in tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, AskUser, and the tool registry.

## Dependencies

- [ ] Phase 1 complete
- [ ] Phase 2 complete

## Deliverable

All tools can be executed independently with correct results.

---

## Activity 3.1: Tool Interface

**Status**: `pending`

### Task 3.1.1: Create Tool Types
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/tools/src/types.ts`
- [ ] Define `ToolParameter` with JSON Schema structure
- [ ] Define `Tool` interface with name, description, parameters, execute
- [ ] Define `ToolResult` with success, output, error
- [ ] Define `ExecutionContext` with cwd, env, permissions

#### Files to Create:
- `packages/tools/src/types.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.1.2: Create Base Tool Class
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/tools/src/base.ts`
- [ ] Create abstract `BaseTool` class
- [ ] Implement common validation logic
- [ ] Implement parameter parsing helper
- [ ] Add error handling wrapper

#### Files to Create:
- `packages/tools/src/base.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.1.3: Create Builtin Directory
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/tools/src/builtin/` directory
- [ ] Create `packages/tools/src/builtin/index.ts` for exports

#### Files to Create:
- `packages/tools/src/builtin/index.ts`

#### Verification:
```bash
ls packages/tools/src/builtin/
```

---

## Activity 3.2: Read Tool

**Status**: `pending`

### Task 3.2.1: Create Read Tool Structure
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/tools/src/builtin/read.ts`
- [ ] Import BaseTool and types
- [ ] Create `ReadTool` class extending BaseTool
- [ ] Define parameters: file_path (required), offset, limit

#### Files to Create:
- `packages/tools/src/builtin/read.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.2.2: Implement Read Logic
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Use fs.readFile to read file contents
- [ ] Handle offset parameter (skip lines)
- [ ] Handle limit parameter (max lines)
- [ ] Add line numbers to output (cat -n style)
- [ ] Truncate long lines (>2000 chars)

#### Files to Modify:
- `packages/tools/src/builtin/read.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.2.3: Handle Binary and Special Files
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Detect binary files
- [ ] Return appropriate message for binary
- [ ] Handle image files (note: would need vision)
- [ ] Handle PDF files (extract text)
- [ ] Handle missing files gracefully

#### Files to Modify:
- `packages/tools/src/builtin/read.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.2.4: Export Read Tool
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Export ReadTool from builtin/index.ts
- [ ] Add to default tool list

#### Files to Modify:
- `packages/tools/src/builtin/index.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

## Activity 3.3: Write Tool

**Status**: `pending`

### Task 3.3.1: Create Write Tool
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/tools/src/builtin/write.ts`
- [ ] Define parameters: file_path (required), content (required)
- [ ] Implement execute method

#### Files to Create:
- `packages/tools/src/builtin/write.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.3.2: Implement Write Logic
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create parent directories if needed (mkdir -p)
- [ ] Write content to file using fs.writeFile
- [ ] Return success message with file path
- [ ] Handle write errors gracefully

#### Files to Modify:
- `packages/tools/src/builtin/write.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.3.3: Export Write Tool
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Export WriteTool from builtin/index.ts

#### Files to Modify:
- `packages/tools/src/builtin/index.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

## Activity 3.4: Edit Tool

**Status**: `pending`

### Task 3.4.1: Create Edit Tool
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/tools/src/builtin/edit.ts`
- [ ] Define parameters: file_path, old_string, new_string, replace_all
- [ ] Implement execute method

#### Files to Create:
- `packages/tools/src/builtin/edit.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.4.2: Implement String Replacement
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Read existing file content
- [ ] Find old_string in content
- [ ] Verify old_string is unique (if not replace_all)
- [ ] Replace old_string with new_string
- [ ] Write updated content back

#### Files to Modify:
- `packages/tools/src/builtin/edit.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.4.3: Handle Edge Cases
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Error if old_string not found
- [ ] Error if old_string not unique (without replace_all)
- [ ] Handle empty new_string (deletion)
- [ ] Preserve file encoding

#### Files to Modify:
- `packages/tools/src/builtin/edit.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.4.4: Export Edit Tool
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Export EditTool from builtin/index.ts

#### Files to Modify:
- `packages/tools/src/builtin/index.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

## Activity 3.5: Bash Tool

**Status**: `pending`

### Task 3.5.1: Create Bash Tool
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/tools/src/builtin/bash.ts`
- [ ] Define parameters: command (required), timeout, cwd
- [ ] Implement execute method

#### Files to Create:
- `packages/tools/src/builtin/bash.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.5.2: Implement Command Execution
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Use child_process.spawn for execution
- [ ] Set working directory from context or param
- [ ] Capture stdout and stderr
- [ ] Handle timeout (default 2 minutes)
- [ ] Return combined output

#### Files to Modify:
- `packages/tools/src/builtin/bash.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.5.3: Handle Output Limits
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Truncate output if > 30000 chars
- [ ] Add truncation message
- [ ] Return exit code
- [ ] Handle process errors

#### Files to Modify:
- `packages/tools/src/builtin/bash.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.5.4: Add Background Execution
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Add run_in_background parameter
- [ ] Return task ID for background execution
- [ ] Store background process reference
- [ ] Allow checking status later

#### Files to Modify:
- `packages/tools/src/builtin/bash.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.5.5: Export Bash Tool
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Export BashTool from builtin/index.ts

#### Files to Modify:
- `packages/tools/src/builtin/index.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

## Activity 3.6: Glob Tool

**Status**: `pending`

### Task 3.6.1: Create Glob Tool
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Install glob package: `bun add glob`
- [ ] Create `packages/tools/src/builtin/glob.ts`
- [ ] Define parameters: pattern (required), path (optional)

#### Files to Create:
- `packages/tools/src/builtin/glob.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.6.2: Implement Glob Logic
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Use glob package to find matching files
- [ ] Support patterns like "**/*.ts"
- [ ] Sort results by modification time
- [ ] Return list of matching paths

#### Files to Modify:
- `packages/tools/src/builtin/glob.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.6.3: Export Glob Tool
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Export GlobTool from builtin/index.ts

#### Files to Modify:
- `packages/tools/src/builtin/index.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

## Activity 3.7: Grep Tool

**Status**: `pending`

### Task 3.7.1: Create Grep Tool
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/tools/src/builtin/grep.ts`
- [ ] Define parameters: pattern, path, glob, output_mode, context lines
- [ ] Implement execute method

#### Files to Create:
- `packages/tools/src/builtin/grep.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.7.2: Implement Search Logic
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Find files matching glob pattern
- [ ] Search each file for regex pattern
- [ ] Support case-insensitive search (-i)
- [ ] Support context lines (-A, -B, -C)
- [ ] Return matches with file and line info

#### Files to Modify:
- `packages/tools/src/builtin/grep.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.7.3: Implement Output Modes
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement 'content' mode (show matching lines)
- [ ] Implement 'files_with_matches' mode (just file names)
- [ ] Implement 'count' mode (match counts)
- [ ] Apply head_limit and offset

#### Files to Modify:
- `packages/tools/src/builtin/grep.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.7.4: Export Grep Tool
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Export GrepTool from builtin/index.ts

#### Files to Modify:
- `packages/tools/src/builtin/index.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

## Activity 3.8: Tool Registry

**Status**: `pending`

### Task 3.8.1: Create Registry
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/tools/src/registry.ts`
- [ ] Create `ToolRegistry` class
- [ ] Implement register(tool) method
- [ ] Implement get(name) method
- [ ] Implement getAll() method

#### Files to Create:
- `packages/tools/src/registry.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.8.2: Create Default Registry
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `createDefaultRegistry()` function
- [ ] Register all built-in tools
- [ ] Return configured registry

#### Files to Modify:
- `packages/tools/src/registry.ts`

#### Verification:
```bash
cd packages/tools && bunx tsc --noEmit
```

---

### Task 3.8.3: Export Package
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Update `packages/tools/src/index.ts`
- [ ] Export all types
- [ ] Export all tools
- [ ] Export registry
- [ ] Export createDefaultRegistry

#### Files to Modify:
- `packages/tools/src/index.ts`

#### Verification:
```bash
cd packages/tools && bun run build
```

---

## Phase 3 Checklist

- [ ] Tool interface defined
- [ ] BaseTool class created
- [ ] Read tool complete
- [ ] Write tool complete
- [ ] Edit tool complete
- [ ] Bash tool complete
- [ ] Glob tool complete
- [ ] Grep tool complete
- [ ] Registry complete
- [ ] All exports in index.ts
- [ ] Package builds successfully

---

## Next Phase

After completing Phase 3, proceed to [Phase 4: Agent Loop](./phase-04-agent-loop.md)

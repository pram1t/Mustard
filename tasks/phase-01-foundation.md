# Phase 1: Foundation

> **Status**: `pending`
> **Started**: -
> **Completed**: -
> **Tasks**: 17
> **Actions**: 52

## Overview

Set up the monorepo structure with Turborepo, configure workspaces, TypeScript, and create empty package stubs for all modules.

## Dependencies

- [x] Node.js 18+ or Bun 1.0+ installed
- [x] Git installed
- [ ] Project directory chosen

## Deliverable

Empty but fully buildable project structure that runs `bun install` and `bun run build` without errors.

---

## Activity 1.1: Initialize Monorepo

**Status**: `pending`

### Task 1.1.1: Create Project Root
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create directory `E:\you\openagent` if not exists
- [ ] Navigate to directory
- [ ] Run `bun init -y` to create package.json
- [ ] Verify package.json exists

#### Verification:
```bash
cd E:\you\openagent && cat package.json
```

---

### Task 1.1.2: Install Turborepo
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run `bun add -D turbo`
- [ ] Verify turbo is in devDependencies

#### Verification:
```bash
cat package.json | grep turbo
```

---

### Task 1.1.3: Create Directory Structure
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `apps/` directory
- [ ] Create `apps/cli/` directory
- [ ] Create `apps/desktop/` directory
- [ ] Create `packages/` directory
- [ ] Create `packages/core/` directory
- [ ] Create `packages/llm/` directory
- [ ] Create `packages/tools/` directory
- [ ] Create `packages/mcp/` directory
- [ ] Create `packages/hooks/` directory
- [ ] Create `mcp-servers/` directory

#### Verification:
```bash
ls -la apps/ packages/ mcp-servers/
```

---

### Task 1.1.4: Initialize Git Repository
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run `git init`
- [ ] Create `.gitignore` with node_modules, dist, .env
- [ ] Make initial commit

#### Files to Create:
- `.gitignore`

#### Verification:
```bash
git status
```

---

## Activity 1.2: Configure Workspaces

**Status**: `pending`

### Task 1.2.1: Update Root package.json
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Add `"private": true` to package.json
- [ ] Add workspaces array: `["apps/*", "packages/*", "mcp-servers/*"]`
- [ ] Add scripts: build, dev, test, lint
- [ ] Set name to "openagent"

#### Files to Modify:
- `package.json`

#### Verification:
```bash
cat package.json | grep workspaces
```

---

### Task 1.2.2: Create turbo.json
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `turbo.json` file
- [ ] Add $schema reference
- [ ] Configure build pipeline with dependsOn: ["^build"]
- [ ] Configure dev pipeline with cache: false
- [ ] Configure test pipeline

#### Files to Create:
- `turbo.json`

#### Verification:
```bash
cat turbo.json
```

---

### Task 1.2.3: Create .npmrc
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `.npmrc` file
- [ ] Add `node-linker=hoisted` for bun compatibility

#### Files to Create:
- `.npmrc`

#### Verification:
```bash
cat .npmrc
```

---

## Activity 1.3: Setup TypeScript

**Status**: `pending`

### Task 1.3.1: Install TypeScript
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run `bun add -D typescript @types/node`
- [ ] Verify installation

#### Verification:
```bash
bunx tsc --version
```

---

### Task 1.3.2: Create Base tsconfig.json
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `tsconfig.json` at root
- [ ] Set target: "ES2022"
- [ ] Set module: "ESNext"
- [ ] Set moduleResolution: "bundler"
- [ ] Enable strict mode
- [ ] Set outDir and rootDir patterns
- [ ] Enable declaration and declarationMap

#### Files to Create:
- `tsconfig.json`

#### Verification:
```bash
bunx tsc --showConfig
```

---

## Activity 1.4: Create Package Stubs

**Status**: `pending`

### Task 1.4.1: Create @openagent/core Package
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/core/package.json`
- [ ] Create `packages/core/tsconfig.json` extending root
- [ ] Create `packages/core/src/index.ts` with placeholder export
- [ ] Add build script

#### Files to Create:
- `packages/core/package.json`
- `packages/core/tsconfig.json`
- `packages/core/src/index.ts`

#### Verification:
```bash
cd packages/core && bun run build
```

---

### Task 1.4.2: Create @openagent/llm Package
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/llm/package.json`
- [ ] Create `packages/llm/tsconfig.json` extending root
- [ ] Create `packages/llm/src/index.ts` with placeholder export
- [ ] Add build script

#### Files to Create:
- `packages/llm/package.json`
- `packages/llm/tsconfig.json`
- `packages/llm/src/index.ts`

#### Verification:
```bash
cd packages/llm && bun run build
```

---

### Task 1.4.3: Create @openagent/tools Package
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/tools/package.json`
- [ ] Create `packages/tools/tsconfig.json` extending root
- [ ] Create `packages/tools/src/index.ts` with placeholder export
- [ ] Add build script

#### Files to Create:
- `packages/tools/package.json`
- `packages/tools/tsconfig.json`
- `packages/tools/src/index.ts`

#### Verification:
```bash
cd packages/tools && bun run build
```

---

### Task 1.4.4: Create @openagent/mcp Package
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/mcp/package.json`
- [ ] Create `packages/mcp/tsconfig.json` extending root
- [ ] Create `packages/mcp/src/index.ts` with placeholder export
- [ ] Add build script

#### Files to Create:
- `packages/mcp/package.json`
- `packages/mcp/tsconfig.json`
- `packages/mcp/src/index.ts`

#### Verification:
```bash
cd packages/mcp && bun run build
```

---

### Task 1.4.5: Create @openagent/hooks Package
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `packages/hooks/package.json`
- [ ] Create `packages/hooks/tsconfig.json` extending root
- [ ] Create `packages/hooks/src/index.ts` with placeholder export
- [ ] Add build script

#### Files to Create:
- `packages/hooks/package.json`
- `packages/hooks/tsconfig.json`
- `packages/hooks/src/index.ts`

#### Verification:
```bash
cd packages/hooks && bun run build
```

---

### Task 1.4.6: Create CLI App Stub
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create `apps/cli/package.json` with bin entry
- [ ] Create `apps/cli/tsconfig.json` extending root
- [ ] Create `apps/cli/src/index.ts` with shebang and placeholder
- [ ] Add build script

#### Files to Create:
- `apps/cli/package.json`
- `apps/cli/tsconfig.json`
- `apps/cli/src/index.ts`

#### Verification:
```bash
cd apps/cli && bun run build
```

---

## Activity 1.5: Verify Build

**Status**: `pending`

### Task 1.5.1: Install All Dependencies
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run `bun install` from root
- [ ] Verify no errors
- [ ] Check node_modules created

#### Verification:
```bash
bun install && ls node_modules
```

---

### Task 1.5.2: Run Full Build
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run `bun run build` from root
- [ ] Verify all packages build successfully
- [ ] Check dist folders created in each package

#### Verification:
```bash
bun run build && ls packages/*/dist
```

---

## Phase 1 Checklist

- [ ] Project root initialized with bun
- [ ] Turborepo installed and configured
- [ ] All directories created
- [ ] Git repository initialized
- [ ] Workspaces configured in package.json
- [ ] turbo.json created with pipelines
- [ ] TypeScript installed and configured
- [ ] All 5 packages have stubs
- [ ] CLI app has stub
- [ ] `bun install` runs without errors
- [ ] `bun run build` runs without errors

---

## Next Phase

After completing Phase 1, proceed to [Phase 2: LLM Layer](./phase-02-llm-layer.md)

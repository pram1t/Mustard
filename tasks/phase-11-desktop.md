# Phase 11: Desktop Application

> **Status**: `pending`
> **Started**: -
> **Completed**: -
> **Tasks**: 28
> **Actions**: 84

## Overview

Create Electron desktop application with React UI for chat interface.

## Dependencies

- [ ] Phase 4 complete (working CLI agent)
- [ ] Node.js 18+

## Deliverable

Desktop application with chat interface, settings, and MCP management.

---

## Activity 11.1: Electron Setup

**Status**: `pending`

### Task 11.1.1: Initialize Desktop App
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Navigate to apps/desktop
- [ ] Initialize package.json
- [ ] Add electron and electron-builder
- [ ] Add React and related deps

#### Verification:
```bash
cd apps/desktop && cat package.json
```

---

### Task 11.1.2: Create Directory Structure
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create src/main/ for main process
- [ ] Create src/renderer/ for React app
- [ ] Create src/preload/ for preload scripts
- [ ] Create src/shared/ for shared types

#### Verification:
```bash
ls -la apps/desktop/src/
```

---

### Task 11.1.3: Configure TypeScript
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create tsconfig.json for main process
- [ ] Create tsconfig.json for renderer
- [ ] Configure paths and aliases

#### Files to Create:
- `apps/desktop/tsconfig.json`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.1.4: Configure Vite
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Install vite and @vitejs/plugin-react
- [ ] Create vite.config.ts for renderer
- [ ] Configure build output

#### Files to Create:
- `apps/desktop/vite.config.ts`

#### Verification:
```bash
cd apps/desktop && bunx vite build --help
```

---

### Task 11.1.5: Create Entry Files
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create src/main/index.ts
- [ ] Create src/renderer/index.html
- [ ] Create src/renderer/main.tsx
- [ ] Create src/preload/index.ts

#### Files to Create:
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/renderer/index.html`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/preload/index.ts`

#### Verification:
```bash
ls apps/desktop/src/*/
```

---

## Activity 11.2: Main Process

**Status**: `pending`

### Task 11.2.1: Create Window Manager
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create src/main/window.ts
- [ ] Create BrowserWindow with settings
- [ ] Load renderer HTML
- [ ] Configure window size and position

#### Files to Create:
- `apps/desktop/src/main/window.ts`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.2.2: Create App Lifecycle
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Handle app.ready event
- [ ] Handle window-all-closed event
- [ ] Handle activate event (macOS)
- [ ] Set up app menu

#### Files to Modify:
- `apps/desktop/src/main/index.ts`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.2.3: Create System Tray
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create src/main/tray.ts
- [ ] Create tray icon
- [ ] Add context menu
- [ ] Handle tray clicks

#### Files to Create:
- `apps/desktop/src/main/tray.ts`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.2.4: Create Agent Bridge
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create src/main/agent.ts
- [ ] Import @openagent/core
- [ ] Create AgentBridge class
- [ ] Initialize agent with config

#### Files to Create:
- `apps/desktop/src/main/agent.ts`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.2.5: Implement Agent Methods
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement chat(message) method
- [ ] Stream events to renderer
- [ ] Handle tool calls
- [ ] Handle errors

#### Files to Modify:
- `apps/desktop/src/main/agent.ts`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.2.6: Add Configuration Methods
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Implement getConfig()
- [ ] Implement setConfig(config)
- [ ] Implement getProviders()
- [ ] Load/save from file

#### Files to Modify:
- `apps/desktop/src/main/agent.ts`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

## Activity 11.3: IPC Bridge

**Status**: `pending`

### Task 11.3.1: Define IPC Channels
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create src/shared/ipc.ts
- [ ] Define channel names as constants
- [ ] Define request/response types
- [ ] Export for both processes

#### Files to Create:
- `apps/desktop/src/shared/ipc.ts`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.3.2: Create Preload Script
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Use contextBridge to expose API
- [ ] Expose agent.chat method
- [ ] Expose agent.stop method
- [ ] Expose config methods

#### Files to Modify:
- `apps/desktop/src/preload/index.ts`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.3.3: Create IPC Handlers
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create src/main/ipc.ts
- [ ] Register ipcMain handlers
- [ ] Handle agent:chat requests
- [ ] Handle config requests

#### Files to Create:
- `apps/desktop/src/main/ipc.ts`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.3.4: Implement Streaming
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Use webContents.send for streaming
- [ ] Send text chunks
- [ ] Send tool call events
- [ ] Send tool result events

#### Files to Modify:
- `apps/desktop/src/main/ipc.ts`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.3.5: Add Type Safety
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Define API types in shared
- [ ] Type preload exposed API
- [ ] Type renderer window.api

#### Files to Modify:
- `apps/desktop/src/shared/ipc.ts`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

## Activity 11.4: React UI

**Status**: `pending`

### Task 11.4.1: Create App Component
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create src/renderer/App.tsx
- [ ] Set up routing (settings, chat)
- [ ] Add global styles
- [ ] Create app layout

#### Files to Create:
- `apps/desktop/src/renderer/App.tsx`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.4.2: Create Chat Component
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create src/renderer/components/Chat.tsx
- [ ] Message list display
- [ ] Input field with send button
- [ ] Streaming text display

#### Files to Create:
- `apps/desktop/src/renderer/components/Chat.tsx`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.4.3: Create Message Components
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create UserMessage component
- [ ] Create AssistantMessage component
- [ ] Create ToolCallMessage component
- [ ] Create ToolResultMessage component

#### Files to Create:
- `apps/desktop/src/renderer/components/messages/`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.4.4: Create Settings Component
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create src/renderer/components/Settings.tsx
- [ ] Provider selection dropdown
- [ ] API key input fields
- [ ] Model selection

#### Files to Create:
- `apps/desktop/src/renderer/components/Settings.tsx`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.4.5: Create MCP Manager
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create src/renderer/components/MCPManager.tsx
- [ ] List configured servers
- [ ] Add server form
- [ ] Remove server button

#### Files to Create:
- `apps/desktop/src/renderer/components/MCPManager.tsx`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.4.6: Create State Store
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Install zustand
- [ ] Create src/renderer/stores/chat.ts
- [ ] Create src/renderer/stores/config.ts
- [ ] Handle streaming state

#### Files to Create:
- `apps/desktop/src/renderer/stores/`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.4.7: Style Components
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Install Tailwind CSS
- [ ] Configure Tailwind
- [ ] Style all components
- [ ] Add dark mode support

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

### Task 11.4.8: Connect to IPC
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Call window.api.chat from Chat
- [ ] Listen for streaming events
- [ ] Update state on events
- [ ] Handle errors

#### Files to Modify:
- `apps/desktop/src/renderer/components/Chat.tsx`

#### Verification:
```bash
cd apps/desktop && bunx tsc --noEmit
```

---

## Activity 11.5: Build Config

**Status**: `pending`

### Task 11.5.1: Create Electron Builder Config
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Create electron-builder.json
- [ ] Configure app name and ID
- [ ] Configure icons
- [ ] Configure file associations

#### Files to Create:
- `apps/desktop/electron-builder.json`

#### Verification:
```bash
cat apps/desktop/electron-builder.json
```

---

### Task 11.5.2: Configure Build Scripts
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Add build:main script
- [ ] Add build:renderer script
- [ ] Add build:all script
- [ ] Add dev script

#### Files to Modify:
- `apps/desktop/package.json`

#### Verification:
```bash
cd apps/desktop && bun run build:all
```

---

### Task 11.5.3: Test Dev Mode
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run: `bun run dev`
- [ ] Verify window opens
- [ ] Verify chat works
- [ ] Verify settings work

#### Verification:
```bash
cd apps/desktop && bun run dev
```

---

### Task 11.5.4: Test Production Build
- **Status**: `pending`
- **Assigned**: unassigned
- **Remarks**: -

#### Actions:
- [ ] Run: `bun run build:all`
- [ ] Verify dist created
- [ ] Test packaged app
- [ ] Verify all features work

#### Verification:
```bash
cd apps/desktop && bun run build:all && ls dist/
```

---

## Phase 11 Checklist

- [ ] Electron installed
- [ ] Directory structure created
- [ ] Main process runs
- [ ] Window opens
- [ ] Tray works
- [ ] Agent bridge works
- [ ] IPC channels defined
- [ ] Preload exposes API
- [ ] Streaming works
- [ ] Chat UI complete
- [ ] Settings UI complete
- [ ] MCP manager complete
- [ ] Styles applied
- [ ] Dev mode works
- [ ] Production build works

---

## Next Phase

After completing Phase 11, proceed to [Phase 12: Polish](./phase-12-polish.md)

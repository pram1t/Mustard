# Desktop Application

This document describes the Electron desktop application architecture.

## Overview

The desktop app provides:
- Chat interface for conversational interaction
- Settings UI for configuration
- MCP server management
- System tray integration
- Auto-updates

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ELECTRON APPLICATION                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────┐        ┌──────────────────────────────────┐│
│  │   MAIN PROCESS     │        │        RENDERER PROCESS         ││
│  │   (Node.js)        │        │        (Chromium)               ││
│  │                    │        │                                  ││
│  │  - Window mgmt     │  IPC   │  ┌──────────────────────────┐   ││
│  │  - System tray     │◀──────▶│  │      React App           │   ││
│  │  - Auto-updates    │        │  │                          │   ││
│  │  - File dialogs    │        │  │  ┌──────────────────┐    │   ││
│  │  - Native menus    │        │  │  │    Chat View     │    │   ││
│  │                    │        │  │  └──────────────────┘    │   ││
│  │  ┌──────────────┐  │        │  │  ┌──────────────────┐    │   ││
│  │  │ Agent Bridge │  │        │  │  │   Settings View  │    │   ││
│  │  │              │  │        │  │  └──────────────────┘    │   ││
│  │  │ Spawns CLI   │  │        │  │  ┌──────────────────┐    │   ││
│  │  │ agent as     │  │        │  │  │  MCP Manager     │    │   ││
│  │  │ child proc   │  │        │  │  └──────────────────┘    │   ││
│  │  └──────────────┘  │        │  │                          │   ││
│  └────────────────────┘        │  └──────────────────────────┘   ││
│                                └──────────────────────────────────┘│
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │                     PRELOAD SCRIPT                             ││
│  │  Secure bridge between main and renderer                       ││
│  │  Exposes: electronAPI.send(), electronAPI.on()                 ││
│  └────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
apps/desktop/
├── src/
│   ├── main/
│   │   ├── index.ts           # Main process entry
│   │   ├── window.ts          # Window management
│   │   ├── tray.ts            # System tray
│   │   ├── menu.ts            # Application menu
│   │   ├── ipc.ts             # IPC handlers
│   │   ├── agent-bridge.ts    # CLI agent spawning
│   │   └── auto-update.ts     # Update management
│   │
│   ├── preload.ts             # Preload script
│   │
│   └── renderer/
│       ├── App.tsx            # React app entry
│       ├── index.html         # HTML template
│       ├── components/
│       │   ├── Chat/
│       │   │   ├── ChatView.tsx
│       │   │   ├── MessageList.tsx
│       │   │   ├── MessageInput.tsx
│       │   │   └── ToolCallDisplay.tsx
│       │   ├── Settings/
│       │   │   ├── SettingsView.tsx
│       │   │   ├── ProviderConfig.tsx
│       │   │   └── PermissionConfig.tsx
│       │   ├── MCP/
│       │   │   ├── MCPManager.tsx
│       │   │   ├── ServerList.tsx
│       │   │   └── AddServerModal.tsx
│       │   └── common/
│       │       ├── Button.tsx
│       │       ├── Modal.tsx
│       │       └── ...
│       ├── stores/
│       │   ├── chat.ts        # Chat state (Zustand)
│       │   ├── settings.ts    # Settings state
│       │   └── mcp.ts         # MCP state
│       └── styles/
│           └── tailwind.css
│
├── package.json
├── electron-builder.json      # Build configuration
└── tsconfig.json
```

## Main Process

### Entry Point

```typescript
// apps/desktop/src/main/index.ts

import { app, BrowserWindow } from 'electron';
import { createWindow } from './window';
import { setupTray } from './tray';
import { setupIPC } from './ipc';
import { setupAutoUpdate } from './auto-update';

async function main() {
  // Single instance lock
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  await app.whenReady();

  // Create main window
  const mainWindow = await createWindow();

  // Setup components
  setupTray(mainWindow);
  setupIPC(mainWindow);
  setupAutoUpdate();

  // Handle activate (macOS)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Handle all windows closed
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

main();
```

### Window Management

```typescript
// apps/desktop/src/main/window.ts

import { BrowserWindow, shell } from 'electron';
import * as path from 'path';

export async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'hiddenInset', // macOS
    frame: process.platform === 'darwin' ? true : false,
    show: false,
  });

  // Load app
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show when ready
  win.once('ready-to-show', () => {
    win.show();
  });

  // Handle external links
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}
```

### Agent Bridge

```typescript
// apps/desktop/src/main/agent-bridge.ts

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export class AgentBridge extends EventEmitter {
  private process: ChildProcess | null = null;
  private sessionId: string | null = null;

  async start(config: { cwd: string; provider: string }): Promise<string> {
    this.sessionId = generateSessionId();

    // Spawn CLI agent as child process
    this.process = spawn('openagent', [
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--session', this.sessionId,
    ], {
      cwd: config.cwd,
      env: {
        ...process.env,
        OPENAGENT_PROVIDER: config.provider,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Handle stdout (agent events)
    this.process.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          this.emit('agent-event', event);
        } catch {
          // Not JSON, emit as text
          this.emit('agent-text', line);
        }
      }
    });

    // Handle stderr
    this.process.stderr?.on('data', (data) => {
      this.emit('agent-error', data.toString());
    });

    // Handle exit
    this.process.on('close', (code) => {
      this.emit('agent-exit', code);
      this.process = null;
    });

    return this.sessionId;
  }

  sendMessage(message: string): void {
    if (!this.process?.stdin) {
      throw new Error('Agent not running');
    }

    this.process.stdin.write(JSON.stringify({
      type: 'user_message',
      content: message,
    }) + '\n');
  }

  approvePermission(toolCallId: string, approved: boolean): void {
    if (!this.process?.stdin) return;

    this.process.stdin.write(JSON.stringify({
      type: 'permission_response',
      tool_call_id: toolCallId,
      approved,
    }) + '\n');
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}
```

### IPC Handlers

```typescript
// apps/desktop/src/main/ipc.ts

import { ipcMain, BrowserWindow, dialog } from 'electron';
import { AgentBridge } from './agent-bridge';
import { loadConfig, saveConfig } from './config';

let agentBridge: AgentBridge | null = null;

export function setupIPC(mainWindow: BrowserWindow): void {
  // Start agent
  ipcMain.handle('agent:start', async (_, config) => {
    agentBridge = new AgentBridge();

    // Forward events to renderer
    agentBridge.on('agent-event', (event) => {
      mainWindow.webContents.send('agent:event', event);
    });

    agentBridge.on('agent-error', (error) => {
      mainWindow.webContents.send('agent:error', error);
    });

    agentBridge.on('agent-exit', (code) => {
      mainWindow.webContents.send('agent:exit', code);
    });

    return agentBridge.start(config);
  });

  // Send message to agent
  ipcMain.on('agent:message', (_, message) => {
    agentBridge?.sendMessage(message);
  });

  // Approve permission
  ipcMain.on('agent:approve', (_, { toolCallId, approved }) => {
    agentBridge?.approvePermission(toolCallId, approved);
  });

  // Stop agent
  ipcMain.on('agent:stop', () => {
    agentBridge?.stop();
  });

  // Load config
  ipcMain.handle('config:load', async () => {
    return loadConfig();
  });

  // Save config
  ipcMain.handle('config:save', async (_, config) => {
    return saveConfig(config);
  });

  // Select directory
  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.filePaths[0];
  });
}
```

## Preload Script

```typescript
// apps/desktop/src/preload.ts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Agent operations
  startAgent: (config: any) => ipcRenderer.invoke('agent:start', config),
  sendMessage: (message: string) => ipcRenderer.send('agent:message', message),
  approvePermission: (toolCallId: string, approved: boolean) =>
    ipcRenderer.send('agent:approve', { toolCallId, approved }),
  stopAgent: () => ipcRenderer.send('agent:stop'),

  // Event listeners
  onAgentEvent: (callback: (event: any) => void) =>
    ipcRenderer.on('agent:event', (_, event) => callback(event)),
  onAgentError: (callback: (error: string) => void) =>
    ipcRenderer.on('agent:error', (_, error) => callback(error)),
  onAgentExit: (callback: (code: number) => void) =>
    ipcRenderer.on('agent:exit', (_, code) => callback(code)),

  // Config operations
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config: any) => ipcRenderer.invoke('config:save', config),

  // Dialogs
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
});
```

## Renderer Process (React)

### Chat View

```tsx
// apps/desktop/src/renderer/components/Chat/ChatView.tsx

import React, { useEffect, useState } from 'react';
import { useChatStore } from '../../stores/chat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ToolCallDisplay } from './ToolCallDisplay';

export function ChatView() {
  const {
    messages,
    isLoading,
    pendingApproval,
    addMessage,
    setLoading,
    setPendingApproval,
  } = useChatStore();

  const [cwd, setCwd] = useState('');

  useEffect(() => {
    // Listen for agent events
    window.electronAPI.onAgentEvent((event) => {
      switch (event.type) {
        case 'text':
          // Update last assistant message
          addMessage({
            role: 'assistant',
            content: event.content,
            streaming: true,
          });
          break;

        case 'tool_call_start':
          addMessage({
            role: 'tool',
            tool: event.tool,
            params: event.params,
            status: 'running',
          });
          break;

        case 'tool_call_end':
          // Update tool message status
          break;

        case 'permission_request':
          setPendingApproval({
            toolCallId: event.id,
            tool: event.tool,
            params: event.params,
          });
          break;

        case 'done':
          setLoading(false);
          break;
      }
    });
  }, []);

  const handleSend = async (message: string) => {
    addMessage({ role: 'user', content: message });
    setLoading(true);
    window.electronAPI.sendMessage(message);
  };

  const handleApprove = (approved: boolean) => {
    if (pendingApproval) {
      window.electronAPI.approvePermission(pendingApproval.toolCallId, approved);
      setPendingApproval(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} />

      {pendingApproval && (
        <ToolCallDisplay
          tool={pendingApproval.tool}
          params={pendingApproval.params}
          onApprove={() => handleApprove(true)}
          onDeny={() => handleApprove(false)}
        />
      )}

      <MessageInput
        onSend={handleSend}
        disabled={isLoading}
      />
    </div>
  );
}
```

### Settings View

```tsx
// apps/desktop/src/renderer/components/Settings/SettingsView.tsx

import React, { useEffect } from 'react';
import { useSettingsStore } from '../../stores/settings';
import { ProviderConfig } from './ProviderConfig';
import { PermissionConfig } from './PermissionConfig';

export function SettingsView() {
  const { config, setConfig, loadConfig, saveConfig } = useSettingsStore();

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    await saveConfig();
  };

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section>
        <h2 className="text-xl font-semibold mb-4">LLM Provider</h2>
        <ProviderConfig
          config={config.llm}
          onChange={(llm) => setConfig({ ...config, llm })}
        />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Permissions</h2>
        <PermissionConfig
          config={config.permissions}
          onChange={(permissions) => setConfig({ ...config, permissions })}
        />
      </section>

      <button
        onClick={handleSave}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Save Settings
      </button>
    </div>
  );
}
```

## Build Configuration

```json
// apps/desktop/electron-builder.json
{
  "appId": "com.openagent.desktop",
  "productName": "OpenAgent",
  "directories": {
    "output": "dist"
  },
  "files": [
    "build/**/*"
  ],
  "mac": {
    "category": "public.app-category.developer-tools",
    "target": ["dmg", "zip"],
    "icon": "assets/icon.icns"
  },
  "win": {
    "target": ["nsis", "portable"],
    "icon": "assets/icon.ico"
  },
  "linux": {
    "target": ["AppImage", "deb"],
    "category": "Development"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  },
  "publish": {
    "provider": "github"
  }
}
```

## Next Steps

- See [CLI-INTERFACE.md](CLI-INTERFACE.md) for CLI details
- See [CONFIGURATION.md](CONFIGURATION.md) for config options
- See [IMPLEMENTATION-PHASES.md](IMPLEMENTATION-PHASES.md) for build order

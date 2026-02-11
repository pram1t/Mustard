/**
 * Trust boundary definitions.
 * Documents what each process can and cannot do.
 */

export const MAIN_PROCESS_CAPABILITIES = {
  nodeAccess: true,
  fileSystem: true,
  network: true,
  shell: true,
  agentCore: true,
} as const;

export const PRELOAD_CAPABILITIES = {
  nodeAccess: false,
  fileSystem: false,
  network: false,
  shell: false,
  contextBridge: true,
  ipcRenderer: true,
} as const;

export const RENDERER_CAPABILITIES = {
  nodeAccess: false,
  fileSystem: false,
  network: false,
  shell: false,
  windowApi: true,
} as const;

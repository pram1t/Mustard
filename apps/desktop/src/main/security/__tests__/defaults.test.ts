import { describe, it, expect } from 'vitest';
import { getSecureWindowDefaults, validateSecureOptions } from '../../window/defaults';
import {
  MAIN_PROCESS_CAPABILITIES,
  PRELOAD_CAPABILITIES,
  RENDERER_CAPABILITIES,
} from '../boundaries';

describe('getSecureWindowDefaults', () => {
  const defaults = getSecureWindowDefaults('/path/to/preload.js');
  const wp = defaults.webPreferences!;

  it('should have contextIsolation enabled', () => {
    expect(wp.contextIsolation).toBe(true);
  });

  it('should have nodeIntegration disabled', () => {
    expect(wp.nodeIntegration).toBe(false);
  });

  it('should have sandbox enabled', () => {
    expect(wp.sandbox).toBe(true);
  });

  it('should have webSecurity enabled', () => {
    expect(wp.webSecurity).toBe(true);
  });

  it('should have webviewTag disabled', () => {
    expect(wp.webviewTag).toBe(false);
  });

  it('should have nodeIntegrationInWorker disabled', () => {
    expect(wp.nodeIntegrationInWorker).toBe(false);
  });

  it('should have nodeIntegrationInSubFrames disabled', () => {
    expect(wp.nodeIntegrationInSubFrames).toBe(false);
  });

  it('should have experimentalFeatures disabled', () => {
    expect(wp.experimentalFeatures).toBe(false);
  });

  it('should have navigateOnDragDrop disabled', () => {
    expect(wp.navigateOnDragDrop).toBe(false);
  });

  it('should have allowRunningInsecureContent disabled', () => {
    expect(wp.allowRunningInsecureContent).toBe(false);
  });

  it('should set the preload path', () => {
    expect(wp.preload).toBe('/path/to/preload.js');
  });

  it('should not show window immediately', () => {
    expect(defaults.show).toBe(false);
  });
});

describe('validateSecureOptions', () => {
  it('should pass with secure defaults', () => {
    const defaults = getSecureWindowDefaults('/path/to/preload.js');
    expect(() => validateSecureOptions(defaults)).not.toThrow();
  });

  it('should throw if webPreferences is missing', () => {
    expect(() => validateSecureOptions({})).toThrow('webPreferences is required');
  });

  it('should throw if contextIsolation is not true', () => {
    expect(() =>
      validateSecureOptions({
        webPreferences: { contextIsolation: false } as any,
      })
    ).toThrow('contextIsolation must be true');
  });

  it('should throw if nodeIntegration is not false', () => {
    expect(() =>
      validateSecureOptions({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: true,
        } as any,
      })
    ).toThrow('nodeIntegration must be false');
  });

  it('should throw if sandbox is not true', () => {
    expect(() =>
      validateSecureOptions({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        } as any,
      })
    ).toThrow('sandbox must be true');
  });

  it('should throw if webSecurity is not true', () => {
    expect(() =>
      validateSecureOptions({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: false,
        } as any,
      })
    ).toThrow('webSecurity must be true');
  });

  it('should throw if webviewTag is not false', () => {
    expect(() =>
      validateSecureOptions({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
          webviewTag: true,
        } as any,
      })
    ).toThrow('webviewTag must be false');
  });
});

describe('Trust Boundary Constants', () => {
  it('main process should have full capabilities', () => {
    expect(MAIN_PROCESS_CAPABILITIES.nodeAccess).toBe(true);
    expect(MAIN_PROCESS_CAPABILITIES.fileSystem).toBe(true);
    expect(MAIN_PROCESS_CAPABILITIES.network).toBe(true);
    expect(MAIN_PROCESS_CAPABILITIES.shell).toBe(true);
    expect(MAIN_PROCESS_CAPABILITIES.agentCore).toBe(true);
  });

  it('preload should have limited capabilities', () => {
    expect(PRELOAD_CAPABILITIES.nodeAccess).toBe(false);
    expect(PRELOAD_CAPABILITIES.fileSystem).toBe(false);
    expect(PRELOAD_CAPABILITIES.network).toBe(false);
    expect(PRELOAD_CAPABILITIES.shell).toBe(false);
    expect(PRELOAD_CAPABILITIES.contextBridge).toBe(true);
    expect(PRELOAD_CAPABILITIES.ipcRenderer).toBe(true);
  });

  it('renderer should have no direct capabilities', () => {
    expect(RENDERER_CAPABILITIES.nodeAccess).toBe(false);
    expect(RENDERER_CAPABILITIES.fileSystem).toBe(false);
    expect(RENDERER_CAPABILITIES.network).toBe(false);
    expect(RENDERER_CAPABILITIES.shell).toBe(false);
    expect(RENDERER_CAPABILITIES.windowApi).toBe(true);
  });
});

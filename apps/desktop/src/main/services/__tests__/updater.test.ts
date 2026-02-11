import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
  },
}));

import { UpdateService } from '../updater';

describe('UpdateService', () => {
  let service: UpdateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UpdateService();
  });

  it('creates an instance', () => {
    expect(service).toBeDefined();
  });

  it('returns idle status initially', () => {
    const { status, updateInfo } = service.getStatus();
    expect(status).toBe('idle');
    expect(updateInfo).toBeNull();
  });

  it('skips initialization in development mode', () => {
    const mockWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn(),
      },
    } as unknown as Electron.BrowserWindow;

    // Should not throw
    service.initialize(mockWindow);
    expect(service.getStatus().status).toBe('idle');
  });

  it('skips checkForUpdates in development mode', () => {
    // Should not throw
    service.checkForUpdates();
    expect(service.getStatus().status).toBe('idle');
  });

  it('skips downloadUpdate in development mode', () => {
    service.downloadUpdate();
    expect(service.getStatus().status).toBe('idle');
  });

  it('skips installUpdate in development mode', () => {
    service.installUpdate();
    expect(service.getStatus().status).toBe('idle');
  });
});

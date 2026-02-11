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

  it('skips initialization in development mode', async () => {
    const mockWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn(),
      },
    } as unknown as Electron.BrowserWindow;

    // Should not throw
    await service.initialize(mockWindow);
    expect(service.getStatus().status).toBe('idle');
  });

  it('skips checkForUpdates in development mode', async () => {
    // Should not throw
    await service.checkForUpdates();
    expect(service.getStatus().status).toBe('idle');
  });

  it('skips downloadUpdate in development mode', async () => {
    await service.downloadUpdate();
    expect(service.getStatus().status).toBe('idle');
  });

  it('skips installUpdate in development mode', async () => {
    await service.installUpdate();
    expect(service.getStatus().status).toBe('idle');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// ── Mocks ────────────────────────────────────────────────────────────────────

const MOCK_USER_DATA = path.resolve(__dirname, 'mock-userData');
const STATE_PATH = path.join(MOCK_USER_DATA, 'window-state.json');

vi.mock('electron', () => ({
  screen: {
    getAllDisplays: vi.fn(() => [
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    ]),
  },
  app: {
    getPath: vi.fn(() => MOCK_USER_DATA),
  },
}));

const mockFs: Record<string, string> = {};

vi.mock('fs', () => ({
  existsSync: vi.fn((p: string) => p in mockFs),
  readFileSync: vi.fn((p: string) => {
    if (!(p in mockFs)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return mockFs[p];
  }),
  writeFileSync: vi.fn((p: string, data: string) => {
    mockFs[p] = data;
  }),
}));

import { loadWindowState, saveWindowState } from '../state';

describe('Window State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear mock filesystem
    Object.keys(mockFs).forEach((k) => delete mockFs[k]);
  });

  it('returns null when no saved state exists', () => {
    const state = loadWindowState();
    expect(state).toBeNull();
  });

  it('loads valid saved state', () => {
    const validState = { x: 100, y: 100, width: 800, height: 600, isMaximized: false };
    mockFs[STATE_PATH] = JSON.stringify(validState);

    const state = loadWindowState();
    expect(state).toEqual(validState);
  });

  it('rejects state with too-small dimensions', () => {
    const tinyState = { x: 0, y: 0, width: 50, height: 50, isMaximized: false };
    mockFs[STATE_PATH] = JSON.stringify(tinyState);

    const state = loadWindowState();
    expect(state).toBeNull();
  });

  it('rejects state with off-screen position', () => {
    const offScreen = { x: 9999, y: 9999, width: 800, height: 600, isMaximized: false };
    mockFs[STATE_PATH] = JSON.stringify(offScreen);

    const state = loadWindowState();
    expect(state).toBeNull();
  });

  it('saves window state', () => {
    const mockWindow = {
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => false),
      getBounds: vi.fn(() => ({ x: 200, y: 150, width: 1024, height: 768 })),
    } as unknown as Electron.BrowserWindow;

    saveWindowState(mockWindow);

    expect(mockFs[STATE_PATH]).toBeDefined();
    const saved = JSON.parse(mockFs[STATE_PATH]);
    expect(saved).toEqual({
      x: 200,
      y: 150,
      width: 1024,
      height: 768,
      isMaximized: false,
    });
  });

  it('does not save state for destroyed window', () => {
    const destroyedWindow = {
      isDestroyed: vi.fn(() => true),
    } as unknown as Electron.BrowserWindow;

    saveWindowState(destroyedWindow);
    expect(mockFs[STATE_PATH]).toBeUndefined();
  });

  it('returns null on corrupted JSON', () => {
    mockFs[STATE_PATH] = 'not-json{{{';
    const state = loadWindowState();
    expect(state).toBeNull();
  });
});

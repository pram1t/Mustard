import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockDestroy = vi.fn();
const mockSetToolTip = vi.fn();
const mockSetContextMenu = vi.fn();
const mockTrayOn = vi.fn();

vi.mock('electron', () => {
  const TrayClass = vi.fn(function (this: Record<string, unknown>) {
    this.destroy = mockDestroy;
    this.setToolTip = mockSetToolTip;
    this.setContextMenu = mockSetContextMenu;
    this.on = mockTrayOn;
  });

  return {
    Tray: TrayClass,
    Menu: {
      buildFromTemplate: vi.fn((template: unknown[]) => ({ items: template })),
    },
    nativeImage: {
      createFromPath: vi.fn(() => ({
        isEmpty: () => true,
        resize: vi.fn(),
      })),
      createEmpty: vi.fn(() => ({
        isEmpty: () => true,
        resize: vi.fn(),
      })),
    },
    app: {
      quit: vi.fn(),
    },
  };
});

import { createTray, destroyTray } from '../tray';

describe('System Tray', () => {
  const mockWindow = {
    show: vi.fn(),
    focus: vi.fn(),
    isVisible: vi.fn(() => true),
    webContents: {
      send: vi.fn(),
    },
  } as unknown as Electron.BrowserWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state by destroying any existing tray
    destroyTray();
    vi.clearAllMocks(); // Clear the destroy mock call
  });

  it('creates a tray instance', () => {
    const tray = createTray(mockWindow);
    expect(tray).toBeDefined();
  });

  it('sets tooltip to OpenAgent', () => {
    createTray(mockWindow);
    expect(mockSetToolTip).toHaveBeenCalledWith('OpenAgent');
  });

  it('sets a context menu', () => {
    createTray(mockWindow);
    expect(mockSetContextMenu).toHaveBeenCalled();
  });

  it('registers click handler', () => {
    createTray(mockWindow);
    expect(mockTrayOn).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('destroys tray on destroyTray()', () => {
    createTray(mockWindow);
    destroyTray();
    expect(mockDestroy).toHaveBeenCalled();
  });

  it('handles destroyTray when no tray exists', () => {
    // Should not throw
    destroyTray();
    expect(mockDestroy).not.toHaveBeenCalled();
  });
});

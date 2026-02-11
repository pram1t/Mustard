import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  globalShortcut: {
    register: vi.fn(() => true),
    unregisterAll: vi.fn(),
  },
}));

import { globalShortcut } from 'electron';
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from '../shortcuts';

const mockRegister = globalShortcut.register as ReturnType<typeof vi.fn>;
const mockUnregisterAll = globalShortcut.unregisterAll as ReturnType<typeof vi.fn>;

describe('Global Shortcuts', () => {
  const mockWindow = {
    isVisible: vi.fn(() => true),
    isFocused: vi.fn(() => true),
    show: vi.fn(),
    focus: vi.fn(),
    hide: vi.fn(),
  } as unknown as Electron.BrowserWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    (mockWindow.isVisible as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (mockWindow.isFocused as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockRegister.mockReturnValue(true);
  });

  it('registers Ctrl+Shift+O shortcut', () => {
    registerGlobalShortcuts(mockWindow);
    expect(mockRegister).toHaveBeenCalledWith(
      'CommandOrControl+Shift+O',
      expect.any(Function)
    );
  });

  it('hides window when visible and focused', () => {
    registerGlobalShortcuts(mockWindow);
    const callback = mockRegister.mock.calls[0][1] as () => void;
    callback();
    expect(mockWindow.hide).toHaveBeenCalled();
  });

  it('shows and focuses window when not visible', () => {
    (mockWindow.isVisible as ReturnType<typeof vi.fn>).mockReturnValue(false);
    registerGlobalShortcuts(mockWindow);
    const callback = mockRegister.mock.calls[0][1] as () => void;
    callback();
    expect(mockWindow.show).toHaveBeenCalled();
    expect(mockWindow.focus).toHaveBeenCalled();
  });

  it('shows and focuses window when visible but not focused', () => {
    (mockWindow.isVisible as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (mockWindow.isFocused as ReturnType<typeof vi.fn>).mockReturnValue(false);
    registerGlobalShortcuts(mockWindow);
    const callback = mockRegister.mock.calls[0][1] as () => void;
    callback();
    expect(mockWindow.show).toHaveBeenCalled();
    expect(mockWindow.focus).toHaveBeenCalled();
  });

  it('unregisters all shortcuts', () => {
    unregisterGlobalShortcuts();
    expect(mockUnregisterAll).toHaveBeenCalled();
  });

  it('warns when registration fails', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockRegister.mockReturnValue(false);
    registerGlobalShortcuts(mockWindow);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to register')
    );
    warnSpy.mockRestore();
  });
});

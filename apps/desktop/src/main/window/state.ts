import { screen, app } from 'electron';
import type { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

function getStatePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

/**
 * Loads saved window state.
 * Returns null if no state or state is invalid.
 */
export function loadWindowState(): WindowState | null {
  try {
    const statePath = getStatePath();
    if (!fs.existsSync(statePath)) {
      return null;
    }

    const data = fs.readFileSync(statePath, 'utf-8');
    const state = JSON.parse(data) as WindowState;

    if (!isValidState(state)) {
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

/**
 * Saves current window state.
 */
export function saveWindowState(window: BrowserWindow): void {
  try {
    if (window.isDestroyed()) {
      return;
    }

    const bounds = window.getBounds();
    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: window.isMaximized(),
    };

    fs.writeFileSync(getStatePath(), JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Failed to save window state:', error);
  }
}

/**
 * Validates window state is within screen bounds.
 */
function isValidState(state: WindowState): boolean {
  if (state.width < 200 || state.height < 150) {
    return false;
  }

  if (state.x !== undefined && state.y !== undefined) {
    const displays = screen.getAllDisplays();
    const isOnScreen = displays.some(display => {
      const { x, y, width, height } = display.bounds;
      return (
        state.x! >= x &&
        state.x! < x + width &&
        state.y! >= y &&
        state.y! < y + height
      );
    });

    if (!isOnScreen) {
      return false;
    }
  }

  return true;
}

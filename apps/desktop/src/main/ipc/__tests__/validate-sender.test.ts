import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/mock'),
  },
}));

import { validateSender } from '../validate-sender';
import { setMainWindow } from '../../window';

describe('validateSender', () => {
  const mockWebContents = { id: 1 };
  const mockMainWindow = {
    webContents: mockWebContents,
    isDestroyed: () => false,
  };

  beforeEach(() => {
    setMainWindow(mockMainWindow as any);
  });

  afterEach(() => {
    setMainWindow(null);
  });

  it('should throw if no sender frame', () => {
    const event = { senderFrame: null, sender: mockWebContents };
    expect(() => validateSender(event as any)).toThrow('IPC: No sender frame');
  });

  it('should throw if main window is null', () => {
    setMainWindow(null);
    const event = { senderFrame: { url: 'file://test' }, sender: mockWebContents };
    expect(() => validateSender(event as any)).toThrow('IPC: Unauthorized sender');
  });

  it('should throw if sender is not main window webContents', () => {
    const event = { senderFrame: { url: 'file://test' }, sender: { id: 999 } };
    expect(() => validateSender(event as any)).toThrow('IPC: Unauthorized sender');
  });

  it('should throw if origin is http://', () => {
    const event = { senderFrame: { url: 'http://evil.com' }, sender: mockWebContents };
    expect(() => validateSender(event as any)).toThrow('IPC: Unauthorized origin');
  });

  it('should throw if origin is https://', () => {
    const event = { senderFrame: { url: 'https://evil.com' }, sender: mockWebContents };
    expect(() => validateSender(event as any)).toThrow('IPC: Unauthorized origin');
  });

  it('should pass for file:// origin from main window', () => {
    const event = {
      senderFrame: { url: 'file:///path/to/app/index.html' },
      sender: mockWebContents,
    };
    expect(() => validateSender(event as any)).not.toThrow();
  });

  it('should pass for app:// origin from main window', () => {
    const event = {
      senderFrame: { url: 'app://./index.html' },
      sender: mockWebContents,
    };
    expect(() => validateSender(event as any)).not.toThrow();
  });

  it('should pass for http://localhost in dev mode (app.isPackaged = false)', () => {
    const event = {
      senderFrame: { url: 'http://localhost:5173/' },
      sender: mockWebContents,
    };
    expect(() => validateSender(event as any)).not.toThrow();
  });
});

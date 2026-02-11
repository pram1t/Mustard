import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { emitEvent, emitStatus } from '../event-emitter';
import { setMainWindow } from '../../window';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { createTextEvent } from '../../../shared/event-types';

describe('emitEvent', () => {
  const mockSend = vi.fn();
  const mockWindow = {
    isDestroyed: vi.fn(() => false),
    webContents: { send: mockSend },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMainWindow(mockWindow as any);
  });

  afterEach(() => {
    setMainWindow(null);
  });

  it('should send event via webContents.send on AGENT_EVENT channel', () => {
    const event = createTextEvent('session-1', 'hello', 'hello');
    emitEvent(event);
    expect(mockSend).toHaveBeenCalledWith(IPC_CHANNELS.AGENT_EVENT, event);
  });

  it('should not send if window is null', () => {
    setMainWindow(null);
    const event = createTextEvent('session-1', 'hello');
    emitEvent(event);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should not send if window is destroyed', () => {
    mockWindow.isDestroyed.mockReturnValue(true);
    const event = createTextEvent('session-1', 'hello');
    emitEvent(event);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should not send invalid event objects', () => {
    const badEvent = { notAValidEvent: true };
    emitEvent(badEvent as any);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('emitStatus', () => {
  const mockSend = vi.fn();
  const mockWindow = {
    isDestroyed: vi.fn(() => false),
    webContents: { send: mockSend },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMainWindow(mockWindow as any);
  });

  afterEach(() => {
    setMainWindow(null);
  });

  it('should emit a status event with correct type', () => {
    emitStatus('session-1', 'ready');
    expect(mockSend).toHaveBeenCalledTimes(1);
    const sentEvent = mockSend.mock.calls[0][1];
    expect(sentEvent.type).toBe('status');
    expect(sentEvent.data.status).toBe('ready');
    expect(sentEvent.sessionId).toBe('session-1');
  });

  it('should include optional message', () => {
    emitStatus('session-1', 'error', 'Something went wrong');
    const sentEvent = mockSend.mock.calls[0][1];
    expect(sentEvent.data.message).toBe('Something went wrong');
  });
});

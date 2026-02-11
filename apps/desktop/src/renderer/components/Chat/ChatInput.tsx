import { useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useConversationStore } from '../../stores/conversation';
import './ChatInput.css';

export function ChatInput(): ReactNode {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const input = useConversationStore((s) => s.input);
  const status = useConversationStore((s) => s.status);
  const setInput = useConversationStore((s) => s.setInput);
  const addUserMessage = useConversationStore((s) => s.addUserMessage);
  const isBusy = status === 'busy';

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isBusy) return;
    const message = input.trim();
    addUserMessage(message);
    try {
      await window.api.chat(message);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [input, isBusy, addUserMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleStop = useCallback(async () => {
    try {
      await window.api.stop();
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  }, []);

  return (
    <div className="chat-input">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message... (Shift+Enter for new line)"
        disabled={isBusy}
        rows={1}
      />
      <div className="chat-input-actions">
        {isBusy ? (
          <button
            className="chat-input-stop"
            onClick={handleStop}
            aria-label="Stop"
          >
            &#9632;
          </button>
        ) : (
          <button
            className="chat-input-send"
            onClick={handleSubmit}
            disabled={!input.trim()}
            aria-label="Send"
          >
            &#9654;
          </button>
        )}
      </div>
    </div>
  );
}

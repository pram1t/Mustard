import { useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Message } from './Message';
import { useConversationStore } from '../../stores/conversation';
import './MessageList.css';
import './Message.css';

export function MessageList(): ReactNode {
  const messages = useConversationStore((s) => s.messages);
  const status = useConversationStore((s) => s.status);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="message-list" ref={containerRef}>
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        messages.map((message) => <Message key={message.id} message={message} />)
      )}
      {status === 'busy' && <TypingIndicator />}
    </div>
  );
}

function EmptyState(): ReactNode {
  return (
    <div className="message-list-empty">
      <h2>Welcome to OpenAgent</h2>
      <p>Start a conversation by typing a message below.</p>
    </div>
  );
}

function TypingIndicator(): ReactNode {
  return (
    <div className="typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  );
}

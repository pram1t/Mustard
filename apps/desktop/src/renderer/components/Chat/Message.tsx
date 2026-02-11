import { memo } from 'react';
import type { ReactNode } from 'react';
import { MarkdownContent } from './MarkdownContent';
import { ToolCallMessage } from './ToolCallMessage';
import { ToolResultMessage } from './ToolResultMessage';
import { formatTimestamp } from '../../utils/markdown';
import type { Message as MessageType } from '../../stores/conversation';

interface MessageProps {
  message: MessageType;
}

function renderContent(message: MessageType): ReactNode {
  switch (message.type) {
    case 'user':
      return <p>{message.content}</p>;
    case 'assistant':
      return <MarkdownContent content={message.content} />;
    case 'tool_call':
      return (
        <ToolCallMessage
          data={message.metadata as { name: string; arguments: Record<string, unknown> }}
        />
      );
    case 'tool_result':
      return (
        <ToolResultMessage
          data={
            message.metadata as {
              name: string;
              result: unknown;
              error?: string;
              duration: number;
            }
          }
        />
      );
    case 'error':
      return (
        <div className="message-error">
          <span className="message-error-icon">&#9888;</span>
          <span>{message.content}</span>
        </div>
      );
    default:
      return <p>{message.content}</p>;
  }
}

export const Message = memo(function Message({ message }: MessageProps): ReactNode {
  const isUser = message.type === 'user';

  return (
    <div className={`message message-${message.type}`}>
      <div className="message-avatar">
        <div className={`avatar ${isUser ? 'avatar-user' : 'avatar-assistant'}`}>
          {isUser ? 'U' : 'A'}
        </div>
      </div>
      <div className="message-content">
        {renderContent(message)}
        <div className="message-time">{formatTimestamp(message.timestamp)}</div>
      </div>
    </div>
  );
});

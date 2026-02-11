import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { MessageList } from '../components/Chat/MessageList';
import { ChatInput } from '../components/Chat/ChatInput';
import { useFileDrop } from '../hooks/useFileDrop';
import type { FileDropInfo } from '../hooks/useFileDrop';
import { useConversationStore } from '../stores/conversation';
import './ChatView.css';

export function ChatView(): ReactNode {
  const addUserMessage = useConversationStore((s) => s.addUserMessage);

  const handleFileDrop = useCallback(
    (files: FileDropInfo[]) => {
      const fileList = files.map((f) => f.path || f.name).join('\n');
      const message = `[Dropped files]\n${fileList}`;
      addUserMessage(message);
      window.api.chat(message).catch(console.error);
    },
    [addUserMessage]
  );

  const { isDragging, dragProps, error } = useFileDrop({
    onDrop: handleFileDrop,
    maxFiles: 10,
  });

  return (
    <div className="chat-view" {...dragProps}>
      {isDragging && (
        <div className="chat-drop-overlay">
          <div className="chat-drop-content">
            <span className="chat-drop-icon">&#x1F4C1;</span>
            <span>Drop files here</span>
          </div>
        </div>
      )}
      {error && <div className="chat-drop-error">{error}</div>}
      <MessageList />
      <ChatInput />
    </div>
  );
}

import type { ReactNode } from 'react';
import { MessageList } from '../components/Chat/MessageList';
import { ChatInput } from '../components/Chat/ChatInput';
import './ChatView.css';

export function ChatView(): ReactNode {
  return (
    <div className="chat-view">
      <MessageList />
      <ChatInput />
    </div>
  );
}

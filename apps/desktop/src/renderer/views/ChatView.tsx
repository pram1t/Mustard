import { useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { MessageList } from '../components/Chat/MessageList';
import { ChatInput } from '../components/Chat/ChatInput';
import { useFileDrop } from '../hooks/useFileDrop';
import type { FileDropInfo } from '../hooks/useFileDrop';
import { useConversationStore } from '../stores/conversation';
import './ChatView.css';

interface ChatViewProps {
  deepLinkParams?: Record<string, string>;
}

export function ChatView({ deepLinkParams }: ChatViewProps): ReactNode {
  const addUserMessage = useConversationStore((s) => s.addUserMessage);
  const setInput = useConversationStore((s) => s.setInput);

  // Pre-fill chat input from deep link ?message= param (don't auto-send)
  useEffect(() => {
    if (deepLinkParams?.message) {
      setInput(deepLinkParams.message);
    }
  }, [deepLinkParams?.message, setInput]);
  const [projectDir, setProjectDir] = useState<string | null>(null);

  const handleSelectFolder = useCallback(async () => {
    try {
      const folder = await window.api.selectFolder();
      if (folder) {
        setProjectDir(folder);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  }, []);

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

  const dirName = projectDir
    ? projectDir.split(/[\\/]/).pop() || projectDir
    : null;

  return (
    <div className="chat-view" {...dragProps}>
      <div className="chat-header">
        <button
          className="chat-folder-btn"
          onClick={handleSelectFolder}
          title={projectDir || 'Select a project folder'}
        >
          <span className="chat-folder-icon">&#128193;</span>
          {dirName ? (
            <span className="chat-folder-name">{dirName}</span>
          ) : (
            <span className="chat-folder-placeholder">Open Folder</span>
          )}
        </button>
        {projectDir && (
          <span className="chat-folder-path" title={projectDir}>
            {projectDir}
          </span>
        )}
      </div>
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

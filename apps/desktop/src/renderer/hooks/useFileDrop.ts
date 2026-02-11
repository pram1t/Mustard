/**
 * useFileDrop Hook
 *
 * Handles drag-and-drop file interactions in the renderer.
 * Files are sent to the main process via IPC for secure processing.
 * Uses HTML5 drag/drop API (no Node.js access in renderer).
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface FileDropInfo {
  name: string;
  path: string;
  size: number;
  type: string;
}

interface UseFileDropOptions {
  onDrop: (files: FileDropInfo[]) => void;
  accept?: string[];
  maxFiles?: number;
  maxSizeBytes?: number;
  disabled?: boolean;
}

interface UseFileDropReturn {
  isDragging: boolean;
  dragProps: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
  error: string | null;
}

const DEFAULT_MAX_FILES = 10;
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB

export function useFileDrop(options: UseFileDropOptions): UseFileDropReturn {
  const { onDrop, accept, maxFiles = DEFAULT_MAX_FILES, maxSizeBytes = DEFAULT_MAX_SIZE, disabled = false } = options;
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragCounterRef = useRef(0);

  // Reset error after 5 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounterRef.current++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;

      if (disabled) return;

      const droppedFiles = e.dataTransfer.files;
      if (!droppedFiles || droppedFiles.length === 0) return;

      // Validate file count
      if (droppedFiles.length > maxFiles) {
        setError(`Too many files. Maximum is ${maxFiles}.`);
        return;
      }

      const fileInfos: FileDropInfo[] = [];

      for (let i = 0; i < droppedFiles.length; i++) {
        const file = droppedFiles[i];

        // Validate size
        if (file.size > maxSizeBytes) {
          setError(`File "${file.name}" exceeds maximum size of ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`);
          return;
        }

        // Validate extension
        if (accept && accept.length > 0) {
          const ext = file.name.toLowerCase().split('.').pop() || '';
          if (!accept.some((a) => a.replace('.', '') === ext)) {
            setError(`File type ".${ext}" is not accepted.`);
            return;
          }
        }

        fileInfos.push({
          name: file.name,
          path: file.path || '',  // Electron populates file.path
          size: file.size,
          type: file.type,
        });
      }

      setError(null);
      onDrop(fileInfos);
    },
    [disabled, maxFiles, maxSizeBytes, accept, onDrop]
  );

  return {
    isDragging,
    dragProps: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
    error,
  };
}

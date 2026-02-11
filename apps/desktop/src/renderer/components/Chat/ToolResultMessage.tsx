import { useState } from 'react';
import type { ReactNode } from 'react';
import { formatToolResult } from '../../utils/markdown';

interface ToolResultData {
  name: string;
  result: unknown;
  error?: string;
  duration: number;
}

interface ToolResultMessageProps {
  data: ToolResultData;
}

export function ToolResultMessage({ data }: ToolResultMessageProps): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const hasError = !!data.error;

  return (
    <div className={`tool-result-message ${hasError ? 'error' : 'success'}`}>
      <button
        className="tool-result-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="tool-result-icon">{hasError ? '\u2717' : '\u2713'}</span>
        <span className="tool-result-name">{data.name}</span>
        <span className="tool-result-duration">{data.duration}ms</span>
        <span className="tool-result-toggle">
          {expanded ? '\u25BC' : '\u25B6'}
        </span>
      </button>
      {expanded && (
        <div className="tool-result-body">
          {hasError ? (
            <div className="tool-result-error">{data.error}</div>
          ) : (
            <pre>{formatToolResult(data.result)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import type { ReactNode } from 'react';

interface ToolCallData {
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolCallMessageProps {
  data: ToolCallData;
}

export function ToolCallMessage({ data }: ToolCallMessageProps): ReactNode {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="tool-call-message">
      <button
        className="tool-call-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="tool-call-icon">&#9881;</span>
        <span className="tool-call-name">{data.name}</span>
        <span className="tool-call-toggle">{expanded ? '\u25BC' : '\u25B6'}</span>
      </button>
      {expanded && (
        <div className="tool-call-body">
          <pre>{JSON.stringify(data.arguments, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

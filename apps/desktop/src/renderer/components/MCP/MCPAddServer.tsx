import { useState, useCallback } from 'react';
import type { ReactNode, FormEvent } from 'react';
import { Dialog } from '../Dialog';
import './MCP.css';

export function MCPAddServer(): ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setName('');
    setCommand('');
    setArgs('');
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !command.trim()) return;

      setSaving(true);
      setError(null);

      try {
        await window.api.setMCPServer({
          name: name.trim(),
          command: command.trim(),
          args: args.split(/\s+/).filter(Boolean),
        });
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add server');
      } finally {
        setSaving(false);
      }
    },
    [name, command, args, handleClose]
  );

  return (
    <>
      <button className="mcp-add-button" onClick={() => setIsOpen(true)}>
        + Add Server
      </button>

      <Dialog isOpen={isOpen} onClose={handleClose} title="Add MCP Server">
        <form onSubmit={handleSubmit} className="mcp-add-form">
          <div className="form-field">
            <label htmlFor="mcp-name">Name</label>
            <input
              id="mcp-name"
              type="text"
              className="settings-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., File System"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="mcp-command">Command</label>
            <input
              id="mcp-command"
              type="text"
              className="settings-input"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g., npx @modelcontextprotocol/server-filesystem"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="mcp-args">Arguments (space-separated)</label>
            <input
              id="mcp-args"
              type="text"
              className="settings-input"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="e.g., /path/to/directory"
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button
              type="button"
              className="settings-btn"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="settings-btn primary"
              disabled={saving}
            >
              {saving ? 'Adding...' : 'Add Server'}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

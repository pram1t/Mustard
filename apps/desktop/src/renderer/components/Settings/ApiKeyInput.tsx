import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import './Settings.css';

interface ApiKeyInputProps {
  providerId: string;
  hasKey: boolean;
  onKeyChanged?: () => void;
}

export function ApiKeyInput({ providerId, hasKey, onKeyChanged }: ApiKeyInputProps): ReactNode {
  const [showInput, setShowInput] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!value.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await window.api.setApiKey(providerId, value.trim());
      setValue('');
      setShowInput(false);
      onKeyChanged?.();
    } catch (err) {
      setError('Failed to save API key');
    } finally {
      setSaving(false);
    }
  }, [providerId, value, onKeyChanged]);

  const handleRemove = useCallback(async () => {
    setError(null);
    try {
      await window.api.removeApiKey(providerId);
      onKeyChanged?.();
    } catch (err) {
      setError('Failed to remove API key');
    }
  }, [providerId, onKeyChanged]);

  const handleCancel = useCallback(() => {
    setShowInput(false);
    setValue('');
    setError(null);
  }, []);

  if (hasKey && !showInput) {
    return (
      <div className="api-key-display">
        <span className="api-key-status">
          <span className="api-key-check">{'\u2713'}</span> API key configured
        </span>
        <div className="api-key-actions">
          <button className="settings-btn" onClick={() => setShowInput(true)}>
            Change
          </button>
          <button className="settings-btn danger" onClick={handleRemove}>
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="api-key-input">
      <div className="api-key-field">
        <input
          type="password"
          className="settings-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter API key"
          disabled={saving}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
        />
      </div>
      {error && <div className="api-key-error">{error}</div>}
      <div className="api-key-actions">
        <button
          className="settings-btn primary"
          onClick={handleSave}
          disabled={!value.trim() || saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {hasKey && (
          <button className="settings-btn" onClick={handleCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ProviderInfo, ModelInfo } from '../../../shared/preload-api';
import { ApiKeyInput } from './ApiKeyInput';
import './Settings.css';

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    const val = tokens / 1_000_000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}M tokens`;
  }
  if (tokens >= 1_000) {
    const val = tokens / 1_000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}K tokens`;
  }
  return `${tokens} tokens`;
}

export function ProviderSettings(): ReactNode {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [loading, setLoading] = useState(true);

  const loadProviders = useCallback(async () => {
    try {
      const [providerList, config] = await Promise.all([
        window.api.getProviders(),
        window.api.getConfig(),
      ]);
      setProviders(providerList);
      setSelectedProvider(config.provider);
      setSelectedModel(config.model);
    } catch (error) {
      console.error('Failed to load providers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    if (!selectedProvider) return;
    window.api.getModels(selectedProvider).then(setModels).catch(() => setModels([]));
  }, [selectedProvider]);

  const handleProviderChange = async (providerId: string) => {
    setSelectedProvider(providerId);
    setSelectedModel('');
    try {
      await window.api.setConfig({ provider: providerId } as any);
    } catch (error) {
      console.error('Failed to save provider:', error);
    }
  };

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    try {
      await window.api.setConfig({ model: modelId } as any);
    } catch (error) {
      console.error('Failed to save model:', error);
    }
  };

  if (loading) {
    return <div className="settings-loading">Loading...</div>;
  }

  const currentProvider = providers.find((p) => p.id === selectedProvider);

  return (
    <div className="provider-settings">
      <div className="settings-section">
        <h3>LLM Provider</h3>
        <select
          className="settings-select"
          value={selectedProvider}
          onChange={(e) => handleProviderChange(e.target.value)}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {currentProvider?.requiresApiKey && (
        <div className="settings-section">
          <h3>API Key</h3>
          <ApiKeyInput
            providerId={selectedProvider}
            hasKey={currentProvider.hasApiKey}
            onKeyChanged={loadProviders}
          />
        </div>
      )}

      {models.length > 0 && (
        <div className="settings-section">
          <h3>Model</h3>
          <select
            className="settings-select"
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
          >
            <option value="">Select a model</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({formatTokens(m.contextWindow)})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

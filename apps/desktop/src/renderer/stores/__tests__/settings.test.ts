import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../settings';

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      activeTab: 'provider',
      isLoading: false,
      error: null,
    });
  });

  it('has correct initial state', () => {
    const state = useSettingsStore.getState();
    expect(state.activeTab).toBe('provider');
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setActiveTab updates activeTab', () => {
    useSettingsStore.getState().setActiveTab('appearance');
    expect(useSettingsStore.getState().activeTab).toBe('appearance');

    useSettingsStore.getState().setActiveTab('shortcuts');
    expect(useSettingsStore.getState().activeTab).toBe('shortcuts');

    useSettingsStore.getState().setActiveTab('about');
    expect(useSettingsStore.getState().activeTab).toBe('about');
  });

  it('setLoading updates isLoading', () => {
    useSettingsStore.getState().setLoading(true);
    expect(useSettingsStore.getState().isLoading).toBe(true);

    useSettingsStore.getState().setLoading(false);
    expect(useSettingsStore.getState().isLoading).toBe(false);
  });

  it('setError updates error', () => {
    useSettingsStore.getState().setError('Something went wrong');
    expect(useSettingsStore.getState().error).toBe('Something went wrong');
  });

  it('setError can clear error with null', () => {
    useSettingsStore.getState().setError('Error');
    expect(useSettingsStore.getState().error).toBe('Error');

    useSettingsStore.getState().setError(null);
    expect(useSettingsStore.getState().error).toBeNull();
  });
});

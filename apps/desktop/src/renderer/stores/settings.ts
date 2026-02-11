import { create } from 'zustand';

export type SettingsTab = 'provider' | 'appearance' | 'shortcuts' | 'about';

export interface SettingsState {
  activeTab: SettingsTab;
  isLoading: boolean;
  error: string | null;
}

export interface SettingsActions {
  setActiveTab: (tab: SettingsTab) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  (set) => ({
    activeTab: 'provider',
    isLoading: false,
    error: null,

    setActiveTab: (tab) => set({ activeTab: tab }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
  }),
);

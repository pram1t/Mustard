import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'medium' | 'large';
export type Panel = 'chat' | 'history' | 'mcp' | 'settings';

export interface UIState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  fontSize: FontSize;
  sidebarCollapsed: boolean;
  activePanel: Panel;
}

export interface UIActions {
  setTheme: (theme: Theme) => void;
  setFontSize: (fontSize: FontSize) => void;
  toggleSidebar: () => void;
  setActivePanel: (panel: Panel) => void;
}

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set) => ({
      theme: 'system',
      resolvedTheme: 'dark',
      fontSize: 'medium',
      sidebarCollapsed: false,
      activePanel: 'chat',

      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setActivePanel: (activePanel) => set({ activePanel }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);

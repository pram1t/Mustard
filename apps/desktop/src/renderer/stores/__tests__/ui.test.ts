import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../ui';

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      theme: 'system',
      resolvedTheme: 'dark',
      fontSize: 'medium',
      sidebarCollapsed: false,
      activePanel: 'chat',
    });
  });

  it('has correct initial state', () => {
    const state = useUIStore.getState();
    expect(state.theme).toBe('system');
    expect(state.resolvedTheme).toBe('dark');
    expect(state.fontSize).toBe('medium');
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.activePanel).toBe('chat');
  });

  it('setTheme updates theme', () => {
    useUIStore.getState().setTheme('light');
    expect(useUIStore.getState().theme).toBe('light');

    useUIStore.getState().setTheme('dark');
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('setFontSize updates fontSize', () => {
    useUIStore.getState().setFontSize('large');
    expect(useUIStore.getState().fontSize).toBe('large');

    useUIStore.getState().setFontSize('small');
    expect(useUIStore.getState().fontSize).toBe('small');
  });

  it('toggleSidebar toggles sidebarCollapsed', () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('setActivePanel updates activePanel', () => {
    useUIStore.getState().setActivePanel('settings');
    expect(useUIStore.getState().activePanel).toBe('settings');

    useUIStore.getState().setActivePanel('mcp');
    expect(useUIStore.getState().activePanel).toBe('mcp');
  });
});

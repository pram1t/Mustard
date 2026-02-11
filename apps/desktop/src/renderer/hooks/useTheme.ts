import { useEffect } from 'react';
import { useUIStore } from '../stores/ui';
import type { Theme } from '../stores/ui';

export function resolveTheme(
  theme: Theme,
  prefersDark: boolean,
): 'light' | 'dark' {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  return prefersDark ? 'dark' : 'light';
}

export function useTheme(): void {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateTheme = () => {
      const resolved = resolveTheme(theme, mediaQuery.matches);
      useUIStore.setState({ resolvedTheme: resolved });

      const root = document.documentElement;
      root.classList.remove('theme-light', 'theme-dark');
      root.classList.add(`theme-${resolved}`);
    };

    updateTheme();
    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [theme]);
}

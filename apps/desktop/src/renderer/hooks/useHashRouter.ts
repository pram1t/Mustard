import { useState, useCallback, useRef, useEffect } from 'react';

export type Route = '/' | '/settings' | '/mcp' | '/history' | '/about';

const VALID_ROUTES: Route[] = ['/', '/settings', '/mcp', '/history', '/about'];

export function getRouteFromHash(hash: string): Route {
  const path = hash.replace('#', '') || '/';
  return VALID_ROUTES.includes(path as Route) ? (path as Route) : '/';
}

export function useHashRouter() {
  const [route, setRoute] = useState<Route>(() =>
    getRouteFromHash(window.location.hash),
  );
  const historyRef = useRef<Route[]>([]);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(getRouteFromHash(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback(
    (to: Route) => {
      historyRef.current.push(route);
      window.location.hash = to;
    },
    [route],
  );

  const goBack = useCallback(() => {
    const prev = historyRef.current.pop() ?? '/';
    window.location.hash = prev;
  }, []);

  return { route, navigate, goBack };
}

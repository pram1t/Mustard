import { useState, useCallback, useRef, useEffect } from 'react';

export type Route = '/' | '/chat' | '/settings' | '/mcp' | '/history' | '/about';

const VALID_ROUTES: Route[] = ['/', '/chat', '/settings', '/mcp', '/history', '/about'];

export interface RouteInfo {
  route: Route;
  params: Record<string, string>;
}

export function getRouteFromHash(hash: string): RouteInfo {
  const raw = hash.replace(/^#/, '') || '/';
  const qIndex = raw.indexOf('?');
  const path = qIndex >= 0 ? raw.substring(0, qIndex) : raw;
  const route = VALID_ROUTES.includes(path as Route) ? (path as Route) : '/';

  const params: Record<string, string> = {};
  if (qIndex >= 0) {
    const search = new URLSearchParams(raw.substring(qIndex + 1));
    for (const [key, value] of search) {
      params[key] = value;
    }
  }

  return { route, params };
}

export function useHashRouter() {
  const [routeInfo, setRouteInfo] = useState<RouteInfo>(() =>
    getRouteFromHash(window.location.hash),
  );
  const historyRef = useRef<Route[]>([]);

  useEffect(() => {
    const handleHashChange = () => {
      setRouteInfo(getRouteFromHash(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback(
    (to: Route) => {
      historyRef.current.push(routeInfo.route);
      window.location.hash = to;
    },
    [routeInfo.route],
  );

  const goBack = useCallback(() => {
    const prev = historyRef.current.pop() ?? '/';
    window.location.hash = prev;
  }, []);

  return { route: routeInfo.route, params: routeInfo.params, navigate, goBack };
}

import { useEffect } from 'react';
import type { NavigatePayload } from '../../shared/preload-api';

/**
 * Subscribes to navigate events from the main process
 * (deep links, tray menu) and converts them to hash navigation.
 */
export function useNavigateSubscription(): void {
  useEffect(() => {
    if (typeof window.api?.onNavigate !== 'function') {
      return;
    }

    const unsubscribe = window.api.onNavigate((payload: NavigatePayload) => {
      const { route, params } = payload;
      const search = new URLSearchParams(params).toString();
      const hash = search ? `${route}?${search}` : route;
      window.location.hash = hash;
    });

    return unsubscribe;
  }, []);
}

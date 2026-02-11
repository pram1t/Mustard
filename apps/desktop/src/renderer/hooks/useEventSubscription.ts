import { useEffect } from 'react';

/**
 * Subscribes to agent events from the main process.
 * Stub implementation - full event handling comes in Phase 4+.
 */
export function useEventSubscription(): void {
  useEffect(() => {
    if (typeof window.api?.onEvent !== 'function') {
      return;
    }

    const unsubscribe = window.api.onEvent((event) => {
      console.log('Agent event:', event.type);
    });

    return unsubscribe;
  }, []);
}

import { useEffect } from 'react';
import { useConversationStore } from '../stores/conversation';

/**
 * Subscribes to agent events from the main process
 * and feeds them to the conversation store.
 */
export function useEventSubscription(): void {
  const handleEvent = useConversationStore((s) => s.handleEvent);

  useEffect(() => {
    if (typeof window.api?.onEvent !== 'function') {
      return;
    }

    const unsubscribe = window.api.onEvent(handleEvent);
    return unsubscribe;
  }, [handleEvent]);
}

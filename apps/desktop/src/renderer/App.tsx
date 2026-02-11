import type { ReactNode } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout/Layout';
import { Router } from './components/Router';
import { useTheme } from './hooks/useTheme';
import { useEventSubscription } from './hooks/useEventSubscription';

function App(): ReactNode {
  useTheme();
  useEventSubscription();

  return (
    <ErrorBoundary>
      <Layout>
        <Router />
      </Layout>
    </ErrorBoundary>
  );
}

export default App;

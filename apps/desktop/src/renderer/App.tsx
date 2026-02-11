import type { ReactNode } from 'react';

function App(): ReactNode {
  return (
    <div className="app">
      <header className="app-header">
        <h1>OpenAgent</h1>
      </header>
      <main className="app-main">
        <p className="app-placeholder">Ready</p>
      </main>
    </div>
  );
}

export default App;

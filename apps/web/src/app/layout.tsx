import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpenAgent — Visual Workspace',
  description: 'Multi-worker AI development team dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen">
        <div className="flex h-screen">
          <nav className="w-56 bg-zinc-900 border-r border-zinc-800 p-4 flex flex-col gap-2">
            <h1 className="text-lg font-bold mb-4 text-cyan-400">OpenAgent</h1>
            <a href="/" className="px-3 py-2 rounded hover:bg-zinc-800 text-sm">Dashboard</a>
            <a href="/workers" className="px-3 py-2 rounded hover:bg-zinc-800 text-sm">Workers</a>
            <a href="/tasks" className="px-3 py-2 rounded hover:bg-zinc-800 text-sm">Tasks</a>
            <a href="/request" className="px-3 py-2 rounded hover:bg-zinc-800 text-sm">New Request</a>
            <a href="/artifacts" className="px-3 py-2 rounded hover:bg-zinc-800 text-sm">Artifacts</a>
            <a href="/collab" className="px-3 py-2 rounded hover:bg-zinc-800 text-sm">Collab</a>
            <div className="mt-auto pt-4 border-t border-zinc-800 text-xs text-zinc-500">
              <a href="/api/ws" className="hover:text-zinc-400">API: localhost:3100</a>
            </div>
          </nav>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

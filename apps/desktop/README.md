# OpenAgent Desktop

Desktop application for OpenAgent, built with Electron and React.

## Architecture

- **Main Process**: Node.js runtime with full system access, hosts @openagent/core
- **Preload Script**: Isolated bridge between main and renderer
- **Renderer Process**: Sandboxed React application, communicates only via `window.api`

## Prerequisites

- Node.js 22+
- npm 10+

## Development

```bash
# From repository root
npm install

# Start development server with hot reload
npm run dev --workspace=apps/desktop

# Or via turbo
npx turbo run dev --filter=openagent-desktop
```

## Build

```bash
# Development build
npm run build --workspace=apps/desktop

# Type checking
npm run typecheck --workspace=apps/desktop
```

## Security

See [SECURITY.md](./SECURITY.md) for security policies.

All renderer code runs in a sandboxed Chromium process with:
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Content Security Policy enforced via meta tag

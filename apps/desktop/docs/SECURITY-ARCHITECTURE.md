# Security Architecture

## Process Model

See `src/main/process-model.md` for trust boundary documentation.

## Security Controls

### 1. Context Isolation
- `contextIsolation: true` - Prevents renderer from accessing Electron/Node.js
- Verified at startup in development mode via `verify-isolation.ts`

### 2. Node Integration Disabled
- `nodeIntegration: false` - No Node.js in renderer
- `nodeIntegrationInWorker: false` - No Node.js in workers
- `nodeIntegrationInSubFrames: false` - No Node.js in iframes

### 3. Sandbox Enabled
- `sandbox: true` per window via webPreferences
- `app.enableSandbox()` enforced globally before app ready

### 4. Web Security
- `webSecurity: true` - Same-origin policy enforced
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`
- Permission handler: default-deny for most Electron permissions

### 5. DevTools Control
- Enabled only in development (`!app.isPackaged`)
- Disabled in production builds (blocked on open + keyboard shortcut prevented)

### 6. Navigation Restrictions
- `will-navigate` blocks all non-file/app protocols
- `setWindowOpenHandler` denies all new window creation

### 7. Single Instance
- `requestSingleInstanceLock` in production prevents duplicate instances

### 8. App-Level Hardening
- `ELECTRON_RUN_AS_NODE` env var deleted
- Remote debugging port disabled in production
- Autoplay requires user gesture

### 9. Content Security Policy
- Belt-and-suspenders: CSP meta tag in HTML + CSP HTTP header from main process
- Production: no `unsafe-eval`, no `unsafe-inline` for scripts
- Development: relaxed for Vite HMR (`unsafe-inline` scripts, `ws:`/`wss:`)
- `unsafe-inline` allowed for `style-src` only (React requirement)
- CSP violations logged to renderer console via `securitypolicyviolation` listener
- See `docs/RENDERER-SECURITY.md` for full policy details

### 10. Permission Handler (Upgraded)
- 17 explicit permission decisions (grant/deny/prompt)
- WebContents origin verification (rejects non-main-window requests)
- Default deny for unknown permissions

## Module Layout

```
src/main/
  security/
    app-security.ts     - Pre-ready app security (env vars, CLI switches)
    boundaries.ts       - Trust boundary capability definitions
    devtools.ts         - DevTools access control
    sandbox.ts          - Global sandbox enforcement
    verify-isolation.ts - Dev-mode context isolation verification
    web-security.ts     - Session security (CSP + headers, permission handler)
  window/
    defaults.ts         - Secure BrowserWindow defaults
    factory.ts          - Window creation factory (validates security)
    index.ts            - Main window reference management
    state.ts            - Window state persistence
  ipc/
    index.ts            - IPC handler registration
  index.ts              - Slim orchestrator
src/shared/
  csp.ts                - CSP directives, builder, environment selector
src/renderer/
  utils/csp-reporter.ts - CSP violation console logging
  components/ErrorBoundary.tsx - React error boundary
```

## Verification

```bash
# Type check all security modules
npm run typecheck --workspace=@pram1t/mustard-desktop

# Build
npm run build --workspace=@pram1t/mustard-desktop

# Dev mode (check console for security verification output)
npm run dev --workspace=@pram1t/mustard-desktop
```

Expected console output in dev mode:
- "Sandbox mode enforced for all renderers"
- "Web security configured (CSP + security headers)"
- "Permission handler configured"
- "Context isolation verified: ['getAppInfo']"

## Audit Checklist

- [ ] contextIsolation: true
- [ ] nodeIntegration: false
- [ ] sandbox: true
- [ ] webSecurity: true
- [ ] webviewTag: false
- [ ] DevTools disabled in production
- [ ] CSP meta tag in renderer/index.html (production)
- [ ] CSP HTTP header from main process (environment-aware)
- [ ] No unsafe-eval in production CSP
- [ ] Navigation restricted
- [ ] Permission handler default-deny with origin verification
- [ ] Single instance enforced in production
- [ ] ELECTRON_RUN_AS_NODE deleted

# Security Policy

## Electron Version

We pin Electron to an exact version (currently 34.1.0). Version updates require:

1. Security review of the changelog
2. Verification that all security fixes are included
3. Testing on all three platforms (Windows, macOS, Linux)
4. Update of this document with the new version

## Process Model Security

| Setting | Value | Reason |
|---------|-------|--------|
| contextIsolation | true | Prevents renderer from accessing Node.js |
| nodeIntegration | false | No require() in renderer |
| sandbox | true | OS-level process sandboxing |
| webSecurity | true | Enforces same-origin policy |
| webviewTag | false | Prevents embedded webview attacks |
| nodeIntegrationInWorker | false | No Node.js in web workers |
| nodeIntegrationInSubFrames | false | No Node.js in iframes |

## Content Security Policy

The renderer enforces a strict CSP:
- `default-src 'self'`
- `script-src 'self'` (no unsafe-inline, no unsafe-eval)
- `object-src 'none'`
- `frame-src 'none'`

## IPC Security

- Strict channel allowlist (< 20 channels)
- All channels defined in `src/shared/ipc-channels.ts`
- No dynamic channel creation
- Sender validation on all handlers (Phase 4+)

## Dependencies

- All dependencies documented in `docs/DEPENDENCIES.md`
- `npm audit` runs in CI
- Dependabot monitors for vulnerabilities
- Postinstall scripts audited (see `docs/POSTINSTALL-SCRIPTS.md`)

## Reporting

Report security issues to the project maintainers via GitHub Security Advisories.

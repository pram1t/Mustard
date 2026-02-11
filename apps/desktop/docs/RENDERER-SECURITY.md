# Renderer Security

## Content Security Policy

The renderer enforces a strict CSP via two mechanisms (belt-and-suspenders):
1. **Meta tag** in `src/renderer/index.html` - production CSP, always present
2. **HTTP header** from `configureWebSecurity()` in main process - environment-aware (dev/prod)

### Production CSP

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' https:;
media-src 'none';
object-src 'none';
frame-src 'none';
worker-src 'self' blob:;
base-uri 'self';
form-action 'self';
frame-ancestors 'none'
```

- **No `unsafe-eval`**: `eval()` and `new Function()` are blocked
- **No `unsafe-inline` for scripts**: All JavaScript must be in separate files
- **`unsafe-inline` for styles**: Required by React for inline style operations
- **HTTPS only for connections**: External API calls must use HTTPS

### Development CSP

Relaxed to allow Vite HMR:
- `script-src` adds `'unsafe-inline'` (Vite injects HMR scripts)
- `connect-src` adds `ws:` and `wss:` (WebSocket for hot reload)

### CSP Violation Reporting

CSP violations are logged to the renderer console via `securitypolicyviolation` event listener. Check DevTools console for `[CSP Violation]` warnings.

## Permissions

Most browser permissions are denied by default.

| Permission | Decision | Notes |
|---|---|---|
| media (camera/mic) | Deny | Not needed |
| display-capture | Deny | Not needed |
| geolocation | Deny | Not needed |
| midi / midiSysex | Deny | Not needed |
| pointerLock | Deny | Not needed |
| idle-detection | Deny | Not needed |
| clipboard-read | Deny | Security risk |
| hid / serial / usb | Deny | Not needed |
| fullscreen | Grant | Window management |
| clipboard-write | Grant | Copy to clipboard |
| storage-access | Grant | Local storage |
| window-placement | Grant | Window positioning |
| notifications | Prompt | Not yet implemented |
| openExternal | Prompt | Not yet implemented |

All permission requests from non-main-window webContents are denied.

## React Security

- **ErrorBoundary** wraps the entire app to catch rendering errors
- No `eval()` or `new Function()` usage
- All external content must go through the preload API
- Type-safe `window.api` interface (defined in `preload-api.ts`)

## Build Security

- `assetsInlineLimit: 0` prevents Vite from inlining assets as data URIs
- `inlineDynamicImports: false` prevents combining code into single chunks
- `minify: 'esbuild'` with `target: 'esnext'` for CSP-compliant output

## Verification

In DevTools console:
1. Check for `[CSP Violation]` warnings (should be none)
2. Run `eval('1+1')` - should be blocked by CSP
3. Check Network tab response headers for `Content-Security-Policy`

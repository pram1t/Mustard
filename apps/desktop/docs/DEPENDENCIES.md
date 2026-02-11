# Dependencies

## Production Dependencies

| Package | Version | Purpose | Security Notes |
|---------|---------|---------|----------------|
| @openagent/core | workspace | Agent functionality | Internal package |
| @openagent/config | workspace | Configuration management | Internal package |
| react | 19.2.4 | UI framework | Pinned exact, security patch included |
| react-dom | 19.2.4 | React DOM rendering | Pinned exact, matches React |

## Development Dependencies

| Package | Version | Purpose | Security Notes |
|---------|---------|---------|----------------|
| electron | 34.1.0 | Desktop runtime | Pinned exact, reviewed |
| electron-vite | ^4.0.1 | Build tooling | Reviewed, Vite 5 based |
| electron-builder | ^24.13.3 | App packaging | Reviewed |
| @vitejs/plugin-react | ^4.3.0 | Vite React support | Reviewed |
| @types/react | ^19.0.0 | TypeScript types | Dev only |
| @types/react-dom | ^19.0.0 | TypeScript types | Dev only |
| typescript | ^5.9.3 | Type checking | Dev only |
| @cyclonedx/cyclonedx-npm | ^4.1.2 | SBOM generation | Dev only |

## Dependency Review Checklist

Before adding a new dependency:

- [ ] Check `npm audit` for known vulnerabilities
- [ ] Review package on npm (downloads, maintenance, last publish date)
- [ ] Check GitHub issues for security reports
- [ ] Review postinstall scripts (if any)
- [ ] Check license compatibility (MIT, Apache 2.0, etc.)
- [ ] Consider if the functionality can be implemented in-house
- [ ] Ensure the package does not pull in excessive transitive dependencies

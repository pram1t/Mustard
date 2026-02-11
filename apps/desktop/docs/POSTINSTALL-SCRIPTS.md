# Allowed Postinstall Scripts

Only these packages are permitted to run postinstall scripts:

| Package | Script | Purpose |
|---------|--------|---------|
| electron | install.js | Downloads Electron binary for current platform |
| @electron/rebuild | (if used) | Rebuilds native Node modules for Electron |
| esbuild | (transitive) | Downloads platform-specific binary |

All other postinstall scripts must be reviewed before allowing.

## Audit Process

1. After adding a new dependency, check for packages with install/postinstall scripts
2. Review any new scripts against this allowlist
3. Document any newly allowed scripts in this file

/**
 * Validates that the Electron version in package.json is pinned exactly.
 * Run: npx tsx apps/desktop/scripts/check-electron-version.ts
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkgPath = resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const electronVersion = pkg.devDependencies?.electron;

if (!electronVersion) {
  console.error('ERROR: electron is not listed in devDependencies');
  process.exit(1);
}

if (!electronVersion.match(/^\d+\.\d+\.\d+$/)) {
  console.error(
    `ERROR: Electron version must be pinned exactly (e.g., "34.1.0"), got "${electronVersion}"`
  );
  process.exit(1);
}

console.log(`OK: Electron version pinned to ${electronVersion}`);

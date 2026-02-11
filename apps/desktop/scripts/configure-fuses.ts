/**
 * Electron Fuses Configuration
 *
 * Configures Electron fuses (build-time security flags) for the packaged app.
 * Run after electron-builder packages the app.
 *
 * Run: npx tsx apps/desktop/scripts/configure-fuses.ts <path-to-electron-binary>
 *
 * Fuses configured:
 * - RunAsNode → false (prevent using Electron as plain Node)
 * - EnableNodeOptionsEnvironmentVariable → false (prevent NODE_OPTIONS injection)
 * - EnableNodeCliInspectArguments → false (prevent --inspect in production)
 * - EnableEmbeddedAsarIntegrity → true (validate ASAR integrity)
 * - OnlyLoadAppFromAsar → true (prevent loading from filesystem)
 *
 * @see https://www.electronjs.org/docs/latest/tutorial/fuses
 */

// NOTE: This script requires @electron/fuses to be installed as a devDependency.
// It is meant to be run as a post-build step.
//
// Install: npm install --save-dev @electron/fuses
//
// Usage after build:
//   npx tsx scripts/configure-fuses.ts ./dist/win-unpacked/OpenAgent.exe
//   npx tsx scripts/configure-fuses.ts ./dist/mac/OpenAgent.app/Contents/Frameworks/Electron Framework.framework/Electron Framework
//   npx tsx scripts/configure-fuses.ts ./dist/linux-unpacked/openagent

console.log('='.repeat(60));
console.log('Electron Fuses Configuration');
console.log('='.repeat(60));

const binaryPath = process.argv[2];

if (!binaryPath) {
  console.log('');
  console.log('Usage: npx tsx scripts/configure-fuses.ts <path-to-electron-binary>');
  console.log('');
  console.log('This script configures Electron fuses for security hardening.');
  console.log('Run it as a post-build step after electron-builder packages the app.');
  console.log('');
  console.log('Required dependency: npm install --save-dev @electron/fuses');
  console.log('');
  console.log('Fuses to be configured:');
  console.log('  RunAsNode                           → DISABLE');
  console.log('  EnableNodeOptionsEnvironmentVariable → DISABLE');
  console.log('  EnableNodeCliInspectArguments        → DISABLE');
  console.log('  EnableEmbeddedAsarIntegrity          → ENABLE');
  console.log('  OnlyLoadAppFromAsar                  → ENABLE');
  console.log('');
  console.log('='.repeat(60));
  process.exit(0);
}

async function configureFuses(): Promise<void> {
  try {
    const { flipFuses, FuseVersion, FuseV1Options } = await import('@electron/fuses');

    await flipFuses(binaryPath, {
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    });

    console.log(`✓ Fuses configured for: ${binaryPath}`);
  } catch (error) {
    if ((error as Error).message?.includes("Cannot find module '@electron/fuses'")) {
      console.error('ERROR: @electron/fuses is not installed.');
      console.error('Install it: npm install --save-dev @electron/fuses');
      process.exit(1);
    }
    console.error('ERROR: Failed to configure fuses:', error);
    process.exit(1);
  }
}

configureFuses();

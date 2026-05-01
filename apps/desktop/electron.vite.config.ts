import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// @pram1t/mustard-* workspace packages must be bundled (not externalized) because
// @pram1t/mustard-logger uses "type": "module" (ESM) while core/config/etc use CJS.
// Electron's require() cannot load ESM, so vite must resolve the mismatch at build time.
// We alias each package to its TypeScript source so vite can bundle from source directly,
// avoiding CJS/ESM interop issues with pre-built dist/ output.
const OPENAGENT_PACKAGES = [
  '@pram1t/mustard-config',
  '@pram1t/mustard-core',
  '@pram1t/mustard-hooks',
  '@pram1t/mustard-llm',
  '@pram1t/mustard-logger',
  '@pram1t/mustard-mcp',
  '@pram1t/mustard-tools',
];

// Pino uses thread-stream which spawns Worker threads from file paths (lib/worker.js).
// These packages are fundamentally incompatible with bundling and must stay external.
// They're added via the `include` option so externalizeDepsPlugin keeps them external
// even though they're not direct dependencies of the desktop app.
const FORCE_EXTERNAL = [
  'pino',
  'pino-pretty',
  'thread-stream',
  'pino-abstract-transport',
  'sonic-boom',
];

const workspaceAliases = Object.fromEntries(
  OPENAGENT_PACKAGES.map((pkg) => [
    pkg,
    resolve(__dirname, `../../packages/${pkg.replace('@pram1t/mustard-', '')}/src/index.ts`),
  ])
);

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: OPENAGENT_PACKAGES,
        include: FORCE_EXTERNAL,
      }),
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
        },
      },
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        ...workspaceAliases,
      },
    },
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        exclude: OPENAGENT_PACKAGES,
        include: FORCE_EXTERNAL,
      }),
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
        },
      },
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        ...workspaceAliases,
      },
    },
  },
  renderer: {
    plugins: [
      react({
        jsxRuntime: 'automatic',
      }),
    ],
    root: resolve(__dirname, 'src/renderer'),
    build: {
      minify: 'esbuild',
      target: 'esnext',
      assetsInlineLimit: 0,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
        },
        output: {
          inlineDynamicImports: false,
        },
      },
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },
});

import { app } from 'electron';

/**
 * Enforces sandbox mode for all renderers.
 * Must be called before app is ready.
 */
export function enforceSandbox(): void {
  app.enableSandbox();
  console.log('Sandbox mode enforced for all renderers');
}

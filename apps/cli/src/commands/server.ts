/**
 * Mustard CLI - Server Command
 *
 * Start the Mustard API server.
 *   server start [options]   — Start the HTTP/WebSocket API server
 */

import type { LLMRouter } from '@pram1t/mustard-llm';
import type { IToolRegistry } from '@pram1t/mustard-tools';
import { EventBus } from '@pram1t/mustard-message-bus';
import { startServer } from '@pram1t/mustard-server';

export type ServerAction = 'start';

export interface ServerCommandOptions {
  router: LLMRouter;
  tools: IToolRegistry;
  port?: number;
  host?: string;
  apiKey?: string;
  maxWorkers?: number;
  verbose: boolean;
}

/**
 * Execute the server command.
 */
export async function serverCommand(
  action: ServerAction = 'start',
  options: ServerCommandOptions,
): Promise<void> {
  switch (action) {
    case 'start':
      await startServerCommand(options);
      break;
    default:
      console.error(`Unknown server action: ${action}`);
      process.exit(1);
  }
}

async function startServerCommand(options: ServerCommandOptions): Promise<void> {
  const bus = new EventBus();

  console.log('Starting Mustard API server...\n');

  try {
    const app = await startServer(
      {
        port: options.port ?? 3100,
        host: options.host ?? '127.0.0.1',
        cors: true,
        apiKey: options.apiKey,
        maxParallelWorkers: options.maxWorkers ?? 3,
      },
      {
        router: options.router,
        tools: options.tools,
        bus,
      },
    );

    if (options.verbose) {
      console.log(`  API Key: ${options.apiKey ? 'configured' : 'none (open access)'}`);
      console.log(`  Max workers: ${options.maxWorkers ?? 3}`);
      console.log('');
    }

    console.log('Endpoints:');
    console.log('  POST /api/requests          Submit a request');
    console.log('  GET  /api/plans/:id         Get plan details');
    console.log('  POST /api/plans/:id/approve Approve and execute');
    console.log('  POST /api/plans/:id/reject  Reject a plan');
    console.log('  GET  /api/workers           List workers');
    console.log('  GET  /api/tasks             List tasks');
    console.log('  GET  /api/artifacts         List artifacts');
    console.log('  GET  /api/ws                WebSocket events');
    console.log('  GET  /health                Health check');
    console.log('');
    console.log('Press Ctrl+C to stop.');

    // Keep process alive
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await app.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await app.close();
      process.exit(0);
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to start server: ${errorMsg}`);
    process.exit(1);
  }
}

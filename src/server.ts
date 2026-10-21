import { serve } from '@hono/node-server';
import { runtimeConfig } from './config.js';
import { createShutdown } from './shutdown.js';

const config = runtimeConfig(process.env);
const { createApp } = await import('./app.js');
const { pool } = await import('./db/pool.js');

const app = createApp(config);

// The Node adapter lets our Hono app receive HTTP requests.
const server = serve(
  { fetch: app.fetch, hostname: config.hostname, port: config.port },
  (info) => {
    console.log(`Nora API listening at http://${config.hostname}:${info.port}`);
  },
);

// Repeated signals share one drain-and-cleanup sequence.
const shutdown = createShutdown(server, pool);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, shutdown);
}

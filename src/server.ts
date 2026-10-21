import { serve } from '@hono/node-server';
import { runtimeConfig } from './config.js';

const config = runtimeConfig(process.env);
const { createApp } = await import('./app.js');

const app = createApp(config);

// The Node adapter lets our Hono app receive HTTP requests.
const server = serve(
  { fetch: app.fetch, hostname: config.hostname, port: config.port },
  (info) => {
    console.log(`Nora API listening at http://${config.hostname}:${info.port}`);
  },
);

// Release the port when the development server stops or restarts.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close((error) => {
      if (error) console.error(error);
      process.exit(error ? 1 : 0);
    });
  });
}

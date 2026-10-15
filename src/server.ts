import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const app = createApp({
  secret: process.env.AUTH_SECRET ?? '',
  ownerId: process.env.AUTH_OWNER_ID ?? '',
});

// The Node adapter lets our Hono app receive HTTP requests.
const server = serve(
  { fetch: app.fetch, hostname: '127.0.0.1', port: 3000 },
  (info) => {
    console.log(`Nora API listening at http://localhost:${info.port}`);
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

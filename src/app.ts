import { Hono } from 'hono';

const app = new Hono();

// A route connects an HTTP method and URL to a response.
app.get('/health', (c) => {
  return c.json({ service: 'nora-synth-api', status: 'ok' });
});

export default app;

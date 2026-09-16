import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { createPresetInputSchema } from './schemas/preset.js';

const app = new Hono();

// A route connects an HTTP method and URL to a response.
app.get('/health', (c) => {
  return c.json({ service: 'nora-synth-api', status: 'ok' });
});

app.post('/v1/presets/validate', 
  zValidator('json', createPresetInputSchema),
  (c) => {
    const preset = c.req.valid('json')
    return c.json({ data: preset })
  }
)

export default app;

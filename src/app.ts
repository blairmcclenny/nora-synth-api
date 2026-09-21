import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createPresetInputSchema } from './schemas/preset.js';

const app = new Hono();

// A route connects an HTTP method and URL to a response.
app.get('/health', (c) => {
  return c.json({ service: 'nora-synth-api', status: 'ok' });
});

app.post(
  '/v1/presets/validate',
  zValidator('json', createPresetInputSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Preset contains invalid values.',
            details: result.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        400,
      );
    }
  }),
  (c) => {
    const preset = c.req.valid('json');
    return c.json({ data: preset });
  },
);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    if (err.status === 400) {
      return c.json(
        {
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must contain valid JSON.',
          },
        },
        400,
      );
    }

    return err.getResponse();
  }

  console.error(err);

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    },
    500,
  );
});

export default app;

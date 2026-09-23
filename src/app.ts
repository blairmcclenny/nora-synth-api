import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createPresetInputSchema, presetListInputSchema } from './schemas/preset.js';
import { createPreset, getPresetById, listPresets } from './repositories/presets.js';
import z from 'zod';

const app = new Hono();

// A route connects an HTTP method and URL to a response.
app.get('/health', (c) => {
  return c.json({ service: 'nora-synth-api', status: 'ok' });
});

app.get('/v1/presets/:id', async (c) => {
  const id = c.req.param('id');
  const result = z.uuid().safeParse(id);

  if (!result.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Preset ID must be a valid UUID.',
        },
      },
      400,
    );
  }

  const preset = await getPresetById(result.data);

  if (!preset) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Preset not found.',
        },
      },
      404,
    );
  }

  return c.json(preset, 200);
});

app.get('/v1/presets', 
  zValidator('query', presetListInputSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid limit or offset values.',
            details: result.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            }))
          }
        }, 400
      )
    }
  }),
  async (c) => {
  const { limit, offset } = c.req.valid('query')
  const { items, total } = await listPresets(limit, offset)

  return c.json({ items, limit, offset, total }, 200)
})

app.post(
  '/v1/presets',
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
  async (c) => {
    const input = c.req.valid('json');
    const preset = await createPreset(input);

    c.header('Location', `/v1/presets/${preset.id}`);
    return c.json(preset, 201);
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

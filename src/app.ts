import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { requireAuth, type AuthEnv } from './middleware/require-auth.js';
import { routes } from './openapi.js';
import {
  createPreset,
  deletePresetById,
  getPresetById,
  listPresets,
  renamePresetById,
  updatePresetById,
} from './repositories/presets.js';

const notFound = { error: { code: 'NOT_FOUND' as const, message: 'Preset not found.' } };

export function createApp(config: { secret: string; ownerId: string }) {
  if (!config.ownerId || config.ownerId.trim() !== config.ownerId) {
    throw new Error('Authentication owner ID must be nonempty with no surrounding whitespace.');
  }
  const app = new OpenAPIHono<AuthEnv>({
    defaultHook: (result, c) => {
      if (result.success) return;
      const isParam = result.target === 'param';
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: isParam
              ? 'Preset ID must be a valid UUID.'
              : result.target === 'query'
                ? 'Invalid limit or offset values.'
                : 'Preset contains invalid values.',
            ...(!isParam
              ? {
                  details: result.error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                  })),
                }
              : {}),
          },
        },
        400,
      );
    },
  });
  const authenticate = requireAuth(config.secret, config.ownerId);
  app.use('/v1/presets', authenticate);
  app.use('/v1/presets/*', authenticate);

  app.openapi(routes.health, (c) =>
    c.json({ service: 'nora-synth-api' as const, status: 'ok' as const }, 200),
  );

  app.openapi(routes.get, async (c) => {
    const preset = await getPresetById(c.req.valid('param').id, c.get('ownerId'));
    return preset ? c.json(preset, 200) : c.json(notFound, 404);
  });

  app.openapi(routes.list, async (c) => {
    const { limit, offset } = c.req.valid('query');
    const { items, total } = await listPresets(limit, offset, c.get('ownerId'));
    return c.json({ items, limit, offset, total }, 200);
  });

  app.openapi(routes.create, async (c) => {
    const preset = await createPreset(c.req.valid('json'), c.get('ownerId'));
    c.header('Location', `/v1/presets/${preset.id}`);
    return c.json(preset, 201);
  });

  app.openapi(routes.delete, async (c) => {
    const deleted = await deletePresetById(c.req.valid('param').id, c.get('ownerId'));
    return deleted ? c.body(null, 204) : c.json(notFound, 404);
  });

  app.openapi(routes.rename, async (c) => {
    const preset = await renamePresetById(
      c.req.valid('param').id,
      c.req.valid('json').name,
      c.get('ownerId'),
    );
    return preset ? c.json(preset, 200) : c.json(notFound, 404);
  });

  app.openapi(routes.replace, async (c) => {
    const preset = await updatePresetById(
      c.req.valid('param').id,
      c.req.valid('json'),
      c.get('ownerId'),
    );
    return preset ? c.json(preset, 200) : c.json(notFound, 404);
  });

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      if (err.status === 400) {
        return c.json(
          { error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON.' } },
          400,
        );
      }
      if (err.status === 415) {
        return c.json(
          {
            error: {
              code: 'UNSUPPORTED_MEDIA_TYPE',
              message: 'Content-Type must be application/json.',
            },
          },
          415,
        );
      }
      return err.getResponse();
    }
    console.error(err);
    return c.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      500,
    );
  });

  return app;
}

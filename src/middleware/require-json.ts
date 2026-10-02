import { createMiddleware } from 'hono/factory';

export const requireJson = createMiddleware(async (c, next) => {
  const mediaType = c.req.header('Content-Type')
    ?.split(';')[0]
    ?.trim()
    .toLowerCase();

  if (mediaType !== 'application/json') {
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

  await next();
});

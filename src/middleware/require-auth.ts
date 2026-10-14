import { createMiddleware } from 'hono/factory';

export const requireAuth = createMiddleware(async (c, next) => {
  const authorization = c.req.header('Authorization');

  if (!authorization) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Valid credentials are required.',
        },
      },
      401,
    );
  }

  await next();
});

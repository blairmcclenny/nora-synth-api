import { createHash, timingSafeEqual } from 'node:crypto';
import { createMiddleware } from 'hono/factory';

export function requireAuth(expectedSecret: string) {
  if (!expectedSecret || /\s/.test(expectedSecret)) {
    throw new Error('Authentication secret must be nonempty and contain no whitespace.');
  }

  // Equal-length digests allow timingSafeEqual to compare any token length.
  const expectedDigest = createHash('sha256').update(expectedSecret).digest();

  return createMiddleware(async (c, next) => {
    const authorization = c.req.header('Authorization');
    const token = /^Bearer +(\S+)$/i.exec(authorization ?? '')?.[1];
    const valid = token !== undefined && timingSafeEqual(
      createHash('sha256').update(token).digest(),
      expectedDigest,
    );

    if (!valid) {
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
}

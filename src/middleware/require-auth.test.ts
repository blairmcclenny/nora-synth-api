import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Hono } from 'hono';
import { requireAuth } from './require-auth.js';

test('missing Authorization returns 401 without reaching the route', async () => {
  const app = new Hono();
  let routeReached = false;

  app.use('/protected', requireAuth);
  app.get('/protected', (c) => {
    routeReached = true;
    return c.json({ status: 'ok' });
  });

  const response = await app.request('/protected');

  assert.equal(response.status, 401);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);

  const body = await response.json();

  assert.deepEqual(body, {
    error: {
      code: 'UNAUTHORIZED',
      message: 'Valid credentials are required.',
    },
  });
  assert.equal(routeReached, false);
});

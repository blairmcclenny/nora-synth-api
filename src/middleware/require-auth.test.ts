import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Hono } from 'hono';
import { requireAuth, type AuthEnv } from './require-auth.js';

test('missing Authorization returns 401 without reaching the route', async () => {
  const app = new Hono<AuthEnv>();
  let routeReached = false;

  app.use('/protected', requireAuth('test-secret', 'test-owner'));
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

for (const authorization of [
  '',
  'Bearer wrong-secret',
  'Bearer x',
  'Bearer test-secret-extra',
  'Bearer TEST-SECRET',
  'Basic test-secret',
  'test-secret',
  'Bearer',
  'Bearer test-secret extra',
  'Bearer test-secret, Bearer test-secret',
]) {
  test(`invalid Authorization ${JSON.stringify(authorization)} returns 401 without reaching the route`, async () => {
    const app = new Hono<AuthEnv>();
    let routeReached = false;

    app.use('/protected', requireAuth('test-secret', 'test-owner'));
    app.get('/protected', (c) => {
      routeReached = true;
      return c.json({ status: 'ok' });
    });

    const response = await app.request('/protected', {
      headers: { Authorization: authorization },
    });

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
}

for (const authorization of ['Bearer test-secret', 'bearer test-secret', 'Bearer   test-secret']) {
  test(`valid Authorization ${JSON.stringify(authorization)} reaches the route`, async () => {
    const app = new Hono<AuthEnv>();
    let routeReached = false;

    app.use('/protected', requireAuth('test-secret', 'test-owner'));
    app.get('/protected', (c) => {
      routeReached = true;
      return c.json({ ownerId: c.get('ownerId') });
    });

    const response = await app.request('/protected', {
      headers: { Authorization: authorization },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ownerId: 'test-owner' });
    assert.equal(routeReached, true);
  });
}

test('invalid secret configuration is rejected when middleware is created', () => {
  for (const secret of ['', ' ', 'test secret', 'test-secret\n']) {
    assert.throws(() => requireAuth(secret, 'test-owner'), /Authentication secret/);
  }
});

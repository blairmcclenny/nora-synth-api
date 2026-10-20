import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { DrizzleQueryError } from 'drizzle-orm';

process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
const { createApp } = await import('./app.js');
const app = createApp({ secret: 'test-secret', ownerId: 'test-owner' });

function authenticatedRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', 'Bearer test-secret');
  return app.request(path, { ...init, headers });
}
const { pool } = await import('./db/pool.js');
after(async () => { await pool.end(); });

const preset = {
  name: 'Error fixture', schemaVersion: 1,
  parameters: {
    filter: 0.5, mood: 0.5, movement: 0.5, space: 0.5, expression: 0.5,
    attack: 0.5, decay: 0.5, sustain: 0.5, release: 0.5,
  },
};

for (const method of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']) {
  test(`${method} database failures return a safe JSON 500 response`, async () => {
    const internal = new Error('Sensitive database connection and SQL details');
    const query = mock.method(pool, 'query', async () => { throw internal; });
    const log = mock.method(console, 'error', () => {});
    try {
      const response = await authenticatedRequest(
        method === 'POST' ? '/v1/presets' : '/v1/presets/123e4567-e89b-42d3-a456-426614174000',
        {
          method,
          ...(['POST', 'PATCH', 'PUT'].includes(method) ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(method === 'PATCH' ? { name: 'Rename' } : preset),
          } : {}),
        },
      );
      assert.equal(query.mock.callCount(), 1);
      assert.equal(response.status, 500);
      assert.match(response.headers.get('content-type') ?? '', /application\/json/);
      assert.deepEqual(await response.json(), {
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      });
      const logged = log.mock.calls[0].arguments[0];
      assert.ok(logged instanceof DrizzleQueryError);
      assert.equal(logged.cause, internal);
    } finally {
      query.mock.restore();
      log.mock.restore();
    }
  });
}

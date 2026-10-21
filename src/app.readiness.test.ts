import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
const { createApp } = await import('./app.js');
const { pool } = await import('./db/pool.js');
const app = createApp({ secret: 'test-secret', ownerId: 'test-owner' });
after(async () => {
  await pool.end();
});

test('public readiness probes the database and recovers after failure', async () => {
  let available = false;
  const query = mock.method(pool, 'query', async (sql: string) => {
    assert.equal(sql, 'SELECT 1');
    if (!available) throw new Error('sensitive connection details');
    return { rows: [{ '?column?': 1 }] };
  });
  try {
    const health = await app.request('/health');
    assert.equal(health.status, 200);
    assert.equal(query.mock.callCount(), 0);
    const failed = await app.request('/ready');
    assert.equal(failed.status, 503);
    assert.deepEqual(await failed.json(), {
      error: { code: 'NOT_READY', message: 'Database is unavailable.' },
    });
    available = true;
    const ready = await app.request('/ready');
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { service: 'nora-synth-api', status: 'ready' });
    assert.equal(query.mock.callCount(), 2);
  } finally {
    query.mock.restore();
  }
});

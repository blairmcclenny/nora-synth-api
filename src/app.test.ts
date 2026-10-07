import assert from 'node:assert/strict';
import { after, test, mock } from 'node:test';

// Imports run after this assignment: app.ts imports the database pool.
// This address is deliberately unusable; these tests must never query it.
process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
const { default: app } = await import('./app.js');
const { pool } = await import('./db/pool.js');
const query = mock.method(pool, 'query', () => {
  assert.fail('Rejected requests must not reach the database');
});
after(async () => {
  assert.equal(query.mock.callCount(), 0);
  query.mock.restore();
  await pool.end();
});

const preset = {
  name: 'HTTP test', schemaVersion: 1,
  parameters: {
    filter: 0.5, mood: 0.5, movement: 0.5, space: 0.5, expression: 0.5,
    attack: 0.5, decay: 0.5, sustain: 0.5, release: 0.5,
  },
};
const id = '123e4567-e89b-42d3-a456-426614174000';

async function expectError(response: Response, status: number, code: string) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  const body = await response.json();
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, 'string');
  return body;
}

test('GET /health returns service liveness without querying the database', async () => {
  const response = await app.request('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { service: 'nora-synth-api', status: 'ok' });
});

for (const method of ['GET', 'DELETE', 'PATCH', 'PUT']) {
  test(`${method} rejects an invalid preset UUID`, async () => {
    const response = await app.request('/v1/presets/not-a-uuid', {
      method,
      ...(method === 'PATCH' || method === 'PUT' ? {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(method === 'PATCH' ? { name: 'Rename' } : preset),
      } : {}),
    });
    await expectError(response, 400, 'VALIDATION_ERROR');
  });
}

for (const method of ['POST', 'PATCH', 'PUT']) {
  const path = method === 'POST' ? '/v1/presets' : `/v1/presets/${id}`;
  test(`${method} rejects missing or unsupported content types`, async () => {
    for (const headers of [new Headers(), new Headers({ 'Content-Type': 'text/plain' })]) {
      await expectError(await app.request(path, {
        method, headers, body: '{}',
      }), 415, 'UNSUPPORTED_MEDIA_TYPE');
    }
  });

  test(`${method} rejects malformed JSON`, async () => {
    await expectError(await app.request(path, {
      method, headers: { 'Content-Type': 'application/json' }, body: '{',
    }), 400, 'INVALID_JSON');
  });

  test(`${method} reports the field path for an invalid JSON body`, async () => {
    const body = method === 'PATCH' ? { name: '  ' } : {
      ...preset, parameters: { ...preset.parameters, filter: 1.1 },
    };
    const error = await expectError(await app.request(path, {
      method, headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    }), 400, 'VALIDATION_ERROR');
    assert.ok(error.error.details.some((issue: { path: string }) =>
      issue.path === (method === 'PATCH' ? 'name' : 'parameters.filter')));
  });
}

test('GET list rejects invalid pagination and reports its field', async () => {
  for (const field of ['limit', 'offset']) {
    const body = await expectError(
      await app.request(`/v1/presets?${field}=-1`), 400, 'VALIDATION_ERROR',
    );
    assert.ok(body.error.details.some((issue: { path: string }) => issue.path === field));
  }
});

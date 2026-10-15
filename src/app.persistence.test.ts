import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { CreatePresetInput, Preset } from './types/preset.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('Missing Database Url');
}

const dataBaseUrl = new URL(testDatabaseUrl);

if (dataBaseUrl.pathname !== '/nora_synth_test') {
  throw new Error('Persistence tests must use nora_synth_test');
}

process.env.DATABASE_URL = testDatabaseUrl;

const { createApp } = await import('./app.js');
const app = createApp({ secret: 'test-secret', ownerId: 'test-owner' });

function authenticatedRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', 'Bearer test-secret');
  return app.request(path, { ...init, headers });
}
const { pool } = await import('./db/pool.js');

after(async () => {
  await pool.end();
});

test('a preset can be created and read back', async () => {
  const preset: CreatePresetInput = {
    name: 'First saved preset',
    schemaVersion: 1,
    parameters: {
      filter: 0.1,
      mood: 0.2,
      space: 0.24,
      movement: 0.31,
      expression: 0.13,
      attack: 0.4,
      decay: 0.5,
      sustain: 0.6,
      release: 0.8,
    },
  };

  const response = await authenticatedRequest('/v1/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
  const created = await response.json();

  try {
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('Location'), `/v1/presets/${created.id}`);
    assert.equal(created.name, preset.name);
    assert.deepEqual(created.parameters, preset.parameters);

    const retrievedResponse = await authenticatedRequest(`/v1/presets/${created.id}`);
    const retrieved = await retrievedResponse.json();

    assert.equal(retrievedResponse.status, 200);
    assert.deepEqual(retrieved, created);
  } finally {
    const deleted = await authenticatedRequest(`/v1/presets/${created.id}`, {
      method: 'DELETE',
    });

    assert.equal(deleted.status, 204);
  }
});

test('a preset can be renamed and read back.', async () => {
  const preset: CreatePresetInput = {
    name: 'First saved preset',
    schemaVersion: 1,
    parameters: {
      filter: 0.1,
      mood: 0.2,
      space: 0.24,
      movement: 0.31,
      expression: 0.13,
      attack: 0.4,
      decay: 0.5,
      sustain: 0.6,
      release: 0.8,
    },
  };

  const response = await authenticatedRequest('/v1/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
  const created = await response.json();

  try {
    assert.equal(response.status, 201);

    const updatedResponse = await authenticatedRequest(`/v1/presets/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed preset' }),
    });
    const updated = await updatedResponse.json();

    assert.equal(updatedResponse.status, 200);
    assert.equal(updated.name, 'Renamed preset');
    assert.equal(updated.id, created.id);
    assert.equal(updated.createdAt, created.createdAt);
    assert.equal(updated.schemaVersion, created.schemaVersion);
    assert.deepEqual(updated.parameters, created.parameters);

    const retrievedResponse = await authenticatedRequest(`/v1/presets/${updated.id}`);
    const retrieved = await retrievedResponse.json();

    assert.equal(retrievedResponse.status, 200);
    assert.deepEqual(retrieved, updated);
  } finally {
    const deleted = await authenticatedRequest(`/v1/presets/${created.id}`, {
      method: 'DELETE',
    });

    assert.equal(deleted.status, 204);
  }
});

test('a preset can be replaced and read back.', async () => {
  const preset: CreatePresetInput = {
    name: 'First saved preset',
    schemaVersion: 1,
    parameters: {
      filter: 0.1,
      mood: 0.2,
      space: 0.24,
      movement: 0.31,
      expression: 0.13,
      attack: 0.4,
      decay: 0.5,
      sustain: 0.6,
      release: 0.8,
    },
  };

  const replacement: CreatePresetInput = {
    name: 'Replaced preset',
    schemaVersion: 1,
    parameters: {
      filter: 0.9,
      mood: 0.8,
      space: 0.76,
      movement: 0.69,
      expression: 0.87,
      attack: 0.6,
      decay: 0.7,
      sustain: 0.4,
      release: 0.2,
    },
  };

  const response = await authenticatedRequest('/v1/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
  const created = await response.json();

  try {
    assert.equal(response.status, 201);

    const replacedResponse = await authenticatedRequest(`/v1/presets/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replacement),
    });
    const replaced = await replacedResponse.json();

    assert.equal(replacedResponse.status, 200);
    assert.equal(replaced.id, created.id);
    assert.equal(replaced.createdAt, created.createdAt);
    assert.equal(replaced.schemaVersion, replacement.schemaVersion);
    assert.equal(replaced.name, replacement.name);
    assert.deepEqual(replaced.parameters, replacement.parameters);

    const retrievedResponse = await authenticatedRequest(`/v1/presets/${replaced.id}`);
    const retrieved = await retrievedResponse.json();

    assert.equal(retrievedResponse.status, 200);
    assert.deepEqual(retrieved, replaced);
  } finally {
    const deleted = await authenticatedRequest(`/v1/presets/${created.id}`, {
      method: 'DELETE',
    });

    assert.equal(deleted.status, 204);
  }
});

const disposablePreset: CreatePresetInput = {
  name: 'HTTP persistence fixture',
  schemaVersion: 1,
  parameters: {
    filter: 0.1,
    mood: 0.2,
    movement: 0.3,
    space: 0.4,
    expression: 0.5,
    attack: 0.6,
    decay: 0.7,
    sustain: 0.8,
    release: 0.9,
  },
};

test('listing returns ordered presets, pagination, and an independent total', async () => {
  const baseline = await pool.query<{ total: string; newest: Date }>(`
    SELECT COUNT(*) AS total,
      date_trunc('milliseconds', GREATEST(MAX(updated_at), NOW())) AS newest
    FROM presets;
  `);
  const total = Number(baseline.rows[0].total) + 3;
  const newest = baseline.rows[0].newest.getTime();
  const ids: string[] = [];

  try {
    for (let index = 0; index < 3; index++) {
      const response = await authenticatedRequest('/v1/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...disposablePreset, name: `List fixture ${index}` }),
      });
      const created = await response.json();
      if (created.id) ids.push(created.id);
      assert.equal(response.status, 201);

      // Put our fixtures ahead of existing records. The last two share a timestamp
      // so the test also checks the ascending UUID tie-breaker.
      const updatedAt = new Date(newest + (index === 0 ? 60_000 : 120_000));
      await pool.query('UPDATE presets SET updated_at = $1 WHERE id = $2', [
        updatedAt.toISOString(),
        created.id,
      ]);
    }

    const expected: Preset[] = [];
    for (const id of ids) {
      const response = await authenticatedRequest(`/v1/presets/${id}`);
      assert.equal(response.status, 200);
      expected.push(await response.json());
    }
    expected.sort((a, b) => {
      const timestampOrder = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      return timestampOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });

    const defaultResponse = await authenticatedRequest('/v1/presets');
    const defaults = await defaultResponse.json();
    assert.equal(defaultResponse.status, 200);
    assert.equal(defaults.limit, 50);
    assert.equal(defaults.offset, 0);
    assert.equal(defaults.total, total);
    assert.equal(defaults.items.length, Math.min(50, total));
    assert.deepEqual(defaults.items.slice(0, 3), expected);

    for (let offset = 0; offset < expected.length; offset++) {
      const response = await authenticatedRequest(`/v1/presets?limit=1&offset=${offset}`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        items: [expected[offset]],
        limit: 1,
        offset,
        total,
      });
    }

    const emptyResponse = await authenticatedRequest(`/v1/presets?limit=2&offset=${total}`);
    assert.equal(emptyResponse.status, 200);
    assert.deepEqual(await emptyResponse.json(), {
      items: [],
      limit: 2,
      offset: total,
      total,
    });
  } finally {
    // Attempt every cleanup even if one deletion fails.
    const responses = await Promise.all(
      ids.map((id) => authenticatedRequest(`/v1/presets/${id}`, { method: 'DELETE' })),
    );
    for (const response of responses) assert.equal(response.status, 204);
  }
});

test('deletion returns no body and subsequent recall and deletion return 404', async () => {
  const response = await authenticatedRequest('/v1/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(disposablePreset),
  });
  const created = await response.json();

  try {
    assert.equal(response.status, 201);

    const deleted = await authenticatedRequest(`/v1/presets/${created.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleted.status, 204);
    assert.equal(await deleted.text(), '');

    for (const method of ['GET', 'DELETE']) {
      const missing = await authenticatedRequest(`/v1/presets/${created.id}`, { method });
      assert.equal(missing.status, 404);
      assert.deepEqual(await missing.json(), {
        error: { code: 'NOT_FOUND', message: 'Preset not found.' },
      });
    }
  } finally {
    // The successful path already deleted this record; clean it up on failure too.
    await pool.query('DELETE FROM presets WHERE id = $1', [created.id]);
  }
});

test('missing presets cannot be recalled, renamed, or replaced', async () => {
  const response = await authenticatedRequest('/v1/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(disposablePreset),
  });
  const created = await response.json();

  try {
    assert.equal(response.status, 201);
    const deleted = await authenticatedRequest(`/v1/presets/${created.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleted.status, 204);

    const requests: RequestInit[] = [
      { method: 'GET' },
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Missing preset rename' }),
      },
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(disposablePreset),
      },
    ];

    for (const request of requests) {
      const missing = await authenticatedRequest(`/v1/presets/${created.id}`, request);
      assert.equal(missing.status, 404, `${request.method} must return 404`);
      assert.deepEqual(await missing.json(), {
        error: { code: 'NOT_FOUND', message: 'Preset not found.' },
      });

      // Check storage directly: a 404 alone does not prove there was no insert.
      const stored = await pool.query('SELECT id FROM presets WHERE id = $1', [
        created.id,
      ]);
      assert.equal(stored.rows.length, 0);
    }
  } finally {
    await pool.query('DELETE FROM presets WHERE id = $1', [created.id]);
  }
});

test('rejected PATCH and PUT requests leave the stored preset unchanged', async () => {
  const response = await authenticatedRequest('/v1/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(disposablePreset),
  });
  const created = await response.json();
  try {
    assert.equal(response.status, 201);
    for (const method of ['PATCH', 'PUT']) {
      const invalidBody = method === 'PATCH' ? { name: '  ' } : {
        ...disposablePreset,
        name: 'Must not be saved',
        parameters: { ...disposablePreset.parameters, filter: 2 },
      };
      for (const body of [JSON.stringify(invalidBody), '{']) {
        const rejected = await authenticatedRequest(`/v1/presets/${created.id}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        assert.equal(rejected.status, 400);
        const retrieved = await authenticatedRequest(`/v1/presets/${created.id}`);
        assert.equal(retrieved.status, 200);
        assert.deepEqual(await retrieved.json(), created);
      }
    }
  } finally {
    const deleted = await authenticatedRequest(`/v1/presets/${created.id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
  }
});

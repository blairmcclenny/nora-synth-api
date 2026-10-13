import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { CreatePresetInput } from './types/preset.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('Missing Database Url');
}

const dataBaseUrl = new URL(testDatabaseUrl);

if (dataBaseUrl.pathname !== '/nora_synth_test') {
  throw new Error('Persistence tests must use nora_synth_test');
}

process.env.DATABASE_URL = testDatabaseUrl;

const { default: app } = await import('./app.js');
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

  const response = await app.request('/v1/presets', {
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

    const retrievedResponse = await app.request(`/v1/presets/${created.id}`);
    const retrieved = await retrievedResponse.json();

    assert.equal(retrievedResponse.status, 200);
    assert.deepEqual(retrieved, created);
  } finally {
    const deleted = await app.request(`/v1/presets/${created.id}`, {
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

  const response = await app.request('/v1/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
  const created = await response.json();

  try {
    assert.equal(response.status, 201);

    const updatedResponse = await app.request(`/v1/presets/${created.id}`, {
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

    const retrievedResponse = await app.request(`/v1/presets/${updated.id}`);
    const retrieved = await retrievedResponse.json();

    assert.equal(retrievedResponse.status, 200);
    assert.deepEqual(retrieved, updated);
  } finally {
    const deleted = await app.request(`/v1/presets/${created.id}`, {
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

  const response = await app.request('/v1/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
  const created = await response.json();

  try {
    assert.equal(response.status, 201);

    const replacedResponse = await app.request(`/v1/presets/${created.id}`, {
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

    const retrievedResponse = await app.request(`/v1/presets/${replaced.id}`);
    const retrieved = await retrievedResponse.json();

    assert.equal(retrievedResponse.status, 200);
    assert.deepEqual(retrieved, replaced);
  } finally {
    const deleted = await app.request(`/v1/presets/${created.id}`, {
      method: 'DELETE',
    });

    assert.equal(deleted.status, 204);
  }
});

import assert from 'node:assert/strict';
import { after, test } from 'node:test';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('Missing Database Url');
}

const databaseUrl = new URL(testDatabaseUrl);

if (databaseUrl.pathname !== '/nora_synth_test') {
  throw new Error('Persistence tests must use nora_synth_test');
}

process.env.DATABASE_URL = testDatabaseUrl;

const { createPreset, getPresetById, deletePresetById } = await import('./presets.js');
const { pool } = await import('../db/pool.js');

after(async () => {
  await pool.end();
});

test('a created preset can be read back', async () => {
  const created = await createPreset({
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
  });

  try {
    const retrieved = await getPresetById(created.id);

    assert.ok(retrieved);
    assert.equal(retrieved.name, created.name);
    assert.deepEqual(retrieved.parameters, created.parameters);
    assert.equal(retrieved.id, created.id);
    assert.equal(retrieved.schemaVersion, created.schemaVersion);
    assert.equal(retrieved.createdAt, created.createdAt);
    assert.equal(retrieved.updatedAt, created.updatedAt);
  } finally {
    await deletePresetById(created.id);
  }
});

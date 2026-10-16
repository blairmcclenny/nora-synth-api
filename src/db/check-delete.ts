import assert from 'node:assert/strict';
import {
  createPreset,
  deletePresetById,
  getPresetById,
} from '../repositories/presets.js';
import { pool } from './pool.js';

const ownerId = process.env.AUTH_OWNER_ID;
if (!ownerId || ownerId.trim() !== ownerId) throw new Error('Valid AUTH_OWNER_ID is required');

try {
  const preset = await createPreset({
    name: 'Disposable delete test',
    schemaVersion: 1,
    parameters: {
      filter: 0.1,
      mood: 0.2,
      movement: 0.3,
      space: 0.4,
      expression: 0.5,
      attack: 0.2,
      decay: 0.3,
      sustain: 0.8,
      release: 0.5,
    },
  }, ownerId);

  assert.equal(await deletePresetById(preset.id, ownerId), true);
  assert.equal(await getPresetById(preset.id, ownerId), undefined);
  assert.equal(await deletePresetById(preset.id, ownerId), false);

  console.log('Delete checks passed');
} finally {
  await pool.end();
}

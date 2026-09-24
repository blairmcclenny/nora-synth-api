import assert from 'node:assert/strict';
import {
  createPreset,
  deletePresetById,
  getPresetById,
} from '../repositories/presets.js';
import { pool } from './pool.js';

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
  });

  assert.equal(await deletePresetById(preset.id), true);
  assert.equal(await getPresetById(preset.id), undefined);
  assert.equal(await deletePresetById(preset.id), false);

  console.log('Delete checks passed');
} finally {
  await pool.end();
}

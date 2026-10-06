import assert from 'node:assert/strict';
import test from 'node:test';
import { createPresetInputSchema } from './preset.js';

const validPreset = {
  name: '  Soft Motion  ',
  schemaVersion: 1,
  parameters: {
    filter: 0.45, mood: 0.65, movement: 0.3, space: 0.55,
    expression: 0.7, attack: 0.2, decay: 0.35, sustain: 0.8, release: 0.5,
  },
};

const invalidPreset = {
  ...validPreset,
  parameters: {
    ...validPreset.parameters,
    filter: 1.1,
  },
};

test('a valid preset preserves parameters and trims its name', () => {
  const result = createPresetInputSchema.safeParse(validPreset);
  if (!result.success) assert.fail(result.error.message);
  assert.equal(result.success, true);
  assert.equal(result.data.name, 'Soft Motion');
  assert.deepEqual(result.data.parameters, validPreset.parameters);
});

test('rejects a filter value above 1', () => {
  const result = createPresetInputSchema.safeParse(invalidPreset);
  
  if (result.success) assert.fail('Expected filter 1.1 to be rejected');
  
  assert.equal(result.success, false);
  assert.ok(
    result.error.issues.some(
      (issue) => issue.path.join('.') === 'parameters.filter',
    ),
    'Expected a validation issue for parameters.filter',
  );
});

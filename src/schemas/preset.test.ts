import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPresetInputSchema,
  presetListInputSchema,
  renamePresetInputSchema,
} from './preset.js';

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

const presetWithZeroFilter = {
  ...validPreset,
  parameters: {
    ...validPreset.parameters,
    filter: 0,
  },
};

const presetWithOneFilter = {
  ...validPreset,
  parameters: {
    ...validPreset.parameters,
    filter: 1,
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

test('accepts a filter value of 0', () => {
  const result = createPresetInputSchema.safeParse(presetWithZeroFilter);

  if (!result.success) assert.fail(result.error.message);

  assert.equal(result.success, true);
  assert.equal(result.data.parameters.filter, 0);
  assert.deepEqual(result.data.parameters, presetWithZeroFilter.parameters);
});

test('accepts a filter value of 1', () => {
  const result = createPresetInputSchema.safeParse(presetWithOneFilter);

  if (!result.success) assert.fail(result.error.message);

  assert.equal(result.success, true);
  assert.equal(result.data.parameters.filter, 1);
  assert.deepEqual(result.data.parameters, presetWithOneFilter.parameters);
});

// Check every control so a missing or differently configured field is caught.
for (const parameter of Object.keys(validPreset.parameters)) {
  test(`${parameter} accepts both normalized boundaries`, () => {
    for (const value of [0, 1]) {
      const result = createPresetInputSchema.safeParse({
        ...validPreset,
        parameters: { ...validPreset.parameters, [parameter]: value },
      });
      if (!result.success) assert.fail(result.error.message);
      assert.equal(
        result.data.parameters[parameter as keyof typeof validPreset.parameters],
        value,
      );
    }
  });

  test(`${parameter} rejects out-of-range and nonnumeric values`, () => {
    for (const value of [-0.1, 1.1, '0.5', null]) {
      const result = createPresetInputSchema.safeParse({
        ...validPreset,
        parameters: { ...validPreset.parameters, [parameter]: value },
      });
      if (result.success) assert.fail(`Expected ${parameter}=${value} to fail`);
      assert.ok(result.error.issues.some(
        (issue) => issue.path.join('.') === `parameters.${parameter}`,
      ));
    }
  });

  test(`${parameter} is required`, () => {
    const parameters: Record<string, unknown> = { ...validPreset.parameters };
    delete parameters[parameter];
    const result = createPresetInputSchema.safeParse({ ...validPreset, parameters });
    if (result.success) assert.fail(`Expected missing ${parameter} to fail`);
    assert.ok(result.error.issues.some(
      (issue) => issue.path.join('.') === `parameters.${parameter}`,
    ));
  });
}

test('rejects unknown parameters instead of silently discarding them', () => {
  const result = createPresetInputSchema.safeParse({
    ...validPreset,
    parameters: { ...validPreset.parameters, resonance: 0.5 },
  });
  assert.equal(result.success, false);
});

test('rejects unknown top-level fields', () => {
  assert.equal(createPresetInputSchema.safeParse({
    ...validPreset, id: 'client-supplied-id',
  }).success, false);
});

test('requires name, schemaVersion, and parameters', () => {
  for (const field of ['name', 'schemaVersion', 'parameters']) {
    const input: Record<string, unknown> = { ...validPreset };
    delete input[field];
    assert.equal(createPresetInputSchema.safeParse(input).success, false, field);
  }
});

test('rejects unsupported and nonnumeric schema versions', () => {
  for (const schemaVersion of [0, 2, '1', null]) {
    assert.equal(createPresetInputSchema.safeParse({
      ...validPreset, schemaVersion,
    }).success, false, `schemaVersion=${schemaVersion}`);
  }
});

// Creation/replacement and rename should enforce the same name contract.
for (const [label, schema] of [
  ['create', createPresetInputSchema],
  ['rename', renamePresetInputSchema],
] as const) {
  const input = label === 'create' ? validPreset : { name: validPreset.name };

  test(`${label} accepts names of 1 and 100 characters after trimming`, () => {
    for (const name of ['X', 'X'.repeat(100)]) {
      const result = schema.safeParse({ ...input, name: `  ${name}  ` });
      if (!result.success) assert.fail(result.error.message);
      assert.equal(result.data.name, name);
    }
  });

  test(`${label} rejects blank, oversized, and nonstring names`, () => {
    for (const name of ['', ' \t\n ', 'X'.repeat(101), 123, null]) {
      const result = schema.safeParse({ ...input, name });
      if (result.success) assert.fail(`Expected invalid ${label} name to fail`);
      assert.ok(result.error.issues.some((issue) => issue.path.join('.') === 'name'));
    }
  });
}

test('rename requires a name and rejects extra fields', () => {
  assert.equal(renamePresetInputSchema.safeParse({}).success, false);
  assert.equal(renamePresetInputSchema.safeParse({
    name: 'New name', parameters: validPreset.parameters,
  }).success, false);
});

test('pagination defaults to limit 50 and offset 0', () => {
  assert.deepEqual(presetListInputSchema.parse({}), { limit: 50, offset: 0 });
  assert.deepEqual(presetListInputSchema.parse({ limit: '10' }), { limit: 10, offset: 0 });
  assert.deepEqual(presetListInputSchema.parse({ offset: '20' }), { limit: 50, offset: 20 });
});

test('pagination converts query strings and accepts its boundaries', () => {
  assert.deepEqual(presetListInputSchema.parse({ limit: '1', offset: '0' }), {
    limit: 1, offset: 0,
  });
  assert.deepEqual(presetListInputSchema.parse({ limit: '100', offset: '200' }), {
    limit: 100, offset: 200,
  });
});

for (const [field, invalidValues] of [
  ['limit', ['0', '-1', '101', '1.5', 'abc', '']],
  ['offset', ['-1', '0.5', 'abc']],
] as const) {
  test(`pagination rejects invalid ${field} values`, () => {
    for (const value of invalidValues) {
      const result = presetListInputSchema.safeParse({ [field]: value });
      if (result.success) assert.fail(`Expected ${field}=${value} to fail`);
      assert.ok(result.error.issues.some((issue) => issue.path.join('.') === field));
    }
  });
}

test('pagination rejects unknown query fields', () => {
  assert.equal(presetListInputSchema.safeParse({ page: '1' }).success, false);
});

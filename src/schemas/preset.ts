import { z } from '@hono/zod-openapi';

const inputExample = {
  name: 'Soft Motion',
  schemaVersion: 1 as const,
  parameters: {
    filter: 0.5,
    mood: 0.5,
    movement: 0.5,
    space: 0.5,
    expression: 0.5,
    attack: 0.5,
    decay: 0.5,
    sustain: 0.5,
    release: 0.5,
  },
};
const presetExample = {
  ...inputExample,
  id: '123e4567-e89b-42d3-a456-426614174000',
  createdAt: '2026-10-20T12:00:00.000Z',
  updatedAt: '2026-10-20T12:00:00.000Z',
};

const parameterSchema = z.number().min(0).max(1);

export const synthParametersSchema = z
  .strictObject({
    filter: parameterSchema,
    mood: parameterSchema,
    movement: parameterSchema,
    space: parameterSchema,
    expression: parameterSchema,
    attack: parameterSchema,
    decay: parameterSchema,
    sustain: parameterSchema,
    release: parameterSchema,
  })
  .openapi('SynthParameters');

export const createPresetInputSchema = z
  .strictObject({
    name: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .openapi({
        description: 'Trimmed before validation; must contain 1–100 characters after trimming.',
      }),
    schemaVersion: z.literal(1),
    parameters: synthParametersSchema,
  })
  .openapi('PresetInput', { example: inputExample });

export const presetListInputSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const renamePresetInputSchema = z
  .strictObject({
    name: createPresetInputSchema.shape.name,
  })
  .openapi('RenameInput', { example: { name: 'Soft Motion II' } });

export const presetIdSchema = z.object({
  id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }),
});

export const presetSchema = z
  .strictObject({
    ...createPresetInputSchema.shape,
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('Preset', { example: presetExample });

export const presetPageSchema = z
  .strictObject({
    items: z.array(presetSchema),
    limit: z.number().int().min(1).max(100),
    offset: z.number().int().min(0),
    total: z.number().int().min(0),
  })
  .openapi('PresetList', { example: { items: [presetExample], limit: 50, offset: 0, total: 1 } });

import type { z } from 'zod';
import { createPresetInputSchema, synthParametersSchema, presetSchema } from '../schemas/preset.js';

export type SynthParameters = z.infer<typeof synthParametersSchema>;

export type CreatePresetInput = z.infer<typeof createPresetInputSchema>;

export type Preset = z.infer<typeof presetSchema>;

export type PresetList = {
  items: Preset[];
  total: number;
};

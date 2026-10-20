import type { z } from 'zod';
import { createPresetInputSchema, presetSchema } from '../schemas/preset.js';

export type CreatePresetInput = z.infer<typeof createPresetInputSchema>;

export type Preset = z.infer<typeof presetSchema>;

export type PresetList = {
  items: Preset[];
  total: number;
};

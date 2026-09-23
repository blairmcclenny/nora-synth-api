import type { z } from 'zod';
import {
  createPresetInputSchema,
  synthParametersSchema,
} from '../schemas/preset.js';

export type SynthParameters = z.infer<typeof synthParametersSchema>;

export type CreatePresetInput = z.infer<typeof createPresetInputSchema>;

export type Preset = CreatePresetInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type PresetList = {
  items: Preset[],
  total: number,
}

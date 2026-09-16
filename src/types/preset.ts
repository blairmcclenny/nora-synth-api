import type { z } from 'zod';
import {
  createPresetInputSchema,
  synthParametersSchema,
} from '../schemas/preset.js';

export type SynthParameters = z.infer<typeof synthParametersSchema>;

export type CreatePresetInput = z.infer<typeof createPresetInputSchema>;

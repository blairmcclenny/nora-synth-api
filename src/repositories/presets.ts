import { randomUUID } from 'node:crypto';
import type { CreatePresetInput, Preset } from '../types/preset.js';

export function createPreset(input: CreatePresetInput): Preset {
  const now = new Date().toISOString();
  const preset: Preset = {
    ...input,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  return preset;
}

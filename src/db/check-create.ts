import { createPreset } from "../repositories/presets.js";
import { pool } from "./pool.js";

const ownerId = process.env.AUTH_OWNER_ID;
if (!ownerId || ownerId.trim() !== ownerId) throw new Error('Valid AUTH_OWNER_ID is required');

try {
  const preset = await createPreset({
    name: 'First saved preset',
    schemaVersion: 1,
    parameters: {
      filter: .1,
      mood: .2,
      space: .24,
      movement: .31,
      expression: .13,
      attack: .4,
      decay: .5,
      sustain: .6,
      release: .8
    }
  }, ownerId)
  console.log(preset)
} finally {
  await pool.end()
}
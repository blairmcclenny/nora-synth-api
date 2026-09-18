import { createPreset } from "../repositories/presets.js";
import { pool } from "./pool.js";

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
  })
  console.log(preset)
} finally {
  await pool.end()
}
import { getPresetById } from "../repositories/presets.js";
import { pool } from "./pool.js";

try {
  const preset = await getPresetById('1a98a5b1-d54e-47b3-907c-f478cb4bae7e')
  console.log(preset)
} finally {
  await pool.end()
}
import { getPresetById } from "../repositories/presets.js";
import { pool } from "./pool.js";

const ownerId = process.env.AUTH_OWNER_ID;
if (!ownerId || ownerId.trim() !== ownerId) throw new Error('Valid AUTH_OWNER_ID is required');

try {
  const preset = await getPresetById('1a98a5b1-d54e-47b3-907c-f478cb4bae7e', ownerId)
  console.log(preset)
} finally {
  await pool.end()
}
import { randomUUID } from 'node:crypto';
import type { CreatePresetInput, Preset, PresetList } from '../types/preset.js';
import { pool } from '../db/pool.js';

type PresetRow = {
  id: string;
  name: string;
  schema_version: number;
  filter: number;
  mood: number;
  movement: number;
  space: number;
  expression: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  created_at: Date;
  updated_at: Date;
};

function mapPresetRow(row: PresetRow): Preset {
  if (row.schema_version !== 1) {
    throw new Error('Unsupported preset schema version');
  }

  return {
    id: row.id,
    name: row.name,
    schemaVersion: row.schema_version,
    parameters: {
      filter: row.filter,
      mood: row.mood,
      movement: row.movement,
      space: row.space,
      expression: row.expression,
      attack: row.attack,
      decay: row.decay,
      sustain: row.sustain,
      release: row.release,
    },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getPresetById(id: string): Promise<Preset | undefined> {
  const results = await pool.query<PresetRow>(
    `SELECT * FROM presets WHERE id = $1`,
    [id],
  );

  const row = results.rows[0];

  if (!row) {
    return undefined;
  }

  return mapPresetRow(row);
}

export async function createPreset(input: CreatePresetInput): Promise<Preset> {
  const now = new Date().toISOString();
  const preset: Preset = {
    ...input,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  await pool.query(
    `INSERT INTO presets (
      id, name, schema_version, filter, mood, movement, space, expression, attack, decay, sustain, release, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )`,
    [
      preset.id,
      preset.name,
      preset.schemaVersion,
      preset.parameters.filter,
      preset.parameters.mood,
      preset.parameters.movement,
      preset.parameters.space,
      preset.parameters.expression,
      preset.parameters.attack,
      preset.parameters.decay,
      preset.parameters.sustain,
      preset.parameters.release,
      preset.createdAt,
      preset.updatedAt,
    ],
  );

  return preset;
}

export async function listPresets(
  limit: number,
  offset: number,
): Promise<PresetList> {
  const results = await pool.query<PresetRow>(
    `
    SELECT * FROM presets
    ORDER BY updated_at DESC, id ASC
    LIMIT $1 OFFSET $2
  `,
    [limit, offset],
  );

  const countResult = await pool.query<{ total: string }>(`
    SELECT COUNT(*) AS total FROM presets;
  `);

  const total = Number(countResult.rows[0].total);

  return {
    items: results.rows.map(mapPresetRow),
    total,
  };
}

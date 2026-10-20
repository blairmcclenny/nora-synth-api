import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import type { CreatePresetInput, Preset, PresetList } from '../types/preset.js';
import { db } from '../db/client.js';
import { presets } from '../db/schema.js';

function mapPresetRow(row: typeof presets.$inferSelect): Preset {
  if (row.schemaVersion !== 1) {
    throw new Error('Unsupported preset schema version');
  }

  const { id, name, schemaVersion, createdAt, updatedAt, ownerId: _ownerId, ...parameters } = row;
  return {
    id,
    name,
    schemaVersion,
    parameters,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

// Every single-record read or write must match both the ID and trusted owner.
const ownedPreset = (id: string, ownerId: string) =>
  and(eq(presets.id, id), eq(presets.ownerId, ownerId));

const inputColumns = ({ name, schemaVersion, parameters }: CreatePresetInput) => ({
  name,
  schemaVersion,
  ...parameters,
});

export async function getPresetById(id: string, ownerId: string): Promise<Preset | undefined> {
  const [row] = await db.select().from(presets).where(ownedPreset(id, ownerId));
  return row ? mapPresetRow(row) : undefined;
}

export async function createPreset(input: CreatePresetInput, ownerId: string): Promise<Preset> {
  const now = new Date();
  const [row] = await db
    .insert(presets)
    .values({
      ...inputColumns(input),
      id: randomUUID(),
      ownerId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapPresetRow(row);
}

export async function listPresets(
  limit: number,
  offset: number,
  ownerId: string,
): Promise<PresetList> {
  const rows = await db
    .select()
    .from(presets)
    .where(eq(presets.ownerId, ownerId))
    .orderBy(desc(presets.updatedAt), asc(presets.id))
    .limit(limit)
    .offset(offset);
  const [result] = await db
    .select({ total: count() })
    .from(presets)
    .where(eq(presets.ownerId, ownerId));
  return { items: rows.map(mapPresetRow), total: result.total };
}

export async function deletePresetById(id: string, ownerId: string): Promise<boolean> {
  const rows = await db
    .delete(presets)
    .where(ownedPreset(id, ownerId))
    .returning({ id: presets.id });
  return rows.length > 0;
}

export async function renamePresetById(
  id: string,
  name: string,
  ownerId: string,
): Promise<Preset | undefined> {
  const [row] = await db
    .update(presets)
    .set({ name, updatedAt: sql`now()` })
    .where(ownedPreset(id, ownerId))
    .returning();
  return row ? mapPresetRow(row) : undefined;
}

export async function updatePresetById(
  id: string,
  input: CreatePresetInput,
  ownerId: string,
): Promise<Preset | undefined> {
  const [row] = await db
    .update(presets)
    .set({ ...inputColumns(input), updatedAt: sql`now()` })
    .where(ownedPreset(id, ownerId))
    .returning();
  return row ? mapPresetRow(row) : undefined;
}

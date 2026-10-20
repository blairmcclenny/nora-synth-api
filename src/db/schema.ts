import { sql } from 'drizzle-orm';
import {
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Mirrors the existing SQL migrations; importing this schema never changes a database.
export const presets = pgTable(
  'presets',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    filter: doublePrecision('filter').notNull(),
    mood: doublePrecision('mood').notNull(),
    movement: doublePrecision('movement').notNull(),
    space: doublePrecision('space').notNull(),
    expression: doublePrecision('expression').notNull(),
    attack: doublePrecision('attack').notNull(),
    decay: doublePrecision('decay').notNull(),
    sustain: doublePrecision('sustain').notNull(),
    release: doublePrecision('release').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    ownerId: text('owner_id').notNull(),
  },
  (table) => [
    check('presets_schema_version_check', sql`${table.schemaVersion} = 1`),
    ...(
      [
        'filter',
        'mood',
        'movement',
        'space',
        'expression',
        'attack',
        'decay',
        'sustain',
        'release',
      ] as const
    ).map((key) => check(`presets_${key}_check`, sql`${table[key]} BETWEEN 0 AND 1`)),
    check(
      'presets_owner_id_check',
      sql`length(${table.ownerId}) > 0 AND ${table.ownerId} = btrim(${table.ownerId})`,
    ),
    index('presets_owner_updated_id_idx').on(table.ownerId, table.updatedAt.desc(), table.id.asc()),
  ],
);

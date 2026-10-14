import { readdir, readFile } from 'node:fs/promises';
import type { PoolClient } from 'pg';

const initialMigration = '001_create_presets.sql';

// Compare PostgreSQL's own representation of the existing table with a temporary
// reference made from the initial migration. Constraint names are irrelevant.
async function tableShape(client: PoolClient, table: string) {
  const columns = await client.query(`
    SELECT attname, format_type(atttypid, atttypmod) AS type, attnotnull,
      pg_get_expr(d.adbin, d.adrelid) AS default_expression
    FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attname
  `, [table]);
  const constraints = await client.query(`
    SELECT contype, convalidated, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = $1::regclass AND contype IN ('p', 'c', 'u', 'f', 'x')
    ORDER BY contype, definition
  `, [table]);
  return { columns: columns.rows, constraints: constraints.rows };
}

async function adoptInitial(client: PoolClient, sql: string) {
  await client.query('BEGIN');
  try {
    // This transformation is intentionally limited to our known initial migration.
    if (!sql.startsWith('CREATE TABLE presets (')) {
      throw new Error('Initial migration is no longer supported for adoption');
    }
    await client.query(sql.replace(
      'CREATE TABLE presets (',
      'CREATE TEMP TABLE migration_expected_presets (',
    ));
    const expected = await tableShape(client, 'pg_temp.migration_expected_presets');
    const actual = await tableShape(client, 'presets');
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error('Existing presets schema does not match the initial migration');
    }
    await client.query('DROP TABLE pg_temp.migration_expected_presets');
    await client.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1)', [initialMigration],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function runMigrations(
  client: PoolClient,
  migrationsDir: URL,
  adoptExisting = false,
): Promise<string[]> {
  // Hold one connection and a session lock throughout discovery and execution,
  // preventing two runners from selecting the same pending migrations.
  await client.query('SELECT pg_advisory_lock(72104931)');
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at timestamp with time zone NOT NULL DEFAULT NOW()
      );
    `);
    const applied = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations',
    );
    const appliedFiles = new Set(applied.rows.map((row) => row.filename));
    const files = await readdir(migrationsDir);
    const migrationFiles = files.filter((file) => file.endsWith('.sql')).sort();
    for (const filename of appliedFiles) {
      if (!migrationFiles.includes(filename)) {
        throw new Error(`Applied migration file is missing: ${filename}`);
      }
    }
    const existing = await client.query<{ presets: string | null }>(
      "SELECT to_regclass('presets')::text AS presets",
    );
    if (existing.rows[0].presets !== null && !appliedFiles.has(initialMigration)) {
      if (!adoptExisting) {
        throw new Error('Existing presets table has no migration history. Use --adopt-existing to verify and adopt it.');
      }
      await adoptInitial(client, await readFile(new URL(initialMigration, migrationsDir), 'utf8'));
      appliedFiles.add(initialMigration);
    } else if (adoptExisting && existing.rows[0].presets === null) {
      throw new Error('There is no existing presets table to adopt');
    }

    const pendingFiles = migrationFiles.filter((file) => !appliedFiles.has(file));
    for (const filename of pendingFiles) {
      const sql = await readFile(new URL(filename, migrationsDir), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)', [filename],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    return pendingFiles;
  } finally {
    await client.query('SELECT pg_advisory_unlock(72104931)');
  }
}

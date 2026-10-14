import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';
import { Pool } from 'pg';
import { runMigrations } from './migration-runner.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== '/nora_synth_test') {
  throw new Error('Migration tests must use nora_synth_test');
}
const pool = new Pool({ connectionString: url });
after(async () => { await pool.end(); });
const migrationsDir = new URL('./migrations/', import.meta.url);
const initialSql = await readFile(new URL('001_create_presets.sql', migrationsDir), 'utf8');

// Every test owns a separate schema. Existing test and development data stay intact.
async function withSchema(run: (client: import('pg').PoolClient) => Promise<void>) {
  const client = await pool.connect();
  const schema = `migration_test_${randomUUID().replaceAll('-', '')}`;
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await run(client);
  } finally {
    await client.query('ROLLBACK');
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    client.release();
  }
}

test('fresh migrations run once and a repeat run skips applied files', async () => {
  await withSchema(async (client) => {
    assert.deepEqual(await runMigrations(client, migrationsDir), ['001_create_presets.sql']);
    assert.deepEqual(await runMigrations(client, migrationsDir), []);
    const history = await client.query('SELECT filename, applied_at FROM schema_migrations');
    assert.equal(history.rows.length, 1);
    assert.equal(history.rows[0].filename, '001_create_presets.sql');
    assert.ok(history.rows[0].applied_at instanceof Date);
    const table = await client.query("SELECT to_regclass('presets') AS presets");
    assert.ok(table.rows[0].presets);
  });
});

test('existing schema requires explicit adoption and retains its records', async () => {
  await withSchema(async (client) => {
    await client.query(initialSql);
    await client.query(`INSERT INTO presets VALUES (
      $1, 'Keep me', 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, NOW(), NOW()
    )`, [randomUUID()]);
    const before = await client.query('SELECT * FROM presets');
    await assert.rejects(runMigrations(client, migrationsDir), /no migration history/);
    assert.deepEqual(await runMigrations(client, migrationsDir, true), []);
    assert.deepEqual((await client.query('SELECT * FROM presets')).rows, before.rows);
    assert.equal((await client.query('SELECT * FROM schema_migrations')).rows.length, 1);
    assert.deepEqual(await runMigrations(client, migrationsDir), []);
  });
});

for (const change of [
  'ALTER TABLE presets ALTER COLUMN name DROP NOT NULL',
  'ALTER TABLE presets DROP CONSTRAINT presets_pkey',
  'ALTER TABLE presets DROP CONSTRAINT presets_filter_check',
  'ALTER TABLE presets ALTER COLUMN name TYPE varchar(100)',
]) {
  test(`adoption refuses incompatible schema: ${change}`, async () => {
    await withSchema(async (client) => {
      await client.query(initialSql);
      await client.query(change);
      await assert.rejects(runMigrations(client, migrationsDir, true), /does not match/);
      assert.equal((await client.query('SELECT * FROM schema_migrations')).rows.length, 0);
    });
  });
}

test('pending files run in order and a failed migration rolls back and stops', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nora-migrations-'));
  try {
    await writeFile(join(directory, '001_create_presets.sql'), initialSql);
    await writeFile(join(directory, '002_add_column.sql'), 'ALTER TABLE presets ADD COLUMN note text;');
    await writeFile(join(directory, '003_fail.sql'), 'CREATE TABLE rollback_probe (id integer); SELECT missing_column FROM presets;');
    await writeFile(join(directory, '004_later.sql'), 'CREATE TABLE later_probe (id integer);');
    await writeFile(join(directory, 'ignored.txt'), 'This is not SQL');
    const dirUrl = pathToFileURL(`${directory}/`);
    await withSchema(async (client) => {
      await assert.rejects(runMigrations(client, dirUrl), /missing_column/);
      assert.deepEqual((await client.query('SELECT filename FROM schema_migrations ORDER BY filename')).rows, [
        { filename: '001_create_presets.sql' }, { filename: '002_add_column.sql' },
      ]);
      const result = await client.query("SELECT to_regclass('rollback_probe') AS rolled_back, to_regclass('later_probe') AS later");
      assert.deepEqual(result.rows[0], { rolled_back: null, later: null });
      // Fix the unapplied file; rerun preserves prior successes and applies the rest.
      await writeFile(join(directory, '003_fail.sql'), 'CREATE TABLE rollback_probe (id integer);');
      assert.deepEqual(await runMigrations(client, dirUrl), ['003_fail.sql', '004_later.sql']);
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

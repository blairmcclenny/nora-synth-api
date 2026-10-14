import { runMigrations } from './migration-runner.js';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--adopt-existing' && arg !== '--test-db')) {
  throw new Error('Usage: migrate [--adopt-existing] [--test-db]');
}
if (args.includes('--test-db')) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || new URL(url).pathname !== '/nora_synth_test') {
    throw new Error('Test migrations require TEST_DATABASE_URL targeting nora_synth_test');
  }
  process.env.DATABASE_URL = url;
}

const { pool } = await import('./pool.js');
try {
  const client = await pool.connect();
  try {
    const applied = await runMigrations(
      client, new URL('./migrations/', import.meta.url), args.includes('--adopt-existing'),
    );
    console.log(`Migration check complete; applied ${applied.length} pending migration(s).`);
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}

import { Pool } from 'pg';
import { databaseUrl } from '../config.js';

export const pool = new Pool({
  connectionString: databaseUrl(process.env.DATABASE_URL),
  connectionTimeoutMillis: 3000,
  query_timeout: 3000,
  statement_timeout: 3000,
});

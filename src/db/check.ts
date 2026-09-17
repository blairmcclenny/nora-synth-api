import { pool } from './pool.js';

try {
  const result = await pool.query('SELECT current_database(), current_user');
  console.log(result.rows);
} finally {
  await pool.end();
}

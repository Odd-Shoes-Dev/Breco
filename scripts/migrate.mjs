// Run: npm run db:migrate
// Applies all SQL files in neon/migrations/ in numeric order.
// Safe to run multiple times — tracks applied migrations in a migrations table.

import { neon } from '@neondatabase/serverless';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'neon', 'migrations');

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  // Create migrations tracking table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Get already-applied migrations
  const applied = await sql`SELECT filename FROM _migrations ORDER BY filename`;
  const appliedSet = new Set(applied.map(r => r.filename));

  // Get all migration files sorted numerically
  const files = (await readdir(MIGRATIONS_DIR))
    .filter(f => f.endsWith('.sql') && f !== 'README.md')
    .sort();

  let count = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip  ${file}`);
      continue;
    }

    const filePath = join(MIGRATIONS_DIR, file);
    const content = await readFile(filePath, 'utf8');

    console.log(`  apply ${file} ...`);
    try {
      await sql.transaction(txn => [txn(content)]);
      await sql`INSERT INTO _migrations (filename) VALUES (${file})`;
      console.log(`  done  ${file}`);
      count++;
    } catch (err) {
      console.error(`  FAILED ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log(`\nMigrations complete. ${count} file(s) applied.`);
}

run();

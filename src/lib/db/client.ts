import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Single SQL tagged-template client for the Neon serverless driver.
// Swap provider: replace this file only. All queries in lib/db/queries/
// use the `sql` export and never import from @neondatabase/serverless directly.
export const sql = neon(process.env.DATABASE_URL);

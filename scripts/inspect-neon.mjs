// Read-only inspection script — no writes. Compares Neon's current
// accounts/customers/users against the Supabase export to see what
// ID remapping will be needed before generating seed data.
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

function loadEnvLocal() {
  try {
    const content = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // no .env.local, rely on real env vars
  }
}
loadEnvLocal();

async function run() {
  const sql = neon(process.env.DATABASE_URL);

  const accounts = await sql`SELECT id, code, name FROM accounts ORDER BY code`;
  console.log(`\n=== Neon accounts: ${accounts.length} rows ===`);
  console.log(accounts.slice(0, 5));

  const customers = await sql`SELECT id, customer_number, name, email FROM customers ORDER BY customer_number`;
  console.log(`\n=== Neon customers: ${customers.length} rows ===`);
  console.log(customers.slice(0, 5));

  const users = await sql`SELECT id, email, full_name FROM users ORDER BY email`;
  console.log(`\n=== Neon users: ${users.length} rows ===`);
  console.log(users);

  const invoiceCount = await sql`SELECT COUNT(*) FROM invoices`;
  const jeCount = await sql`SELECT COUNT(*) FROM journal_entries`;
  const jlCount = await sql`SELECT COUNT(*) FROM journal_lines`;
  console.log(`\n=== Current Neon transactional counts ===`);
  console.log({ invoices: invoiceCount[0].count, journal_entries: jeCount[0].count, journal_lines: jlCount[0].count });

  const fiscalPeriods = await sql`SELECT id, name, start_date, end_date, level FROM fiscal_periods WHERE level = 'monthly' ORDER BY start_date`;
  console.log(`\n=== Neon fiscal_periods (monthly): ${fiscalPeriods.length} rows ===`);
  console.log(fiscalPeriods.map(p => `${p.name}: ${p.start_date.toISOString().slice(0,10)} to ${p.end_date.toISOString().slice(0,10)}`));

  const custDup = await sql`SELECT COUNT(*) FROM customers`;
  const vendDup = await sql`SELECT COUNT(*) FROM vendors`;
  console.log(`\n=== other counts === customers: ${custDup[0].count}, vendors: ${vendDup[0].count}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

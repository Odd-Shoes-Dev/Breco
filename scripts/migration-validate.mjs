import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnvLocal() {
  try {
    const content = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {}
}
loadEnvLocal();

async function run() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('=== Account code resolution (journal_lines.account_id -> Neon accounts.code) ===');
  const unmatchedAccounts = await sql`
    SELECT DISTINCT jl.account_id, sa.code, sa.name
    FROM staging.journal_lines jl
    LEFT JOIN staging.accounts sa ON sa.id = jl.account_id
    WHERE sa.code NOT IN (SELECT code FROM accounts) OR sa.code IS NULL
  `;
  console.log(unmatchedAccounts.length === 0 ? '  All journal_lines account codes resolve.' : unmatchedAccounts);

  console.log('\n=== invoices.ar_account_id resolution ===');
  const unmatchedAr = await sql`
    SELECT DISTINCT i.ar_account_id, sa.code
    FROM staging.invoices i
    LEFT JOIN staging.accounts sa ON sa.id = i.ar_account_id
    WHERE i.ar_account_id IS NOT NULL AND (sa.code NOT IN (SELECT code FROM accounts) OR sa.code IS NULL)
  `;
  console.log(unmatchedAr.length === 0 ? '  All ar_account_id resolve (or null).' : unmatchedAr);

  console.log('\n=== created_by / posted_by resolution via email ===');
  const userMap = await sql`
    SELECT sup.id AS supabase_id, sup.email, u.id AS neon_id
    FROM staging.user_profiles sup
    LEFT JOIN users u ON u.email = sup.email
  `;
  console.log(userMap);
  const unmatchedCreators = await sql`
    SELECT DISTINCT created_by FROM staging.invoices
    WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM staging.user_profiles)
    UNION
    SELECT DISTINCT created_by FROM staging.journal_entries
    WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM staging.user_profiles)
  `;
  console.log(unmatchedCreators.length === 0 ? '  All created_by values resolve to a known user_profile.' : unmatchedCreators);

  console.log('\n=== invoice_lines.product_id resolution against Neon products ===');
  const productIds = await sql`SELECT DISTINCT product_id FROM staging.invoice_lines WHERE product_id IS NOT NULL`;
  const neonProductCount = await sql`SELECT COUNT(*) FROM products`;
  console.log(`  distinct product_ids referenced: ${productIds.length}, Neon products table has: ${neonProductCount[0].count} rows`);
  if (Number(neonProductCount[0].count) > 0) {
    const matched = await sql`
      SELECT DISTINCT il.product_id FROM staging.invoice_lines il
      WHERE il.product_id IN (SELECT id FROM products)
    `;
    console.log(`  of those, ${matched.length} match an existing Neon product`);
  }

  console.log('\n=== journal entry balance check (debit sum vs credit sum per entry) ===');
  const balanceCheck = await sql`
    SELECT journal_entry_id, SUM(debit) AS total_debit, SUM(credit) AS total_credit
    FROM staging.journal_lines
    GROUP BY journal_entry_id
  `;
  console.log(balanceCheck);

  console.log('\n=== invoices.journal_entry_id / booking_id references ===');
  const jeRefs = await sql`SELECT id, journal_entry_id, booking_id FROM staging.invoices WHERE journal_entry_id IS NOT NULL OR booking_id IS NOT NULL`;
  console.log(jeRefs);

  console.log('\n=== journal_entries missing entry_date fiscal period coverage ===');
  const periodCheck = await sql`
    SELECT je.id, je.entry_date,
      (SELECT id FROM fiscal_periods fp WHERE fp.level='monthly' AND fp.start_date <= je.entry_date AND fp.end_date >= je.entry_date LIMIT 1) AS matched_period
    FROM staging.journal_entries je
  `;
  console.log(periodCheck);

  console.log('\n=== distinct invoice status / document_type values ===');
  const statusVals = await sql`SELECT DISTINCT status, document_type FROM staging.invoices`;
  console.log(statusVals);

  console.log('\n=== customers: any email collisions with existing Neon customers ===');
  const custCollisions = await sql`SELECT sc.email FROM staging.customers sc WHERE sc.email IN (SELECT email FROM customers WHERE email IS NOT NULL)`;
  console.log(custCollisions.length === 0 ? '  No collisions (Neon customers table is empty).' : custCollisions);

  console.log('\n=== Sample: full first invoice + its lines (for eyeballing) ===');
  const sampleInv = await sql`SELECT * FROM staging.invoices ORDER BY invoice_number LIMIT 1`;
  console.log(sampleInv);
}

run().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});

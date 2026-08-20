// Loads the Supabase export dumps into an isolated `staging` schema in Neon
// (never touches real tables), then runs validation queries so we can see
// exactly what will/won't resolve before generating the real seed migration.
// Safe to re-run — drops and recreates the staging schema each time.
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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {}
}
loadEnvLocal();

const EXPORT_DIR = join(__dirname, '..', 'supabase', 'supabase-export');

async function run() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('Dropping and recreating staging schema...');
  await sql`DROP SCHEMA IF EXISTS staging CASCADE`;
  await sql`CREATE SCHEMA staging`;

  await sql`
    CREATE TABLE staging.accounts (
      id uuid, code text, name text, description text, account_type text,
      account_subtype text, parent_id uuid, currency text, is_system boolean,
      is_active boolean, is_bank_account boolean, bank_account_id uuid,
      normal_balance text, created_at timestamptz, updated_at timestamptz
    )`;
  await sql`
    CREATE TABLE staging.customers (
      id uuid, customer_number text, name text, company_name text, email text,
      phone text, address_line1 text, address_line2 text, city text, state text,
      zip_code text, country text, tax_exempt boolean, tax_id text,
      payment_terms integer, credit_limit numeric, currency text, notes text,
      is_active boolean, created_at timestamptz, updated_at timestamptz,
      current_balance numeric, email_2 text, email_3 text, email_4 text
    )`;
  await sql`
    CREATE TABLE staging.user_profiles (
      id uuid, email text, full_name text, role text, department text,
      phone text, is_active boolean, last_login timestamptz,
      created_at timestamptz, updated_at timestamptz
    )`;
  await sql`
    CREATE TABLE staging.invoices (
      id uuid, invoice_number text, customer_id uuid, invoice_date date, due_date date,
      subtotal numeric, tax_amount numeric, discount_amount numeric, total numeric,
      amount_paid numeric, balance_due numeric, currency text, exchange_rate numeric,
      status text, payment_terms integer, po_number text, notes text,
      terms_and_conditions text, stripe_invoice_id text, stripe_payment_intent_id text,
      pdf_url text, journal_entry_id uuid, ar_account_id uuid, sent_at timestamptz,
      sent_to_email text, created_by uuid, created_at timestamptz, updated_at timestamptz,
      document_type text, quotation_number text, proforma_number text, receipt_number text,
      booking_id uuid, is_advance_payment boolean, service_start_date date, service_end_date date,
      revenue_recognized_amount numeric, revenue_recognition_date date, reference_invoice_number text
    )`;
  await sql`
    CREATE TABLE staging.invoice_lines (
      id uuid, invoice_id uuid, line_number integer, product_id uuid, description text,
      quantity numeric, unit_price numeric, discount_percent numeric, discount_amount numeric,
      tax_rate numeric, tax_amount numeric, line_total numeric, revenue_account_id uuid,
      created_at timestamptz
    )`;
  await sql`
    CREATE TABLE staging.journal_entries (
      id uuid, entry_number text, entry_date date, period_id uuid, description text,
      memo text, source_module text, source_document_id uuid, status text,
      is_adjusting boolean, is_closing boolean, is_reversing boolean, reversed_entry_id uuid,
      created_by uuid, posted_by uuid, posted_at timestamptz,
      created_at timestamptz, updated_at timestamptz
    )`;
  await sql`
    CREATE TABLE staging.journal_lines (
      id uuid, journal_entry_id uuid, line_number integer, account_id uuid, description text,
      debit numeric, credit numeric, currency text, exchange_rate numeric,
      base_debit numeric, base_credit numeric, customer_id uuid, vendor_id uuid,
      project_id uuid, department text, created_at timestamptz
    )`;

  const files = [
    'accounts_rows.sql',
    'customers_rows.sql',
    'user_profiles_rows.sql',
    'invoices_rows.sql',
    'invoice_lines_rows.sql',
    'journal_entries_rows.sql',
    'journal_lines_rows.sql',
  ];

  for (const file of files) {
    const table = file.replace('_rows.sql', '');
    const raw = readFileSync(join(EXPORT_DIR, file), 'utf8').trim();
    if (!raw) {
      console.log(`  ${file}: empty, skipping`);
      continue;
    }
    // Redirect the INSERT target from public.<table> to staging.<table>
    const rewritten = raw.replace(
      new RegExp(`INSERT INTO "public"\\."${table}"`),
      `INSERT INTO staging.${table}`
    );
    console.log(`  loading ${file} into staging.${table} ...`);
    await sql.transaction((txn) => [txn.query(rewritten)]);
  }

  console.log('\n=== Row counts ===');
  for (const file of files) {
    const table = file.replace('_rows.sql', '');
    const rows = await sql.query(`SELECT COUNT(*) FROM staging.${table}`);
    console.log(`  staging.${table}: ${rows[0].count}`);
  }

  console.log('\nStaging load complete. Run scripts/migration-validate.mjs next.');
}

run().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});

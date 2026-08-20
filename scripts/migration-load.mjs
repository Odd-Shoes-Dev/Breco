// Loads customers, invoices, and invoice_lines from the staging schema
// (populated by migration-staging.mjs) into the real Neon tables, with
// IDs remapped where needed (accounts by code, users by email).
//
// Journal entries/lines are intentionally skipped (not linked to any
// payment record in this dataset — decided with the user).
//
// Default mode is a DRY RUN: prints exactly what would be inserted,
// writes nothing. Pass --commit to actually perform the writes.
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

const COMMIT = process.argv.includes('--commit');

async function run() {
  const sql = neon(process.env.DATABASE_URL);

  console.log(COMMIT ? '*** COMMIT MODE — writes will happen ***\n' : '*** DRY RUN — no writes will happen ***\n');

  // ---- CUSTOMERS ----
  const customerPlan = await sql`
    SELECT id, customer_number, name, company_name, email, phone,
      address_line1, address_line2, city, state, zip_code, country,
      tax_exempt, tax_id, payment_terms, credit_limit, currency, notes,
      is_active, created_at, updated_at, email_2, email_3, email_4
    FROM staging.customers
    ORDER BY customer_number
  `;
  console.log(`=== Customers to insert: ${customerPlan.length} ===`);
  console.log(customerPlan.map(c => `  ${c.customer_number}  ${c.name}  (${c.currency})`).join('\n'));

  // ---- INVOICES (with remapped ar_account_id, created_by) ----
  const invoicePlan = await sql`
    SELECT
      i.id, i.invoice_number, i.customer_id, i.invoice_date, i.due_date,
      i.subtotal, i.tax_amount, i.discount_amount, i.total, i.amount_paid,
      i.currency, i.exchange_rate, i.status, i.payment_terms, i.po_number,
      i.notes, i.sent_at, i.document_type, i.quotation_number,
      i.proforma_number, i.receipt_number, i.reference_invoice_number,
      i.created_at, i.updated_at,
      a.id AS resolved_ar_account_id,
      u.id AS resolved_created_by,
      sa.code AS ar_account_code,
      sup.email AS creator_email
    FROM staging.invoices i
    LEFT JOIN staging.accounts sa ON sa.id = i.ar_account_id
    LEFT JOIN accounts a ON a.code = sa.code
    LEFT JOIN staging.user_profiles sup ON sup.id = i.created_by
    LEFT JOIN users u ON u.email = sup.email
    ORDER BY i.invoice_number
  `;
  console.log(`\n=== Invoices to insert: ${invoicePlan.length} ===`);
  for (const inv of invoicePlan) {
    const arOk = !inv.ar_account_code || inv.resolved_ar_account_id ? 'ok' : 'UNRESOLVED';
    const creatorOk = !inv.creator_email || inv.resolved_created_by ? 'ok' : 'UNRESOLVED';
    console.log(`  ${inv.invoice_number}  ${inv.status}  ${inv.currency} ${inv.total}  ar:${arOk}  creator:${creatorOk}`);
  }
  const unresolvedAr = invoicePlan.filter(i => i.ar_account_code && !i.resolved_ar_account_id);
  const unresolvedCreator = invoicePlan.filter(i => i.creator_email && !i.resolved_created_by);
  if (unresolvedAr.length || unresolvedCreator.length) {
    console.log('\n!!! UNRESOLVED REFERENCES — aborting !!!');
    console.log({ unresolvedAr, unresolvedCreator });
    process.exit(1);
  }

  // ---- INVOICE LINES (product_id always nulled — Neon products table is empty) ----
  const linesPlan = await sql`
    SELECT id, invoice_id, line_number, description, quantity, unit_price,
      discount_percent, discount_amount, tax_rate, tax_amount, line_total, created_at
    FROM staging.invoice_lines
    ORDER BY invoice_id, line_number
  `;
  console.log(`\n=== Invoice lines to insert: ${linesPlan.length} (product_id will be set NULL for all) ===`);

  if (!COMMIT) {
    console.log('\nDry run complete. Re-run with --commit to write these rows.');
    return;
  }

  console.log('\nWriting...');

  for (const c of customerPlan) {
    await sql`
      INSERT INTO customers (
        id, customer_number, name, company_name, email, phone,
        address_line1, address_line2, city, state, zip_code, country,
        tax_exempt, tax_id, payment_terms, credit_limit, currency, notes,
        is_active, created_at, updated_at, email_2, email_3, email_4
      ) VALUES (
        ${c.id}, ${c.customer_number}, ${c.name}, ${c.company_name}, ${c.email}, ${c.phone},
        ${c.address_line1}, ${c.address_line2}, ${c.city}, ${c.state}, ${c.zip_code}, ${c.country},
        ${c.tax_exempt}, ${c.tax_id}, ${c.payment_terms}, ${c.credit_limit}, ${c.currency}, ${c.notes},
        ${c.is_active}, ${c.created_at}, ${c.updated_at}, ${c.email_2}, ${c.email_3}, ${c.email_4}
      )
    `;
  }
  console.log(`  inserted ${customerPlan.length} customers`);

  for (const inv of invoicePlan) {
    await sql`
      INSERT INTO invoices (
        id, invoice_number, customer_id, invoice_date, due_date,
        subtotal, tax_amount, discount_amount, total, amount_paid,
        currency, exchange_rate, status, payment_terms, po_number,
        notes, sent_at, document_type, quotation_number,
        proforma_number, receipt_number, reference_invoice_number,
        ar_account_id, created_by, created_at, updated_at
      ) VALUES (
        ${inv.id}, ${inv.invoice_number}, ${inv.customer_id}, ${inv.invoice_date}, ${inv.due_date},
        ${inv.subtotal}, ${inv.tax_amount}, ${inv.discount_amount}, ${inv.total}, ${inv.amount_paid},
        ${inv.currency}, ${inv.exchange_rate}, ${inv.status}, ${inv.payment_terms}, ${inv.po_number},
        ${inv.notes}, ${inv.sent_at}, ${inv.document_type}, ${inv.quotation_number},
        ${inv.proforma_number}, ${inv.receipt_number}, ${inv.reference_invoice_number},
        ${inv.resolved_ar_account_id}, ${inv.resolved_created_by}, ${inv.created_at}, ${inv.updated_at}
      )
    `;
  }
  console.log(`  inserted ${invoicePlan.length} invoices`);

  for (const line of linesPlan) {
    await sql`
      INSERT INTO invoice_lines (
        id, invoice_id, line_number, product_id, description, quantity,
        unit_price, discount_percent, discount_amount, tax_rate, tax_amount,
        line_total, created_at
      ) VALUES (
        ${line.id}, ${line.invoice_id}, ${line.line_number}, NULL, ${line.description}, ${line.quantity},
        ${line.unit_price}, ${line.discount_percent}, ${line.discount_amount}, ${line.tax_rate}, ${line.tax_amount},
        ${line.line_total}, ${line.created_at}
      )
    `;
  }
  console.log(`  inserted ${linesPlan.length} invoice lines`);

  // ---- Recompute customer running balances from the loaded invoice data ----
  const customers = await sql`SELECT id, currency FROM customers`;
  for (const cust of customers) {
    const unpaid = await sql`
      SELECT total, amount_paid, currency, invoice_date FROM invoices
      WHERE customer_id = ${cust.id} AND status NOT IN ('paid', 'void', 'cancelled')
    `;
    let balance = 0;
    for (const inv of unpaid) {
      const remaining = Number(inv.total) - Number(inv.amount_paid || 0);
      if (remaining <= 0) continue;
      let remainingConverted = remaining;
      if (inv.currency !== cust.currency) {
        try {
          const conv = await sql`SELECT convert_currency(${remaining}, ${inv.currency}, ${cust.currency}, ${inv.invoice_date}) AS val`;
          remainingConverted = Number(conv[0]?.val ?? remaining);
        } catch {}
      }
      balance += remainingConverted;
    }
    await sql`UPDATE customers SET current_balance = ${balance} WHERE id = ${cust.id}`;
  }
  console.log(`  recomputed current_balance for ${customers.length} customers`);

  console.log('\nDone.');
}

run().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});

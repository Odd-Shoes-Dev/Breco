import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/receipts/[id] - Get payment details
export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const rows = await sql`
      SELECT pr.*,
        row_to_json(c.*) AS customer,
        row_to_json(a.*) AS deposit_account,
        row_to_json(je.*) AS journal_entry,
        (
          SELECT json_agg(json_build_object(
            'id', pa.id,
            'amount_applied', pa.amount_applied,
            'invoice', json_build_object(
              'id', i.id, 'invoice_number', i.invoice_number,
              'invoice_date', i.invoice_date, 'total', i.total,
              'amount_paid', i.amount_paid, 'status', i.status
            )
          ))
          FROM payment_applications pa
          LEFT JOIN invoices i ON i.id = pa.invoice_id
          WHERE pa.payment_id = pr.id
        ) AS payment_applications
      FROM payments_received pr
      LEFT JOIN customers c ON c.id = pr.customer_id
      LEFT JOIN accounts a ON a.id = pr.deposit_to_account_id
      LEFT JOIN journal_entries je ON je.id = pr.journal_entry_id
      WHERE pr.id = ${params.id}
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/receipts/[id] - Void payment
export async function DELETE(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    // Get payment with applications
    const paymentRows = await sql`
      SELECT pr.*,
        (
          SELECT json_agg(json_build_object('id', pa.id, 'invoice_id', pa.invoice_id, 'amount_applied', pa.amount_applied))
          FROM payment_applications pa
          WHERE pa.payment_id = pr.id
        ) AS payment_applications
      FROM payments_received pr
      WHERE pr.id = ${params.id}
    `;

    const payment = paymentRows[0];
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reverse invoice applications
    const paymentApps = payment.payment_applications || [];
    if (paymentApps.length > 0) {
      for (const app of paymentApps) {
        const invoiceRows = await sql`
          SELECT amount_paid, total, status FROM invoices WHERE id = ${app.invoice_id}
        `;
        const invoice = invoiceRows[0];

        if (invoice) {
          const newAmountPaid = Math.max(0, invoice.amount_paid - app.amount_applied);
          let newStatus = invoice.status;

          if (newAmountPaid === 0) {
            newStatus = 'sent';
          } else if (newAmountPaid < invoice.total) {
            newStatus = 'partial';
          }

          await sql`
            UPDATE invoices SET amount_paid = ${newAmountPaid}, status = ${newStatus}
            WHERE id = ${app.invoice_id}
          `;
        }
      }

      await sql`DELETE FROM payment_applications WHERE payment_id = ${params.id}`;
    }

    // Create reversing journal entry
    if (payment.journal_entry_id) {
      const year = new Date().getFullYear();
      const lastEntryRows = await sql`
        SELECT entry_number FROM journal_entries
        WHERE entry_number LIKE ${'JE-' + year + '-%'}
        ORDER BY entry_number DESC
        LIMIT 1
      `;

      let nextNumber = 1;
      const lastEntry = lastEntryRows[0];
      if (lastEntry?.entry_number) {
        const match = lastEntry.entry_number.match(/JE-\d{4}-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      const entryNumber = `JE-${year}-${nextNumber.toString().padStart(4, '0')}`;

      const originalLines = await sql`
        SELECT * FROM journal_lines WHERE journal_entry_id = ${payment.journal_entry_id}
      `;

      if (originalLines.length > 0) {
        const reversingEntryRows = await sql`
          INSERT INTO journal_entries (
            entry_number, entry_date, description, source_module, source_document_id,
            status, created_by, posted_by, posted_at
          ) VALUES (
            ${entryNumber}, ${new Date().toISOString().split('T')[0]},
            ${'VOID - Reverse payment ' + payment.payment_number},
            'receipts', ${payment.id}, 'posted', ${user.id}, ${user.id}, ${new Date().toISOString()}
          )
          RETURNING *
        `;

        const reversingEntry = reversingEntryRows[0];
        if (reversingEntry) {
          for (let index = 0; index < originalLines.length; index++) {
            const line = originalLines[index] as any;
            await sql`
              INSERT INTO journal_lines (
                journal_entry_id, line_number, account_id, description,
                debit, credit, base_debit, base_credit
              ) VALUES (
                ${reversingEntry.id}, ${index + 1}, ${line.account_id},
                ${'Reverse: ' + (line.description || '')},
                ${line.credit}, ${line.debit}, ${line.base_credit}, ${line.base_debit}
              )
            `;
          }
        }
      }
    }

    // Delete the payment
    await sql`DELETE FROM payments_received WHERE id = ${params.id}`;

    return NextResponse.json({ message: 'Payment voided successfully' });
  } catch (error: any) {
    console.error('Error voiding payment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

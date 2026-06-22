import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

async function createReceiptJournalEntryRaw(payment: {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
}, userId: string) {
  try {
    // Get account IDs
    const arRows = await sql`SELECT id FROM accounts WHERE code = '1200' LIMIT 1`;
    const cashCode = (payment.payment_method === 'bank_transfer' || payment.payment_method === 'check') ? '1010' : '1000';
    const cashRows = await sql`SELECT id FROM accounts WHERE code = ${cashCode} LIMIT 1`;

    if (!arRows[0] || !cashRows[0]) {
      throw new Error('Required accounts not found for receipt journal entry');
    }

    const entryNumRows = await sql`SELECT generate_journal_entry_number() AS num`;
    const entryNumber = entryNumRows[0]?.num;

    const jeRows = await sql`
      INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, status, created_by)
      VALUES (${entryNumber}, ${payment.payment_date}, ${'Receipt ' + payment.payment_number}, 'receipt', ${payment.id}, 'posted', ${userId})
      RETURNING *
    `;
    const journalEntry = jeRows[0];

    await sql`
      INSERT INTO journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
      VALUES
        (${journalEntry.id}, 1, ${cashRows[0].id}, ${payment.amount}, 0, ${'Cash received - Receipt ' + payment.payment_number}),
        (${journalEntry.id}, 2, ${arRows[0].id}, 0, ${payment.amount}, ${'Accounts receivable - Receipt ' + payment.payment_number})
    `;

    return { success: true, journalEntry };
  } catch (error) {
    console.error('Error creating receipt journal entry:', error);
    return { success: false, error };
  }
}

// GET /api/receipts - List customer payments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const customerId = searchParams.get('customer_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Build query with optional filters
    let payments;
    let countRows;

    if (customerId && startDate && endDate) {
      payments = await sql`
        SELECT pr.*,
          row_to_json(c.*) AS customer,
          row_to_json(a.*) AS deposit_account,
          (
            SELECT json_agg(json_build_object(
              'id', pa.id,
              'amount_applied', pa.amount_applied,
              'invoice', json_build_object('id', i.id, 'invoice_number', i.invoice_number, 'total', i.total)
            ))
            FROM payment_applications pa
            LEFT JOIN invoices i ON i.id = pa.invoice_id
            WHERE pa.payment_id = pr.id
          ) AS payment_applications
        FROM payments_received pr
        LEFT JOIN customers c ON c.id = pr.customer_id
        LEFT JOIN accounts a ON a.id = pr.deposit_to_account_id
        WHERE pr.customer_id = ${customerId}
          AND pr.payment_date >= ${startDate}
          AND pr.payment_date <= ${endDate}
        ORDER BY pr.payment_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) AS count FROM payments_received WHERE customer_id = ${customerId} AND payment_date >= ${startDate} AND payment_date <= ${endDate}`;
    } else if (customerId && startDate) {
      payments = await sql`
        SELECT pr.*,
          row_to_json(c.*) AS customer,
          row_to_json(a.*) AS deposit_account,
          (
            SELECT json_agg(json_build_object(
              'id', pa.id,
              'amount_applied', pa.amount_applied,
              'invoice', json_build_object('id', i.id, 'invoice_number', i.invoice_number, 'total', i.total)
            ))
            FROM payment_applications pa
            LEFT JOIN invoices i ON i.id = pa.invoice_id
            WHERE pa.payment_id = pr.id
          ) AS payment_applications
        FROM payments_received pr
        LEFT JOIN customers c ON c.id = pr.customer_id
        LEFT JOIN accounts a ON a.id = pr.deposit_to_account_id
        WHERE pr.customer_id = ${customerId} AND pr.payment_date >= ${startDate}
        ORDER BY pr.payment_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) AS count FROM payments_received WHERE customer_id = ${customerId} AND payment_date >= ${startDate}`;
    } else if (customerId && endDate) {
      payments = await sql`
        SELECT pr.*,
          row_to_json(c.*) AS customer,
          row_to_json(a.*) AS deposit_account,
          (
            SELECT json_agg(json_build_object(
              'id', pa.id,
              'amount_applied', pa.amount_applied,
              'invoice', json_build_object('id', i.id, 'invoice_number', i.invoice_number, 'total', i.total)
            ))
            FROM payment_applications pa
            LEFT JOIN invoices i ON i.id = pa.invoice_id
            WHERE pa.payment_id = pr.id
          ) AS payment_applications
        FROM payments_received pr
        LEFT JOIN customers c ON c.id = pr.customer_id
        LEFT JOIN accounts a ON a.id = pr.deposit_to_account_id
        WHERE pr.customer_id = ${customerId} AND pr.payment_date <= ${endDate}
        ORDER BY pr.payment_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) AS count FROM payments_received WHERE customer_id = ${customerId} AND payment_date <= ${endDate}`;
    } else if (customerId) {
      payments = await sql`
        SELECT pr.*,
          row_to_json(c.*) AS customer,
          row_to_json(a.*) AS deposit_account,
          (
            SELECT json_agg(json_build_object(
              'id', pa.id,
              'amount_applied', pa.amount_applied,
              'invoice', json_build_object('id', i.id, 'invoice_number', i.invoice_number, 'total', i.total)
            ))
            FROM payment_applications pa
            LEFT JOIN invoices i ON i.id = pa.invoice_id
            WHERE pa.payment_id = pr.id
          ) AS payment_applications
        FROM payments_received pr
        LEFT JOIN customers c ON c.id = pr.customer_id
        LEFT JOIN accounts a ON a.id = pr.deposit_to_account_id
        WHERE pr.customer_id = ${customerId}
        ORDER BY pr.payment_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) AS count FROM payments_received WHERE customer_id = ${customerId}`;
    } else if (startDate && endDate) {
      payments = await sql`
        SELECT pr.*,
          row_to_json(c.*) AS customer,
          row_to_json(a.*) AS deposit_account,
          (
            SELECT json_agg(json_build_object(
              'id', pa.id,
              'amount_applied', pa.amount_applied,
              'invoice', json_build_object('id', i.id, 'invoice_number', i.invoice_number, 'total', i.total)
            ))
            FROM payment_applications pa
            LEFT JOIN invoices i ON i.id = pa.invoice_id
            WHERE pa.payment_id = pr.id
          ) AS payment_applications
        FROM payments_received pr
        LEFT JOIN customers c ON c.id = pr.customer_id
        LEFT JOIN accounts a ON a.id = pr.deposit_to_account_id
        WHERE pr.payment_date >= ${startDate} AND pr.payment_date <= ${endDate}
        ORDER BY pr.payment_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) AS count FROM payments_received WHERE payment_date >= ${startDate} AND payment_date <= ${endDate}`;
    } else {
      payments = await sql`
        SELECT pr.*,
          row_to_json(c.*) AS customer,
          row_to_json(a.*) AS deposit_account,
          (
            SELECT json_agg(json_build_object(
              'id', pa.id,
              'amount_applied', pa.amount_applied,
              'invoice', json_build_object('id', i.id, 'invoice_number', i.invoice_number, 'total', i.total)
            ))
            FROM payment_applications pa
            LEFT JOIN invoices i ON i.id = pa.invoice_id
            WHERE pa.payment_id = pr.id
          ) AS payment_applications
        FROM payments_received pr
        LEFT JOIN customers c ON c.id = pr.customer_id
        LEFT JOIN accounts a ON a.id = pr.deposit_to_account_id
        ORDER BY pr.payment_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) AS count FROM payments_received`;
    }

    const count = parseInt(countRows[0]?.count || '0');

    return NextResponse.json({
      data: payments,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/receipts - Record customer payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.customer_id || !body.payment_date || !body.amount || !body.payment_method) {
      return NextResponse.json(
        { error: 'Missing required fields: customer_id, payment_date, amount, payment_method' },
        { status: 400 }
      );
    }

    if (!body.deposit_to_account_id) {
      return NextResponse.json(
        { error: 'Missing deposit_to_account_id - specify which bank/cash account to deposit to' },
        { status: 400 }
      );
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate payment number
    const year = new Date(body.payment_date).getFullYear();
    const lastPaymentRows = await sql`
      SELECT payment_number FROM payments_received
      WHERE payment_number LIKE ${'PMT-' + year + '-%'}
      ORDER BY payment_number DESC
      LIMIT 1
    `;

    let nextNumber = 1;
    const lastPayment = lastPaymentRows[0];
    if (lastPayment?.payment_number) {
      const match = lastPayment.payment_number.match(/PMT-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const paymentNumber = `PMT-${year}-${nextNumber.toString().padStart(5, '0')}`;

    // Validate invoice applications if provided
    const applications = body.invoice_applications || [];
    let totalApplied = 0;

    if (applications.length > 0) {
      const invoiceIds = applications.map((app: any) => app.invoice_id);
      const invoices = await sql`
        SELECT id, customer_id, total, amount_paid FROM invoices
        WHERE id = ANY(${invoiceIds})
      `;

      if (!invoices || invoices.length !== invoiceIds.length) {
        return NextResponse.json(
          { error: 'One or more invoices not found' },
          { status: 404 }
        );
      }

      const invalidInvoices = invoices.filter((inv: any) => inv.customer_id !== body.customer_id);
      if (invalidInvoices.length > 0) {
        return NextResponse.json(
          { error: 'One or more invoices do not belong to the specified customer' },
          { status: 400 }
        );
      }

      totalApplied = applications.reduce((sum: number, app: any) => sum + app.amount_applied, 0);

      if (totalApplied > body.amount) {
        return NextResponse.json(
          { error: `Total applied (${totalApplied}) exceeds payment amount (${body.amount})` },
          { status: 400 }
        );
      }

      for (const app of applications) {
        const invoice = invoices.find((inv: any) => inv.id === app.invoice_id);
        if (invoice) {
          const balance = invoice.total - invoice.amount_paid;
          if (app.amount_applied > balance) {
            return NextResponse.json(
              { error: `Amount applied to invoice exceeds outstanding balance` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Create payment record
    const paymentRows = await sql`
      INSERT INTO payments_received (
        payment_number, customer_id, payment_date, amount, currency, exchange_rate,
        payment_method, reference_number, deposit_to_account_id, notes, created_by
      ) VALUES (
        ${paymentNumber}, ${body.customer_id}, ${body.payment_date}, ${body.amount},
        ${body.currency || 'USD'}, ${body.exchange_rate || 1.0},
        ${body.payment_method}, ${body.reference_number || null},
        ${body.deposit_to_account_id}, ${body.notes || null}, ${user.id}
      )
      RETURNING *
    `;
    const payment = paymentRows[0];

    if (!payment) {
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 400 });
    }

    // Create payment applications
    if (applications.length > 0) {
      for (const app of applications) {
        try {
          await sql`
            INSERT INTO payment_applications (payment_id, invoice_id, amount_applied)
            VALUES (${payment.id}, ${app.invoice_id}, ${app.amount_applied})
          `;
        } catch (appError: any) {
          // Rollback payment
          await sql`DELETE FROM payments_received WHERE id = ${payment.id}`;
          return NextResponse.json({ error: appError.message }, { status: 400 });
        }

        // Update invoice amount_paid and status
        const invoiceRows = await sql`
          SELECT total, amount_paid FROM invoices WHERE id = ${app.invoice_id}
        `;
        const invoice = invoiceRows[0];
        if (invoice) {
          const newAmountPaid = invoice.amount_paid + app.amount_applied;
          const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'partial';

          await sql`
            UPDATE invoices SET amount_paid = ${newAmountPaid}, status = ${newStatus}
            WHERE id = ${app.invoice_id}
          `;
        }
      }
    }

    // Create journal entry
    const journalResult = await createReceiptJournalEntryRaw(
      {
        id: payment.id,
        payment_number: payment.payment_number,
        payment_date: payment.payment_date,
        amount: payment.amount,
        payment_method: payment.payment_method,
      },
      user.id
    );

    if (journalResult.success && journalResult.journalEntry) {
      await sql`
        UPDATE payments_received SET journal_entry_id = ${journalResult.journalEntry.id}
        WHERE id = ${payment.id}
      `;
    } else {
      console.error('Failed to create journal entry for payment:', journalResult.error);
    }

    // Fetch complete payment with applications
    const completePaymentRows = await sql`
      SELECT pr.*,
        row_to_json(c.*) AS customer,
        row_to_json(a.*) AS deposit_account,
        (
          SELECT json_agg(json_build_object(
            'id', pa.id,
            'amount_applied', pa.amount_applied,
            'invoice', json_build_object('id', i.id, 'invoice_number', i.invoice_number, 'total', i.total)
          ))
          FROM payment_applications pa
          LEFT JOIN invoices i ON i.id = pa.invoice_id
          WHERE pa.payment_id = pr.id
        ) AS payment_applications
      FROM payments_received pr
      LEFT JOIN customers c ON c.id = pr.customer_id
      LEFT JOIN accounts a ON a.id = pr.deposit_to_account_id
      WHERE pr.id = ${payment.id}
    `;

    return NextResponse.json({ data: completePaymentRows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

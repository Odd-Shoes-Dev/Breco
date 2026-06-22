import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/invoices/[id]/payments - Record payment
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const body = await request.json();
    const invoiceId = (await params).id;

    // Validate required fields
    if (!body.amount || !body.payment_date || !body.payment_method) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, payment_date, payment_method' },
        { status: 400 }
      );
    }

    // Get current user
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get invoice
    const invoiceRows = await sql`
      SELECT total, amount_paid, status, booking_id FROM invoices WHERE id = ${invoiceId}
    `;
    if (invoiceRows.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    const invoice = invoiceRows[0];

    if (invoice.status === 'void') {
      return NextResponse.json({ error: 'Cannot record payment on voided invoice' }, { status: 400 });
    }

    const balance = invoice.total - invoice.amount_paid;
    if (body.amount > balance) {
      return NextResponse.json(
        { error: `Payment amount exceeds balance due ($${balance.toFixed(2)})` },
        { status: 400 }
      );
    }

    // Create payment record
    const paymentRows = await sql`
      INSERT INTO invoice_payments (
        invoice_id, payment_date, amount, payment_method, reference, notes,
        bank_account_id, created_by
      ) VALUES (
        ${invoiceId}, ${body.payment_date}, ${body.amount}, ${body.payment_method},
        ${body.reference || null}, ${body.notes || null},
        ${body.bank_account_id || null}, ${user.id}
      )
      RETURNING *
    `;
    const payment = paymentRows[0];

    // Update invoice amount_paid and status
    const newAmountPaid = invoice.amount_paid + body.amount;
    const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'partial';

    try {
      await sql`
        UPDATE invoices SET amount_paid = ${newAmountPaid}, status = ${newStatus} WHERE id = ${invoiceId}
      `;
    } catch (updateError: any) {
      await sql`DELETE FROM invoice_payments WHERE id = ${payment.id}`;
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Post to General Ledger - Debit Cash/Bank, Credit AR
    const arAccountRows = await sql`SELECT id FROM accounts WHERE code = '1200'`;
    const cashAccountRows = await sql`SELECT id FROM accounts WHERE code = '1000'`;
    const arAccount = arAccountRows[0];
    const cashAccount = cashAccountRows[0];

    if (arAccount && cashAccount) {
      const journalRows = await sql`
        INSERT INTO journal_entries (
          entry_date, reference, description, source_type, source_id, status, created_by
        ) VALUES (
          ${body.payment_date}, ${`Payment for ${invoiceId}`},
          ${`Payment received - ${body.payment_method}`}, 'invoice_payment', ${payment.id}, 'posted', ${user.id}
        )
        RETURNING *
      `;
      const journalEntry = journalRows[0];

      if (journalEntry) {
        await sql`
          INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description)
          VALUES
            (${journalEntry.id}, ${cashAccount.id}, ${body.amount}, 0, 'Payment received'),
            (${journalEntry.id}, ${arAccount.id}, 0, ${body.amount}, 'AR reduction')
        `;
      }
    }

    // Sync payment to related booking if exists
    if (invoice.booking_id) {
      const allBookingInvoices = await sql`
        SELECT id, total, amount_paid, currency FROM invoices WHERE booking_id = ${invoice.booking_id}
      `;
      const bookingRows = await sql`
        SELECT total, status, currency FROM bookings WHERE id = ${invoice.booking_id}
      `;
      const booking = bookingRows[0];

      if (allBookingInvoices.length > 0 && booking) {
        let totalPaidAcrossInvoices = 0;

        for (const inv of allBookingInvoices) {
          const invAmountPaid = parseFloat(inv.amount_paid) || 0;

          if (inv.currency === booking.currency) {
            totalPaidAcrossInvoices += invAmountPaid;
          } else {
            try {
              const convertedRows = await sql`
                SELECT convert_currency(${invAmountPaid}, ${inv.currency}, ${booking.currency}, ${new Date().toISOString().split('T')[0]}) AS result
              `;
              const convertedAmount = convertedRows[0]?.result;
              if (convertedAmount !== null && convertedAmount !== undefined) {
                totalPaidAcrossInvoices += convertedAmount;
              } else {
                totalPaidAcrossInvoices += invAmountPaid;
              }
            } catch {
              totalPaidAcrossInvoices += invAmountPaid;
            }
          }
        }

        let newBookingStatus = booking.status;
        const bookingTotal = parseFloat(booking.total);

        if (totalPaidAcrossInvoices >= bookingTotal) {
          newBookingStatus = 'fully_paid';
        } else if (totalPaidAcrossInvoices > 0) {
          if (!['fully_paid', 'completed'].includes(booking.status)) {
            newBookingStatus = 'deposit_paid';
          }
        }

        await sql`
          UPDATE bookings SET amount_paid = ${totalPaidAcrossInvoices}, status = ${newBookingStatus}
          WHERE id = ${invoice.booking_id}
        `;
      }
    }

    return NextResponse.json({
      data: payment,
      invoice: {
        amount_paid: newAmountPaid,
        status: newStatus,
        balance: invoice.total - newAmountPaid,
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/invoices/[id]/payments - List payments
export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const invoiceId = (await params).id;

    const payments = await sql`
      SELECT ip.*, json_build_object('name', ba.name) AS bank_accounts
      FROM invoice_payments ip
      LEFT JOIN bank_accounts ba ON ba.id = ip.bank_account_id
      WHERE ip.invoice_id = ${invoiceId}
      ORDER BY ip.payment_date DESC
    `;

    return NextResponse.json({ data: payments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

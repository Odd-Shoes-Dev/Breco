import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { createJournalEntry, getAccountByCode } from '@/lib/accounting/journal-entry-helpers';

// GET /api/bills/:id/payments - List payments for a bill
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await sql`
      SELECT
        bpa.*,
        json_build_object(
          'id', bp.id,
          'payment_number', bp.payment_number,
          'payment_date', bp.payment_date,
          'amount', bp.amount,
          'payment_method', bp.payment_method,
          'reference_number', bp.reference_number,
          'notes', bp.notes,
          'bank_account', json_build_object('id', ba.id, 'account_name', ba.account_name, 'currency', ba.currency)
        ) AS bill_payment
      FROM bill_payment_applications bpa
      LEFT JOIN bill_payments bp ON bp.id = bpa.payment_id
      LEFT JOIN bank_accounts ba ON ba.id = bp.bank_account_id
      WHERE bpa.bill_id = ${id}
      ORDER BY bpa.created_at DESC
    `;

    // Flatten the structure for easier consumption
    const payments = (rows || []).map((app: any) => ({
      id: app.id,
      payment_number: app.bill_payment.payment_number,
      payment_date: app.bill_payment.payment_date,
      amount_applied: app.amount_applied,
      payment_method: app.bill_payment.payment_method,
      reference_number: app.bill_payment.reference_number,
      notes: app.bill_payment.notes,
      bank_account: app.bill_payment.bank_account,
    }));

    return NextResponse.json({ data: payments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bills/:id/payments - Record a payment for a bill
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: billId } = await params;
    const body = await request.json();

    if (!body.payment_date || !body.amount || !body.bank_account_id) {
      return NextResponse.json(
        { error: 'Missing required fields: payment_date, amount, bank_account_id' },
        { status: 400 }
      );
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get bill details
    const billRows = await sql`
      SELECT b.*, json_build_object('name', v.name) AS vendors
      FROM bills b LEFT JOIN vendors v ON v.id = b.vendor_id
      WHERE b.id = ${billId}
    `;

    if (billRows.length === 0) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const bill = billRows[0];

    // Check if payment amount exceeds balance
    const balance = Math.round((parseFloat(bill.total || 0) - parseFloat(bill.amount_paid || 0)) * 100) / 100;
    const paymentAmount = Math.round(parseFloat(body.amount) * 100) / 100;

    if (paymentAmount > balance + 0.01) {
      return NextResponse.json(
        { error: `Payment amount cannot exceed bill balance of ${balance}` },
        { status: 400 }
      );
    }

    // Generate payment reference
    const date = new Date();
    const ref = `BP-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Get the GL account for the bank account
    const bankAccounts = await sql`SELECT gl_account_id FROM bank_accounts WHERE id = ${body.bank_account_id}`;
    const bankAccount = bankAccounts[0];

    // Create bill payment
    const paymentRows = await sql`
      INSERT INTO bill_payments (
        vendor_id, payment_number, payment_date, amount, payment_method,
        bank_account_id, reference_number, notes, currency, created_by
      ) VALUES (
        ${bill.vendor_id},
        ${body.reference || ref},
        ${body.payment_date},
        ${body.amount},
        ${body.payment_method || 'bank_transfer'},
        ${body.bank_account_id},
        ${body.reference || ref},
        ${body.notes || null},
        ${body.currency || bill.currency || 'USD'},
        ${user.id}
      )
      RETURNING *
    `;

    const payment = paymentRows[0];

    // Create bill payment application (junction table)
    try {
      await sql`
        INSERT INTO bill_payment_applications (payment_id, bill_id, amount_applied)
        VALUES (${payment.id}, ${billId}, ${body.amount})
      `;
    } catch (applicationError: any) {
      // Rollback payment
      await sql`DELETE FROM bill_payments WHERE id = ${payment.id}`;
      return NextResponse.json({ error: applicationError.message }, { status: 400 });
    }

    // Update bill amount_paid and status
    const currentAmountPaid = parseFloat(bill.amount_paid || 0);
    const billTotal = parseFloat(bill.total || 0);
    const newAmountPaid = currentAmountPaid + body.amount;
    const newStatus = newAmountPaid >= billTotal ? 'paid' : 'partial';

    try {
      await sql`
        UPDATE bills SET amount_paid = ${newAmountPaid}, status = ${newStatus} WHERE id = ${billId}
      `;
    } catch (updateError: any) {
      // Rollback payment
      await sql`DELETE FROM bill_payments WHERE id = ${payment.id}`;
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Update vendor balance
    try {
      await sql`SELECT update_vendor_balance(${bill.vendor_id}, ${-body.amount})`;
    } catch (vendorError) {
      console.error('Failed to update vendor balance:', vendorError);
    }

    // Create journal entry for payment
    const apAccountId = await getAccountByCode('2000');
    let cashAccountId = bankAccount?.gl_account_id;
    if (!cashAccountId) {
      cashAccountId = await getAccountByCode('1010');
    }

    if (apAccountId && cashAccountId) {
      const journalResult = await createJournalEntry({
        entry_date: body.payment_date,
        description: `Payment for Bill ${bill.bill_number} - ${bill.vendors?.name || 'Vendor'}`,
        source_module: 'bill_payment',
        lines: [
          {
            account_id: apAccountId,
            debit: body.amount,
            credit: 0,
            description: `AP payment - Bill ${bill.bill_number}`,
          },
          {
            account_id: cashAccountId,
            debit: 0,
            credit: body.amount,
            description: `Payment - Bill ${bill.bill_number}`,
          },
        ],
        created_by: user.id,
        status: 'posted',
      });

      if (!journalResult.success) {
        console.error('Failed to create journal entry for bill payment:', journalResult.error);
      }
    }

    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

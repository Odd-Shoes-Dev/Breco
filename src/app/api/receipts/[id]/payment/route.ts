import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/receipts/:id/payment - Record additional payment for receipt
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: receiptId } = await params;
    const body = await request.json();

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 400 }
      );
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current receipt
    const receiptRows = await sql`
      SELECT * FROM invoices
      WHERE id = ${receiptId} AND document_type = 'receipt'
    `;
    const receipt = receiptRows[0];

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    // Calculate balance due
    const currentAmountPaid = parseFloat(receipt.amount_paid || 0);
    const total = parseFloat(receipt.total || 0);
    const balanceDue = Math.round((total - currentAmountPaid) * 100) / 100;

    if (body.amount > balanceDue + 0.01) {
      return NextResponse.json(
        { error: `Payment amount cannot exceed balance due of ${balanceDue}` },
        { status: 400 }
      );
    }

    // Update receipt amount_paid
    const newAmountPaid = Math.round((currentAmountPaid + body.amount) * 100) / 100;
    const newStatus = newAmountPaid >= total - 0.01 ? 'paid' : 'partial';

    await sql`
      UPDATE invoices SET amount_paid = ${newAmountPaid}, status = ${newStatus}
      WHERE id = ${receiptId}
    `;

    // Optionally record payment in payments_received for audit trail
    try {
      const date = new Date();
      const paymentNumber = `PMT-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      await sql`
        INSERT INTO payments_received (
          payment_number, customer_id, payment_date, amount, payment_method,
          reference_number, notes, currency, created_by
        ) VALUES (
          ${paymentNumber}, ${receipt.customer_id},
          ${new Date().toISOString().split('T')[0]},
          ${body.amount}, ${body.payment_method || 'cash'},
          ${'Receipt ' + receipt.receipt_number},
          ${body.notes || ('Additional payment for receipt ' + receipt.receipt_number)},
          ${receipt.currency || 'USD'}, ${user.id}
        )
      `;
    } catch (error) {
      console.error('Failed to record payment in payments_received:', error);
      // Don't fail the operation if audit trail fails
    }

    return NextResponse.json({
      success: true,
      message: 'Payment recorded successfully',
      amount_paid: newAmountPaid,
      status: newStatus,
    });
  } catch (error: any) {
    console.error('Error recording payment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

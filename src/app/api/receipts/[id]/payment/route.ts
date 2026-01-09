import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/receipts/:id/payment - Record additional payment for receipt
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: receiptId } = await params;
    const body = await request.json();

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current receipt
    const { data: receipt, error: receiptError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', receiptId)
      .eq('document_type', 'receipt')
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    // Calculate balance due
    const currentAmountPaid = parseFloat(receipt.amount_paid || 0);
    const total = parseFloat(receipt.total || 0);
    const balanceDue = Math.round((total - currentAmountPaid) * 100) / 100;

    if (body.amount > balanceDue + 0.01) { // Allow small rounding tolerance
      return NextResponse.json(
        { error: `Payment amount cannot exceed balance due of ${balanceDue}` },
        { status: 400 }
      );
    }

    // Update receipt amount_paid
    const newAmountPaid = Math.round((currentAmountPaid + body.amount) * 100) / 100;
    const newStatus = newAmountPaid >= total - 0.01 ? 'paid' : 'partial'; // Allow small tolerance for "paid" status

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        amount_paid: newAmountPaid,
        status: newStatus,
      })
      .eq('id', receiptId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Optionally record payment in payments_received for audit trail
    try {
      const date = new Date();
      const paymentNumber = `PMT-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      await supabase.from('payments_received').insert({
        payment_number: paymentNumber,
        customer_id: receipt.customer_id,
        payment_date: new Date().toISOString().split('T')[0],
        amount: body.amount,
        payment_method: body.payment_method || 'cash',
        reference_number: `Receipt ${receipt.receipt_number}`,
        notes: body.notes || `Additional payment for receipt ${receipt.receipt_number}`,
        currency: receipt.currency || 'USD',
        created_by: user.id,
      });
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

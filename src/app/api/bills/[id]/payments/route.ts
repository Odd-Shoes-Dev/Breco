import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createJournalEntry, getAccountByCode } from '@/lib/accounting/journal-entry-helpers';

// GET /api/bills/:id/payments - List payments for a bill
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data, error } = await supabase
      .from('bill_payment_applications')
      .select(`
        *,
        bill_payment:bill_payments(
          *,
          bank_account:bank_accounts(id, name, currency)
        )
      `)
      .eq('bill_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Flatten the structure for easier consumption
    const payments = (data || []).map(app => ({
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
    const supabase = await createClient();
    const { id: billId } = await params;
    const body = await request.json();

    if (!body.payment_date || !body.amount || !body.bank_account_id) {
      return NextResponse.json(
        { error: 'Missing required fields: payment_date, amount, bank_account_id' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get bill details
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('*, vendors(name)')
      .eq('id', billId)
      .single();

    if (billError || !bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Check if payment amount exceeds balance
    const balance = Math.round((parseFloat(bill.total || 0) - parseFloat(bill.amount_paid || 0)) * 100) / 100;
    const paymentAmount = Math.round(parseFloat(body.amount) * 100) / 100;
    
    if (paymentAmount > balance + 0.01) { // Add tolerance for floating-point precision
      return NextResponse.json(
        { error: `Payment amount cannot exceed bill balance of ${balance}` },
        { status: 400 }
      );
    }

    // Generate payment reference
    const date = new Date();
    const ref = `BP-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Get the GL account for the bank account
    const { data: bankAccount } = await supabase
      .from('bank_accounts')
      .select('gl_account_id')
      .eq('id', body.bank_account_id)
      .single();

    // Create bill payment
    const { data: payment, error: paymentError } = await supabase
      .from('bill_payments')
      .insert({
        vendor_id: bill.vendor_id,
        payment_number: body.reference || ref,
        payment_date: body.payment_date,
        amount: body.amount,
        payment_method: body.payment_method || 'bank_transfer',
        pay_from_account_id: bankAccount?.gl_account_id || null,
        reference_number: body.reference || ref,
        notes: body.notes || null,
        currency: body.currency || bill.currency || 'USD',
        exchange_rate: body.exchange_rate || 1,
        created_by: user.id,
      })
      .select()
      .single();

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 400 });
    }

    // Create bill payment application (junction table)
    const { error: applicationError } = await supabase
      .from('bill_payment_applications')
      .insert({
        bill_payment_id: payment.id,
        bill_id: billId,
        amount_applied: body.amount,
      });

    if (applicationError) {
      // Rollback payment
      await supabase.from('bill_payments').delete().eq('id', payment.id);
      return NextResponse.json({ error: applicationError.message }, { status: 400 });
    }

    // Update bill amount_paid and status
    const currentAmountPaid = parseFloat(bill.amount_paid || 0);
    const billTotal = parseFloat(bill.total || 0);
    const newAmountPaid = currentAmountPaid + body.amount;
    const newStatus = newAmountPaid >= billTotal ? 'paid' : 'partial';

    const { error: updateError } = await supabase
      .from('bills')
      .update({
        amount_paid: newAmountPaid,
        status: newStatus,
      })
      .eq('id', billId);

    if (updateError) {
      // Rollback payment
      await supabase.from('bill_payments').delete().eq('id', payment.id);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Update vendor balance (increase payable by reducing what we owe)
    const { error: vendorError } = await supabase.rpc('update_vendor_balance', {
      p_vendor_id: bill.vendor_id,
      p_amount: -body.amount, // Negative because we're paying down what we owe
    });

    if (vendorError) {
      console.error('Failed to update vendor balance:', vendorError);
    }

    // Create journal entry for payment
    // Debit: Accounts Payable (2000) - reducing liability
    // Credit: Cash/Bank Account - reducing asset
    const apAccountId = await getAccountByCode(supabase, '2000');
    
    // Use the GL account we already fetched
    let cashAccountId = bankAccount?.gl_account_id;
    if (!cashAccountId) {
      cashAccountId = await getAccountByCode(supabase, '1010'); // Default bank account
    }

    if (apAccountId && cashAccountId) {
      const journalResult = await createJournalEntry({
        supabase,
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

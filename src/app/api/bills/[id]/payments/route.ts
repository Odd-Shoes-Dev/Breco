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
      .from('bill_payments')
      .select(`
        *,
        bank_accounts (id, name, currency)
      `)
      .eq('bill_id', id)
      .order('payment_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
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
    const balance = bill.total - (bill.amount_paid || 0);
    if (body.amount > balance) {
      return NextResponse.json(
        { error: `Payment amount cannot exceed bill balance of ${balance}` },
        { status: 400 }
      );
    }

    // Generate payment reference
    const date = new Date();
    const ref = `BP-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Create bill payment
    const { data: payment, error: paymentError } = await supabase
      .from('bill_payments')
      .insert({
        bill_id: billId,
        payment_number: body.reference || ref,
        payment_date: body.payment_date,
        amount: body.amount,
        payment_method: body.payment_method || 'bank_transfer',
        bank_account_id: body.bank_account_id,
        reference: body.reference || ref,
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

    // Update bill amount_paid and status
    const newAmountPaid = (bill.amount_paid || 0) + body.amount;
    const newStatus = newAmountPaid >= bill.total ? 'paid' : 'partial';

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
    
    // Get bank account's GL account
    const { data: bankAccount } = await supabase
      .from('bank_accounts')
      .select('gl_account_id')
      .eq('id', body.bank_account_id)
      .single();

    let cashAccountId = bankAccount?.gl_account_id;
    if (!cashAccountId) {
      cashAccountId = await getAccountByCode(supabase, '1010'); // Default bank account
    }

    if (apAccountId && cashAccountId) {
      const journalResult = await createJournalEntry({
        supabase,
        entry_date: body.payment_date,
        description: `Payment for Bill ${bill.bill_number} - ${bill.vendors?.name || 'Vendor'}`,
        reference: payment.payment_number,
        source: 'bill_payment',
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

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/invoices/[id]/payments - Record payment
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate required fields
    if (!body.amount || !body.payment_date || !body.payment_method) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, payment_date, payment_method' },
        { status: 400 }
      );
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('total, amount_paid, status, booking_id')
      .eq('id', params.id)
      .single();

    if (invoiceError) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

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
    const { data: payment, error: paymentError } = await supabase
      .from('invoice_payments')
      .insert({
        invoice_id: params.id,
        payment_date: body.payment_date,
        amount: body.amount,
        payment_method: body.payment_method,
        reference: body.reference || null,
        notes: body.notes || null,
        bank_account_id: body.bank_account_id || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 400 });
    }

    // Update invoice amount_paid and status
    const newAmountPaid = invoice.amount_paid + body.amount;
    const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'partial';

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        amount_paid: newAmountPaid,
        status: newStatus,
      })
      .eq('id', params.id);

    if (updateError) {
      // Rollback payment
      await supabase.from('invoice_payments').delete().eq('id', payment.id);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Post to General Ledger
    // Debit Cash/Bank, Credit AR
    const { data: arAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', '1200')
      .single();

    const { data: cashAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', '1000')
      .single();

    if (arAccount && cashAccount) {
      // Create journal entry
      const { data: journalEntry, error: jeError } = await supabase
        .from('journal_entries')
        .insert({
          entry_date: body.payment_date,
          reference: `Payment for ${params.id}`,
          description: `Payment received - ${body.payment_method}`,
          source_type: 'invoice_payment',
          source_id: payment.id,
          status: 'posted',
          created_by: user.id,
        })
        .select()
        .single();

      if (!jeError && journalEntry) {
        // Create entry lines
        await supabase.from('journal_entry_lines').insert([
          {
            entry_id: journalEntry.id,
            account_id: cashAccount.id,
            debit: body.amount,
            credit: 0,
            description: 'Payment received',
          },
          {
            entry_id: journalEntry.id,
            account_id: arAccount.id,
            debit: 0,
            credit: body.amount,
            description: 'AR reduction',
          },
        ]);
      }
    }

    // Sync payment to related booking if exists
    if (invoice.booking_id) {
      // Get all invoices for this booking with currency info
      const { data: allBookingInvoices } = await supabase
        .from('invoices')
        .select('id, total, amount_paid, currency')
        .eq('booking_id', invoice.booking_id);

      // Get booking to check currency
      const { data: booking } = await supabase
        .from('bookings')
        .select('total, status, currency')
        .eq('id', invoice.booking_id)
        .single();

      if (allBookingInvoices && booking) {
        // Calculate total paid across all invoices, converting to booking currency if needed
        let totalPaidAcrossInvoices = 0;
        
        for (const inv of allBookingInvoices) {
          const invAmountPaid = parseFloat(inv.amount_paid) || 0;
          
          if (inv.currency === booking.currency) {
            // Same currency, add directly
            totalPaidAcrossInvoices += invAmountPaid;
          } else {
            // Different currency, convert using database function
            const { data: convertedAmount } = await supabase.rpc('convert_currency', {
              p_amount: invAmountPaid,
              p_from_currency: inv.currency,
              p_to_currency: booking.currency,
              p_date: new Date().toISOString().split('T')[0],
            });
            
            if (convertedAmount !== null) {
              totalPaidAcrossInvoices += convertedAmount;
            } else {
              console.warn(`Could not convert ${inv.currency} to ${booking.currency} for invoice ${inv.id}`);
              // Fallback: add the amount as-is (not ideal but better than losing data)
              totalPaidAcrossInvoices += invAmountPaid;
            }
          }
        }

        // Determine new booking status based on payment
        let newBookingStatus = booking.status;
        const bookingTotal = parseFloat(booking.total);
        
        if (totalPaidAcrossInvoices >= bookingTotal) {
          newBookingStatus = 'fully_paid';
        } else if (totalPaidAcrossInvoices > 0) {
          // Only update to deposit_paid if not already in a later status
          if (!['fully_paid', 'completed'].includes(booking.status)) {
            newBookingStatus = 'deposit_paid';
          }
        }

        // Update booking amount_paid and status (amount is now in booking currency)
        await supabase
          .from('bookings')
          .update({
            amount_paid: totalPaidAcrossInvoices,
            status: newBookingStatus,
          })
          .eq('id', invoice.booking_id);
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
    const supabase = await createClient();

    const { data: payments, error } = await supabase
      .from('invoice_payments')
      .select('*, bank_accounts (name)')
      .eq('invoice_id', params.id)
      .order('payment_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: payments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

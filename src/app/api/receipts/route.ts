import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createReceiptJournalEntry } from '@/lib/accounting/journal-entry-helpers';

// GET /api/receipts - List customer payments
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const customerId = searchParams.get('customer_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('payments_received')
      .select(`
        *,
        customer:customers(id, name, email),
        deposit_account:accounts!payments_received_deposit_to_account_id_fkey(id, name, code),
        payment_applications(
          id,
          amount_applied,
          invoice:invoices(id, invoice_number, total)
        )
      `, { count: 'exact' })
      .order('payment_date', { ascending: false });

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (startDate) {
      query = query.gte('payment_date', startDate);
    }

    if (endDate) {
      query = query.lte('payment_date', endDate);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/receipts - Record customer payment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate required fields
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate payment number
    const year = new Date(body.payment_date).getFullYear();
    const { data: lastPayment } = await supabase
      .from('payments_received')
      .select('payment_number')
      .like('payment_number', `PMT-${year}-%`)
      .order('payment_number', { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
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
      // Verify invoices exist and belong to customer
      const invoiceIds = applications.map((app: any) => app.invoice_id);
      const { data: invoices, error: invError } = await supabase
        .from('invoices')
        .select('id, customer_id, total, amount_paid')
        .in('id', invoiceIds);

      if (invError || !invoices || invoices.length !== invoiceIds.length) {
        return NextResponse.json(
          { error: 'One or more invoices not found' },
          { status: 404 }
        );
      }

      // Verify all invoices belong to the customer
      const invalidInvoices = invoices.filter(inv => inv.customer_id !== body.customer_id);
      if (invalidInvoices.length > 0) {
        return NextResponse.json(
          { error: 'One or more invoices do not belong to the specified customer' },
          { status: 400 }
        );
      }

      // Calculate total applied
      totalApplied = applications.reduce((sum: number, app: any) => sum + app.amount_applied, 0);

      // Validate amount applied doesn't exceed payment amount
      if (totalApplied > body.amount) {
        return NextResponse.json(
          { error: `Total applied (${totalApplied}) exceeds payment amount (${body.amount})` },
          { status: 400 }
        );
      }

      // Validate each application doesn't exceed invoice balance
      for (const app of applications) {
        const invoice = invoices.find(inv => inv.id === app.invoice_id);
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
    const { data: payment, error: paymentError } = await supabase
      .from('payments_received')
      .insert({
        payment_number: paymentNumber,
        customer_id: body.customer_id,
        payment_date: body.payment_date,
        amount: body.amount,
        currency: body.currency || 'USD',
        exchange_rate: body.exchange_rate || 1.0,
        payment_method: body.payment_method,
        reference_number: body.reference_number || null,
        deposit_to_account_id: body.deposit_to_account_id,
        notes: body.notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 400 });
    }

    // Create payment applications
    if (applications.length > 0) {
      const applicationRecords = applications.map((app: any) => ({
        payment_id: payment.id,
        invoice_id: app.invoice_id,
        amount_applied: app.amount_applied,
      }));

      const { error: appError } = await supabase
        .from('payment_applications')
        .insert(applicationRecords);

      if (appError) {
        // Rollback payment
        await supabase.from('payments_received').delete().eq('id', payment.id);
        return NextResponse.json({ error: appError.message }, { status: 400 });
      }

      // Update invoice amount_paid and status
      for (const app of applications) {
        const invoice = await supabase
          .from('invoices')
          .select('total, amount_paid')
          .eq('id', app.invoice_id)
          .single();

        if (invoice.data) {
          const newAmountPaid = invoice.data.amount_paid + app.amount_applied;
          const newStatus = newAmountPaid >= invoice.data.total ? 'paid' : 'partial';

          await supabase
            .from('invoices')
            .update({
              amount_paid: newAmountPaid,
              status: newStatus,
            })
            .eq('id', app.invoice_id);
        }
      }
    }

    // Create journal entry
    const journalResult = await createReceiptJournalEntry(
      supabase,
      {
        id: payment.id,
        receipt_number: payment.payment_number,
        receipt_date: payment.payment_date,
        total: payment.amount,
        payment_method: payment.payment_method,
      },
      user.id
    );

    if (journalResult.success && journalResult.journalEntry) {
      await supabase
        .from('payments_received')
        .update({ journal_entry_id: journalResult.journalEntry.id })
        .eq('id', payment.id);
    } else {
      console.error('Failed to create journal entry for payment:', journalResult.error);
    }

    // Fetch complete payment with applications
    const { data: completePayment } = await supabase
      .from('payments_received')
      .select(`
        *,
        customer:customers(id, name, email),
        deposit_account:accounts!payments_received_deposit_to_account_id_fkey(id, name, code),
        payment_applications(
          id,
          amount_applied,
          invoice:invoices(id, invoice_number, total)
        )
      `)
      .eq('id', payment.id)
      .single();

    return NextResponse.json({ data: completePayment }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

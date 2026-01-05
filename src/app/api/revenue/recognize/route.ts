import { createClient } from '@/lib/supabase/server';
import { createJournalEntry } from '@/lib/accounting/journal-entry-helpers';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/revenue/recognize - Recognize deferred revenue for completed services
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      invoice_id,
      recognition_date,
      amount, // Optional: partial recognition
    } = body;

    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 });
    }

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(id, name),
        booking:bookings(id, booking_number, status)
      `)
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Validation checks
    if (!invoice.is_advance_payment) {
      return NextResponse.json(
        { error: 'This invoice is not marked as advance payment/deferred revenue' },
        { status: 400 }
      );
    }

    if (invoice.revenue_recognized_amount >= invoice.total) {
      return NextResponse.json(
        { error: 'Revenue has already been fully recognized for this invoice' },
        { status: 400 }
      );
    }

    // Calculate amount to recognize
    const remainingAmount = invoice.total - (invoice.revenue_recognized_amount || 0);
    const recognitionAmount = amount ? Math.min(amount, remainingAmount) : remainingAmount;

    if (recognitionAmount <= 0) {
      return NextResponse.json(
        { error: 'No amount available to recognize' },
        { status: 400 }
      );
    }

    // Get accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code')
      .in('code', ['2100', '4100']); // Unearned Revenue, Tour Revenue

    const accountMap = new Map(accounts?.map(a => [a.code, a.id]));
    const unearnedRevenueId = accountMap.get('2100');
    const tourRevenueId = accountMap.get('4100');

    if (!unearnedRevenueId || !tourRevenueId) {
      return NextResponse.json(
        { error: 'Required revenue accounts not found (2100 Unearned Revenue, 4100 Tour Revenue)' },
        { status: 400 }
      );
    }

    // Create journal entry for revenue recognition
    // DR: Unearned Revenue (2100)
    // CR: Tour Revenue (4100)
    const journalResult = await createJournalEntry({
      supabase,
      entry_date: recognition_date || new Date().toISOString().split('T')[0],
      description: `Revenue recognition for Invoice ${invoice.invoice_number}`,
      source_module: 'revenue_recognition',
      lines: [
        {
          account_id: unearnedRevenueId,
          debit: recognitionAmount,
          credit: 0,
          description: `Recognize revenue - Invoice ${invoice.invoice_number}`,
        },
        {
          account_id: tourRevenueId,
          debit: 0,
          credit: recognitionAmount,
          description: `Earned revenue - Invoice ${invoice.invoice_number}`,
        },
      ],
      created_by: user.id,
    });

    if (!journalResult.success) {
      return NextResponse.json(
        { error: 'Failed to create journal entry', details: journalResult.error },
        { status: 400 }
      );
    }

    // Update invoice with recognized amount
    const newRecognizedAmount = (invoice.revenue_recognized_amount || 0) + recognitionAmount;
    const isFullyRecognized = newRecognizedAmount >= invoice.total;

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        revenue_recognized_amount: newRecognizedAmount,
        revenue_recognition_date: isFullyRecognized ? (recognition_date || new Date().toISOString().split('T')[0]) : invoice.revenue_recognition_date,
      })
      .eq('id', invoice_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Revenue recognized successfully',
      recognized_amount: recognitionAmount,
      total_recognized: newRecognizedAmount,
      remaining: invoice.total - newRecognizedAmount,
      fully_recognized: isFullyRecognized,
      journal_entry_id: journalResult.journalEntry.id,
    });

  } catch (error: any) {
    console.error('Error recognizing revenue:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/revenue/recognize-batch - Automatically recognize revenue for completed tours
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const asOf = searchParams.get('as_of') || new Date().toISOString().split('T')[0];
    const autoRecognize = searchParams.get('auto_recognize') === 'true';

    // Find invoices with unrecognized revenue where service has been completed
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(name),
        booking:bookings(booking_number, status, travel_end_date)
      `)
      .eq('is_advance_payment', true)
      .lte('service_end_date', asOf)
      .or(`revenue_recognition_date.is.null,revenue_recognized_amount.lt.total`)
      .order('service_end_date');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const eligible = invoices?.filter(inv => 
      (inv.revenue_recognized_amount || 0) < inv.total
    ) || [];

    if (autoRecognize) {
      // Automatically recognize revenue for all eligible invoices
      const results = [];
      
      for (const invoice of eligible) {
        const recognitionAmount = invoice.total - (invoice.revenue_recognized_amount || 0);
        
        // This would call the POST endpoint for each invoice
        // For now, just return the list
        results.push({
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          amount_to_recognize: recognitionAmount,
          service_end_date: invoice.service_end_date,
        });
      }

      return NextResponse.json({
        message: `Found ${eligible.length} invoices ready for revenue recognition`,
        total_amount: eligible.reduce((sum, inv) => sum + (inv.total - (inv.revenue_recognized_amount || 0)), 0),
        invoices: results,
      });
    }

    return NextResponse.json({
      count: eligible.length,
      total_unrecognized: eligible.reduce((sum, inv) => sum + (inv.total - (inv.revenue_recognized_amount || 0)), 0),
      invoices: eligible.map(inv => ({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: (inv.customer as any)?.name,
        total: inv.total,
        recognized: inv.revenue_recognized_amount || 0,
        unrecognized: inv.total - (inv.revenue_recognized_amount || 0),
        service_end_date: inv.service_end_date,
        booking_number: (inv.booking as any)?.booking_number,
      })),
    });

  } catch (error: any) {
    console.error('Error fetching unrecognized revenue:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

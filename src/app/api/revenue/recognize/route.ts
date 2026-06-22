import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

async function createJournalEntryRaw(params: {
  entry_date: string;
  description: string;
  reference_type: string;
  lines: Array<{ account_id: string; debit: number; credit: number; description: string }>;
  created_by: string;
  status?: string;
  reference_id?: string;
}) {
  try {
    const totalDebits = params.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredits = params.lines.reduce((sum, l) => sum + l.credit, 0);
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new Error(`Journal entry not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}`);
    }

    const entryNumRows = await sql`SELECT generate_journal_entry_number() AS num`;
    const entryNumber = entryNumRows[0]?.num;

    const jeRows = await sql`
      INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, status, created_by)
      VALUES (
        ${entryNumber}, ${params.entry_date}, ${params.description},
        ${params.reference_type}, ${params.reference_id || null},
        ${params.status || 'posted'}, ${params.created_by}
      )
      RETURNING *
    `;
    const journalEntry = jeRows[0];

    for (let i = 0; i < params.lines.length; i++) {
      const line = params.lines[i];
      await sql`
        INSERT INTO journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (${journalEntry.id}, ${i + 1}, ${line.account_id}, ${line.debit}, ${line.credit}, ${line.description})
      `;
    }

    return { success: true, journalEntry };
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return { success: false, error };
  }
}

// POST /api/revenue/recognize - Recognize deferred revenue for completed services
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const user = await getSession();
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
    const invoiceRows = await sql`
      SELECT i.*,
        row_to_json(c.*) AS customer,
        row_to_json(b.*) AS booking
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN bookings b ON b.id = i.booking_id
      WHERE i.id = ${invoice_id}
    `;
    const invoice = invoiceRows[0];

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

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

    const remainingAmount = invoice.total - (invoice.revenue_recognized_amount || 0);
    const recognitionAmount = amount ? Math.min(amount, remainingAmount) : remainingAmount;

    if (recognitionAmount <= 0) {
      return NextResponse.json(
        { error: 'No amount available to recognize' },
        { status: 400 }
      );
    }

    // Get accounts
    const accounts = await sql`
      SELECT id, code FROM accounts WHERE code = ANY(ARRAY['2100', '4100'])
    `;

    const accountMap = new Map(accounts.map((a: any) => [a.code, a.id]));
    const unearnedRevenueId = accountMap.get('2100');
    const tourRevenueId = accountMap.get('4100');

    if (!unearnedRevenueId || !tourRevenueId) {
      return NextResponse.json(
        { error: 'Required revenue accounts not found (2100 Unearned Revenue, 4100 Tour Revenue)' },
        { status: 400 }
      );
    }

    // Create journal entry for revenue recognition
    const journalResult = await createJournalEntryRaw({
      entry_date: recognition_date || new Date().toISOString().split('T')[0],
      description: `Revenue recognition for Invoice ${invoice.invoice_number}`,
      reference_type: 'revenue_recognition',
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

    await sql`
      UPDATE invoices
      SET revenue_recognized_amount = ${newRecognizedAmount},
          revenue_recognition_date = ${isFullyRecognized
            ? (recognition_date || new Date().toISOString().split('T')[0])
            : invoice.revenue_recognition_date}
      WHERE id = ${invoice_id}
    `;

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

// GET /api/revenue/recognize - List invoices eligible for revenue recognition
export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const asOf = searchParams.get('as_of') || new Date().toISOString().split('T')[0];
    const autoRecognize = searchParams.get('auto_recognize') === 'true';

    // Find invoices with unrecognized revenue where service has been completed
    const invoices = await sql`
      SELECT i.*,
        row_to_json(c.*) AS customer,
        row_to_json(b.*) AS booking
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN bookings b ON b.id = i.booking_id
      WHERE i.is_advance_payment = true
        AND i.service_end_date <= ${asOf}
        AND (i.revenue_recognition_date IS NULL OR i.revenue_recognized_amount < i.total)
      ORDER BY i.service_end_date
    `;

    const eligible = invoices.filter((inv: any) =>
      (inv.revenue_recognized_amount || 0) < inv.total
    );

    if (autoRecognize) {
      const results = [];

      for (const invoice of eligible) {
        const recognitionAmount = invoice.total - (invoice.revenue_recognized_amount || 0);

        results.push({
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          amount_to_recognize: recognitionAmount,
          service_end_date: invoice.service_end_date,
        });
      }

      return NextResponse.json({
        message: `Found ${eligible.length} invoices ready for revenue recognition`,
        total_amount: eligible.reduce((sum: number, inv: any) => sum + (inv.total - (inv.revenue_recognized_amount || 0)), 0),
        invoices: results,
      });
    }

    return NextResponse.json({
      count: eligible.length,
      total_unrecognized: eligible.reduce((sum: number, inv: any) => sum + (inv.total - (inv.revenue_recognized_amount || 0)), 0),
      invoices: eligible.map((inv: any) => ({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: inv.customer?.name,
        total: inv.total,
        recognized: inv.revenue_recognized_amount || 0,
        unrecognized: inv.total - (inv.revenue_recognized_amount || 0),
        service_end_date: inv.service_end_date,
        booking_number: inv.booking?.booking_number,
      })),
    });

  } catch (error: any) {
    console.error('Error fetching unrecognized revenue:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

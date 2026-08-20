import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/proformas/[id]/convert - Convert proforma to invoice
export async function POST(request: NextRequest, context: any) {
  const params = await context.params;

  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the proforma
    const rows = await sql`
      SELECT * FROM invoices
      WHERE id = ${params.id} AND document_type = 'proforma'
    `;
    const proforma = rows[0];

    if (!proforma) {
      return NextResponse.json({ error: 'Proforma invoice not found' }, { status: 404 });
    }

    // Check if already converted
    if (proforma.status === 'converted' || proforma.status === 'posted') {
      return NextResponse.json({ error: 'Proforma already converted' }, { status: 400 });
    }

    // Generate new invoice number
    const numberRows = await sql`SELECT generate_invoice_number()`;
    const invoiceNumber = numberRows[0]?.generate_invoice_number;

    // Update the proforma to invoice
    const updatedRows = await sql`
      UPDATE invoices
      SET document_type = 'invoice',
          invoice_number = ${invoiceNumber},
          status = 'draft'
      WHERE id = ${params.id}
      RETURNING *
    `;
    const updatedInvoice = updatedRows[0];

    if (!updatedInvoice) {
      return NextResponse.json({ error: 'Failed to convert proforma' }, { status: 400 });
    }

    // Mark original proforma as converted
    await sql`UPDATE invoices SET status = 'converted' WHERE id = ${params.id}`;

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      message: 'Proforma invoice converted successfully',
    });
  } catch (error: any) {
    console.error('Convert proforma error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

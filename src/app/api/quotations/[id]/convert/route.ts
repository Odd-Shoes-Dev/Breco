import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { releaseReservedInventory, reduceInventoryForInvoice } from '@/lib/accounting/inventory-server';

// POST /api/quotations/[id]/convert - Convert quotation to invoice
export async function POST(request: NextRequest, context: any) {
  const params = await context.params;

  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the quotation with lines
    const rows = await sql`
      SELECT i.*,
        COALESCE(json_agg(row_to_json(il.*)) FILTER (WHERE il.id IS NOT NULL), '[]') AS invoice_lines
      FROM invoices i
      LEFT JOIN invoice_lines il ON il.invoice_id = i.id
      WHERE i.id = ${params.id} AND i.document_type = 'quotation'
      GROUP BY i.id
    `;
    const quotation = rows[0];

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    // Check if already converted
    if (quotation.status === 'converted' || quotation.status === 'posted') {
      return NextResponse.json({ error: 'Quotation already converted' }, { status: 400 });
    }

    // Generate new invoice number
    const numberRows = await sql`SELECT generate_invoice_number()`;
    const invoiceNumber = numberRows[0]?.generate_invoice_number;

    // Update the quotation to invoice
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
      return NextResponse.json({ error: 'Failed to convert quotation' }, { status: 400 });
    }

    // Release reserved inventory (quotations have reserved stock)
    await releaseReservedInventory(null, params.id, quotation.invoice_lines);

    // Mark original quotation status
    await sql`UPDATE invoices SET status = 'converted' WHERE id = ${params.id}`;

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      message: 'Quotation converted to invoice successfully',
    });
  } catch (error: any) {
    console.error('Convert quotation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

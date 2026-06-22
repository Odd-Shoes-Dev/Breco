import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { generateInvoiceHTML } from '@/lib/pdf/invoice';
import { generateQuotationHTML } from '@/lib/pdf/quotation';
import { generateProformaHTML } from '@/lib/pdf/proforma';
import { generateReceiptHTML } from '@/lib/pdf/receipt';

export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const invoiceId = (await params).id;

    // Fetch invoice
    const invoiceRows = await sql`SELECT * FROM invoices WHERE id = ${invoiceId}`;
    if (invoiceRows.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    const invoice = invoiceRows[0];

    // Fetch customer
    const customerRows = await sql`SELECT * FROM customers WHERE id = ${invoice.customer_id}`;
    const customer = customerRows[0] || {};

    // Fetch line items
    const lineItems = await sql`
      SELECT * FROM invoice_line_items WHERE invoice_id = ${invoiceId} ORDER BY line_number
    `;

    // Generate HTML for PDF based on document type
    let html: string;
    const documentType = invoice.document_type || 'invoice';
    const pdfData = {
      invoice,
      lineItems: lineItems || [],
      customer,
    };

    switch (documentType) {
      case 'quotation':
        html = generateQuotationHTML(pdfData);
        break;
      case 'proforma':
        html = generateProformaHTML(pdfData);
        break;
      case 'receipt':
        html = generateReceiptHTML(pdfData);
        break;
      default:
        html = generateInvoiceHTML(pdfData);
    }

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

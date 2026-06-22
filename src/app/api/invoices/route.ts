import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { createInvoiceJournalEntry } from '@/lib/accounting/journal-entry-helpers';
import { validatePeriodLock } from '@/lib/accounting/period-lock';
import {
  reduceInventoryForInvoice,
  reserveInventoryForQuotation,
} from '@/lib/accounting/inventory-server';

// GET /api/invoices - List invoices
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let rows: any[];
    let countRows: any[];

    if (status && status !== 'all' && customerId && search) {
      const q = `%${search}%`;
      rows = await sql`
        SELECT i.*, json_build_object('id', c.id, 'name', c.name, 'email', c.email) AS customers
        FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.status = ${status} AND i.customer_id = ${customerId} AND i.invoice_number ILIKE ${q}
        ORDER BY i.invoice_date DESC LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`
        SELECT COUNT(*) FROM invoices WHERE status = ${status} AND customer_id = ${customerId} AND invoice_number ILIKE ${`%${search}%`}
      `;
    } else if (status && status !== 'all' && customerId) {
      rows = await sql`
        SELECT i.*, json_build_object('id', c.id, 'name', c.name, 'email', c.email) AS customers
        FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.status = ${status} AND i.customer_id = ${customerId}
        ORDER BY i.invoice_date DESC LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM invoices WHERE status = ${status} AND customer_id = ${customerId}`;
    } else if (status && status !== 'all' && search) {
      const q = `%${search}%`;
      rows = await sql`
        SELECT i.*, json_build_object('id', c.id, 'name', c.name, 'email', c.email) AS customers
        FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.status = ${status} AND i.invoice_number ILIKE ${q}
        ORDER BY i.invoice_date DESC LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM invoices WHERE status = ${status} AND invoice_number ILIKE ${`%${search}%`}`;
    } else if (customerId && search) {
      const q = `%${search}%`;
      rows = await sql`
        SELECT i.*, json_build_object('id', c.id, 'name', c.name, 'email', c.email) AS customers
        FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.customer_id = ${customerId} AND i.invoice_number ILIKE ${q}
        ORDER BY i.invoice_date DESC LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM invoices WHERE customer_id = ${customerId} AND invoice_number ILIKE ${`%${search}%`}`;
    } else if (status && status !== 'all') {
      rows = await sql`
        SELECT i.*, json_build_object('id', c.id, 'name', c.name, 'email', c.email) AS customers
        FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.status = ${status}
        ORDER BY i.invoice_date DESC LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM invoices WHERE status = ${status}`;
    } else if (customerId) {
      rows = await sql`
        SELECT i.*, json_build_object('id', c.id, 'name', c.name, 'email', c.email) AS customers
        FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.customer_id = ${customerId}
        ORDER BY i.invoice_date DESC LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM invoices WHERE customer_id = ${customerId}`;
    } else if (search) {
      const q = `%${search}%`;
      rows = await sql`
        SELECT i.*, json_build_object('id', c.id, 'name', c.name, 'email', c.email) AS customers
        FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.invoice_number ILIKE ${q}
        ORDER BY i.invoice_date DESC LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM invoices WHERE invoice_number ILIKE ${`%${search}%`}`;
    } else {
      rows = await sql`
        SELECT i.*, json_build_object('id', c.id, 'name', c.name, 'email', c.email) AS customers
        FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
        ORDER BY i.invoice_date DESC LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM invoices`;
    }

    const count = parseInt(countRows[0].count);

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/invoices - Create invoice
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.customer_id || !body.invoice_date || !body.due_date) {
      return NextResponse.json(
        { error: 'Missing required fields: customer_id, invoice_date, due_date' },
        { status: 400 }
      );
    }

    // Check if period is closed
    const periodError = await validatePeriodLock(sql, body.invoice_date);
    if (periodError) {
      return NextResponse.json({ error: periodError }, { status: 403 });
    }

    // Get current user
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine document type and generate appropriate number
    const documentType = body.document_type || 'invoice';
    let documentNumber: string;
    let numberField: string;

    switch (documentType) {
      case 'quotation': {
        const rows = await sql`SELECT generate_quotation_number() AS num`;
        if (!rows[0]?.num) return NextResponse.json({ error: 'Failed to generate quotation number' }, { status: 500 });
        documentNumber = rows[0].num;
        numberField = 'quotation_number';
        break;
      }
      case 'proforma': {
        const rows = await sql`SELECT generate_proforma_number() AS num`;
        if (!rows[0]?.num) return NextResponse.json({ error: 'Failed to generate proforma number' }, { status: 500 });
        documentNumber = rows[0].num;
        numberField = 'proforma_number';
        break;
      }
      case 'receipt': {
        const rows = await sql`SELECT generate_receipt_number() AS num`;
        if (!rows[0]?.num) return NextResponse.json({ error: 'Failed to generate receipt number' }, { status: 500 });
        documentNumber = rows[0].num;
        numberField = 'receipt_number';
        break;
      }
      default: {
        const rows = await sql`SELECT generate_invoice_number() AS num`;
        if (!rows[0]?.num) return NextResponse.json({ error: 'Failed to generate invoice number' }, { status: 500 });
        documentNumber = rows[0].num;
        numberField = 'invoice_number';
      }
    }

    // Get AR account
    const arAccountRows = await sql`SELECT id FROM accounts WHERE code = '1200'`;
    const arAccountId = arAccountRows[0]?.id || null;

    // Calculate totals from lines
    const lines = body.lines || [];
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    lines.forEach((line: any) => {
      const lineSubtotal = line.quantity * line.unit_price;
      const lineDiscount = lineSubtotal * ((line.discount_percent || 0) / 100);
      const lineNet = lineSubtotal - lineDiscount;
      const lineTax = lineNet * (line.tax_rate || 0);
      subtotal += lineNet;
      taxAmount += lineTax;
      discountAmount += lineDiscount;
    });

    const total = subtotal + taxAmount;

    // Build number fields
    const tempNumber = `TEMP-${Date.now()}`;
    const quotationNumber = documentType === 'quotation' ? documentNumber : null;
    const proformaNumber = documentType === 'proforma' ? documentNumber : null;
    const receiptNumber = documentType === 'receipt' ? documentNumber : null;
    const invoiceNumber = documentType === 'invoice' ? documentNumber : tempNumber;

    // Create invoice
    const invoiceRows = await sql`
      INSERT INTO invoices (
        invoice_number, quotation_number, proforma_number, receipt_number,
        customer_id, invoice_date, due_date, payment_terms, po_number, notes,
        currency, subtotal, tax_amount, discount_amount, total, amount_paid,
        status, ar_account_id, created_by, document_type, booking_id
      ) VALUES (
        ${invoiceNumber}, ${quotationNumber}, ${proformaNumber}, ${receiptNumber},
        ${body.customer_id}, ${body.invoice_date}, ${body.due_date},
        ${body.payment_terms || 30}, ${body.po_number || null}, ${body.notes || null},
        ${body.currency || 'USD'}, ${subtotal}, ${taxAmount}, ${discountAmount},
        ${total}, 0, ${body.status || 'draft'}, ${arAccountId}, ${user.id},
        ${documentType}, ${body.booking_id || null}
      )
      RETURNING *
    `;
    const invoice = invoiceRows[0];

    // Create invoice lines
    if (lines.length > 0) {
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const lineSubtotal = line.quantity * line.unit_price;
        const lineDiscount = lineSubtotal * ((line.discount_percent || 0) / 100);
        const lineNet = lineSubtotal - lineDiscount;
        const lineTax = lineNet * (line.tax_rate || 0);
        const lineTotal = lineNet + lineTax;

        try {
          await sql`
            INSERT INTO invoice_lines (
              invoice_id, line_number, product_id, description, quantity,
              unit_price, discount_percent, discount_amount, tax_rate, tax_amount, line_total
            ) VALUES (
              ${invoice.id}, ${index + 1}, ${line.product_id || null}, ${line.description},
              ${line.quantity}, ${line.unit_price}, ${line.discount_percent || 0},
              ${lineDiscount}, ${line.tax_rate || 0}, ${lineTax}, ${lineTotal}
            )
          `;
        } catch (linesError: any) {
          // Rollback invoice if lines fail
          await sql`DELETE FROM invoices WHERE id = ${invoice.id}`;
          return NextResponse.json({ error: linesError.message }, { status: 400 });
        }
      }
    }

    // Handle inventory based on document type and status
    if (documentType === 'quotation' || documentType === 'proforma') {
      const reserveResult = await reserveInventoryForQuotation(sql, invoice.id, lines, user.id);
      if (!reserveResult.success) {
        await sql`DELETE FROM invoices WHERE id = ${invoice.id}`;
        return NextResponse.json(
          { error: reserveResult.error || 'Failed to reserve inventory' },
          { status: 400 }
        );
      }
    } else if (documentType === 'invoice' && (invoice.status === 'posted' || invoice.status === 'sent')) {
      const inventoryResult = await reduceInventoryForInvoice(sql, invoice.id, lines, user.id);
      if (!inventoryResult.success) {
        await sql`DELETE FROM invoices WHERE id = ${invoice.id}`;
        return NextResponse.json(
          { error: inventoryResult.error || 'Insufficient inventory' },
          { status: 400 }
        );
      }
    }

    // Create journal entry if invoice is posted
    if (invoice.status === 'posted' && documentType === 'invoice') {
      const journalResult = await createInvoiceJournalEntry(
        sql,
        {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          total: invoice.total,
          customer_id: invoice.customer_id,
        },
        user.id
      );

      if (!journalResult.success) {
        console.error('Failed to create journal entry for invoice:', journalResult.error);
      }
    }

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

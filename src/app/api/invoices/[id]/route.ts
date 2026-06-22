import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import {
  reduceInventoryForInvoice,
  reserveInventoryForQuotation,
  releaseReservedInventory,
  restoreInventoryForInvoice,
} from '@/lib/accounting/inventory-server';
import { createInvoiceJournalEntry } from '@/lib/accounting/journal-entry-helpers';

// GET /api/invoices/[id] - Get single invoice with lines
export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  const resolvedParams = await params;
  try {
    const invoiceRows = await sql`
      SELECT i.*,
        json_build_object(
          'id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone,
          'address_line1', c.address_line1, 'address_line2', c.address_line2,
          'city', c.city, 'state', c.state, 'zip_code', c.zip_code
        ) AS customers,
        COALESCE(
          json_agg(
            json_build_object(
              'id', il.id, 'invoice_id', il.invoice_id, 'line_number', il.line_number,
              'product_id', il.product_id, 'description', il.description,
              'quantity', il.quantity, 'unit_price', il.unit_price,
              'discount_percent', il.discount_percent, 'discount_amount', il.discount_amount,
              'tax_rate', il.tax_rate, 'tax_amount', il.tax_amount, 'line_total', il.line_total,
              'products', json_build_object('id', p.id, 'name', p.name, 'sku', p.sku)
            )
          ) FILTER (WHERE il.id IS NOT NULL),
          '[]'
        ) AS invoice_lines
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN invoice_lines il ON il.invoice_id = i.id
      LEFT JOIN products p ON p.id = il.product_id
      WHERE i.id = ${resolvedParams.id}
      GROUP BY i.id, c.id, c.name, c.email, c.phone, c.address_line1, c.address_line2, c.city, c.state, c.zip_code
    `;

    if (invoiceRows.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = invoiceRows[0];

    // Get payments
    const payments = await sql`
      SELECT pa.amount_applied,
        json_build_object(
          'id', pr.id, 'payment_date', pr.payment_date, 'amount', pr.amount,
          'payment_method', pr.payment_method, 'reference_number', pr.reference_number,
          'notes', pr.notes
        ) AS payments_received
      FROM payment_applications pa
      JOIN payments_received pr ON pr.id = pa.payment_id
      WHERE pa.invoice_id = ${resolvedParams.id}
      ORDER BY pr.payment_date DESC
    `;

    return NextResponse.json({
      data: {
        ...invoice,
        payments: payments || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/invoices/[id] - Update invoice
export async function PATCH(request: NextRequest, context: any) {
  const { params } = context || {};
  const resolvedParams = await params;
  try {
    const body = await request.json();

    // Get existing invoice with lines
    const existingRows = await sql`
      SELECT i.*, COALESCE(json_agg(il.*) FILTER (WHERE il.id IS NOT NULL), '[]') AS invoice_lines
      FROM invoices i
      LEFT JOIN invoice_lines il ON il.invoice_id = i.id
      WHERE i.id = ${resolvedParams.id}
      GROUP BY i.id
    `;

    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    const existing = existingRows[0];

    // Prevent editing paid/void invoices
    if (['paid', 'void'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Cannot edit paid or voided invoices' },
        { status: 400 }
      );
    }

    // Get current user for journal entries
    const user = await getSession();

    const oldStatus = existing.status;
    const newStatus = body.status || existing.status;
    const documentType = existing.document_type || 'invoice';

    // Update invoice
    const allowedFields = [
      'customer_id', 'invoice_date', 'due_date', 'payment_terms',
      'po_number', 'notes', 'status',
    ];
    const updateData: any = {};
    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    const invoiceRows = await sql`
      UPDATE invoices SET
        customer_id = COALESCE(${updateData.customer_id ?? null}::uuid, customer_id),
        invoice_date = COALESCE(${updateData.invoice_date ?? null}::date, invoice_date),
        due_date = COALESCE(${updateData.due_date ?? null}::date, due_date),
        payment_terms = COALESCE(${updateData.payment_terms ?? null}, payment_terms),
        po_number = CASE WHEN ${updateData.po_number !== undefined}::boolean THEN ${updateData.po_number ?? null}::text ELSE po_number END,
        notes = CASE WHEN ${updateData.notes !== undefined}::boolean THEN ${updateData.notes ?? null}::text ELSE notes END,
        status = COALESCE(${updateData.status ?? null}::text, status)
      WHERE id = ${resolvedParams.id}
      RETURNING *
    `;
    const invoice = invoiceRows[0];

    // Handle inventory for status changes
    if (user) {
      if ((documentType === 'quotation' || documentType === 'proforma') && newStatus === 'posted' && oldStatus === 'draft') {
        await releaseReservedInventory(sql, resolvedParams.id, existing.invoice_lines);
        const inventoryResult = await reduceInventoryForInvoice(sql, resolvedParams.id, existing.invoice_lines, user.id);
        if (!inventoryResult.success) {
          return NextResponse.json(
            { error: inventoryResult.error || 'Insufficient inventory' },
            { status: 400 }
          );
        }
      } else if (documentType === 'invoice' && (newStatus === 'sent' || newStatus === 'posted') && oldStatus === 'draft') {
        const inventoryResult = await reduceInventoryForInvoice(sql, resolvedParams.id, existing.invoice_lines, user.id);
        if (!inventoryResult.success) {
          return NextResponse.json(
            { error: inventoryResult.error || 'Insufficient inventory' },
            { status: 400 }
          );
        }
      }
    }

    // Create journal entry when invoice is marked as 'paid' or 'partial'
    if ((newStatus === 'paid' || newStatus === 'partial') && (oldStatus !== 'paid' && oldStatus !== 'partial') && !invoice.journal_entry_id && documentType === 'invoice') {
      const journalResult = await createInvoiceJournalEntry(
        sql,
        {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          total: invoice.total,
          customer_id: invoice.customer_id,
        },
        user?.id || ''
      );

      if (!journalResult.success) {
        console.error('Failed to create journal entry:', journalResult.error);
        return NextResponse.json(
          { error: `Failed to create journal entry: ${journalResult.error}` },
          { status: 500 }
        );
      }

      if (journalResult.success && journalResult.journalEntry) {
        await sql`
          UPDATE invoices SET journal_entry_id = ${journalResult.journalEntry.id} WHERE id = ${resolvedParams.id}
        `;
      }
    }

    // Sync payment status to related booking if invoice is marked as paid
    if ((newStatus === 'paid' || newStatus === 'partial') && (oldStatus !== 'paid' && oldStatus !== 'partial')) {
      if (invoice.booking_id) {
        const newAmountPaid = newStatus === 'paid' ? invoice.total : invoice.amount_paid;

        await sql`UPDATE invoices SET amount_paid = ${newAmountPaid} WHERE id = ${resolvedParams.id}`;

        const allBookingInvoices = await sql`
          SELECT id, total, amount_paid, currency FROM invoices WHERE booking_id = ${invoice.booking_id}
        `;
        const bookingRows = await sql`
          SELECT total, status, currency FROM bookings WHERE id = ${invoice.booking_id}
        `;
        const booking = bookingRows[0];

        if (allBookingInvoices.length > 0 && booking) {
          let totalPaidAcrossInvoices = 0;

          for (const inv of allBookingInvoices) {
            let invAmountPaid: number;
            if (inv.id === invoice.id) {
              invAmountPaid = newAmountPaid;
            } else {
              invAmountPaid = parseFloat(inv.amount_paid) || 0;
            }

            if (inv.currency === booking.currency) {
              totalPaidAcrossInvoices += invAmountPaid;
            } else {
              try {
                const convertedRows = await sql`
                  SELECT convert_currency(${invAmountPaid}, ${inv.currency}, ${booking.currency}, ${new Date().toISOString().split('T')[0]}) AS result
                `;
                const convertedAmount = convertedRows[0]?.result;
                if (convertedAmount !== null && convertedAmount !== undefined) {
                  totalPaidAcrossInvoices += convertedAmount;
                } else {
                  totalPaidAcrossInvoices += invAmountPaid;
                }
              } catch {
                totalPaidAcrossInvoices += invAmountPaid;
              }
            }
          }

          let newBookingStatus = booking.status;
          const bookingTotal = parseFloat(booking.total);
          if (totalPaidAcrossInvoices >= bookingTotal) {
            newBookingStatus = 'fully_paid';
          } else if (totalPaidAcrossInvoices > 0) {
            if (!['fully_paid', 'completed'].includes(booking.status)) {
              newBookingStatus = 'deposit_paid';
            }
          }

          await sql`
            UPDATE bookings SET amount_paid = ${totalPaidAcrossInvoices}, status = ${newBookingStatus}
            WHERE id = ${invoice.booking_id}
          `;
        }
      }
    }

    // If lines are provided, update them
    if (body.lines) {
      await sql`DELETE FROM invoice_lines WHERE invoice_id = ${resolvedParams.id}`;

      let subtotal = 0;
      let taxAmount = 0;
      let discountAmount = 0;

      for (let index = 0; index < body.lines.length; index++) {
        const line = body.lines[index];
        const lineSubtotal = line.quantity * line.unit_price;
        const lineDiscount = lineSubtotal * ((line.discount_percent || 0) / 100);
        const lineNet = lineSubtotal - lineDiscount;
        const lineTax = lineNet * (line.tax_rate || 0);

        subtotal += lineNet;
        taxAmount += lineTax;
        discountAmount += lineDiscount;

        await sql`
          INSERT INTO invoice_lines (
            invoice_id, line_number, product_id, description, quantity,
            unit_price, discount_percent, discount_amount, tax_rate, tax_amount, line_total
          ) VALUES (
            ${resolvedParams.id}, ${index + 1}, ${line.product_id || null}, ${line.description},
            ${line.quantity}, ${line.unit_price}, ${line.discount_percent || 0},
            ${lineDiscount}, ${line.tax_rate || 0}, ${lineTax}, ${lineNet}
          )
        `;
      }

      const total = subtotal + taxAmount;
      await sql`
        UPDATE invoices
        SET subtotal = ${subtotal}, tax_amount = ${taxAmount}, discount_amount = ${discountAmount}, total = ${total}
        WHERE id = ${resolvedParams.id}
      `;
    }

    return NextResponse.json({ data: invoice });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/invoices/[id] - Delete or void invoice
export async function DELETE(request: NextRequest, context: any) {
  const { params } = context || {};
  const resolvedParams = await params;
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'void';

    // Get existing invoice with lines
    const existingRows = await sql`
      SELECT i.*, COALESCE(json_agg(il.*) FILTER (WHERE il.id IS NOT NULL), '[]') AS invoice_lines
      FROM invoices i
      LEFT JOIN invoice_lines il ON il.invoice_id = i.id
      WHERE i.id = ${resolvedParams.id}
      GROUP BY i.id
    `;

    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    const existing = existingRows[0];

    if (existing.status === 'void') {
      return NextResponse.json({ error: 'Invoice is already voided' }, { status: 400 });
    }

    const user = await getSession();

    if (action === 'delete') {
      if (existing.status !== 'draft' || existing.amount_paid > 0) {
        return NextResponse.json(
          { error: 'Can only delete draft invoices with no payments' },
          { status: 400 }
        );
      }

      if ((existing.document_type === 'quotation' || existing.document_type === 'proforma') && user) {
        await releaseReservedInventory(sql, resolvedParams.id, existing.invoice_lines);
      }

      await sql`DELETE FROM invoice_lines WHERE invoice_id = ${resolvedParams.id}`;
      await sql`DELETE FROM invoices WHERE id = ${resolvedParams.id}`;

      return NextResponse.json({ message: 'Invoice deleted' });
    } else {
      if ((existing.status === 'posted' || existing.status === 'sent') &&
          existing.document_type === 'invoice' && user) {
        await restoreInventoryForInvoice(sql, resolvedParams.id, existing.invoice_lines, user.id);
      }

      const rows = await sql`
        UPDATE invoices SET status = 'void' WHERE id = ${resolvedParams.id} RETURNING *
      `;

      return NextResponse.json({ data: rows[0], message: 'Invoice voided' });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

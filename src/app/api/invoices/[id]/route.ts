import { createClient } from '@/lib/supabase/server';
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
    const supabase = await createClient();

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        customers (id, name, email, phone, address_line1, address_line2, city, state, zip_code),
        invoice_lines (*, products (id, name, sku))
      `)
      .eq('id', resolvedParams.id)
      .single();

    if (invoiceError) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get payments
    const { data: payments } = await supabase
      .from('payment_applications')
      .select(`
        amount_applied,
        payments_received (
          id,
          payment_date,
          amount,
          payment_method,
          reference_number,
          notes
        )
      `)
      .eq('invoice_id', resolvedParams.id)
      .order('payments_received.payment_date', { ascending: false });

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
    const supabase = await createClient();
    const body = await request.json();

    // Get existing invoice with lines
    const { data: existing, error: fetchError } = await supabase
      .from('invoices')
      .select('*, invoice_lines(*)')
      .eq('id', resolvedParams.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Prevent editing paid/void invoices
    if (['paid', 'void'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Cannot edit paid or voided invoices' },
        { status: 400 }
      );
    }

    // Get current user for journal entries
    const { data: { user } } = await supabase.auth.getUser();

    // Handle status change inventory implications
    const oldStatus = existing.status;
    const newStatus = body.status || existing.status;
    const documentType = existing.document_type || 'invoice';

    // Update invoice
    const updateData: any = {};
    const allowedFields = [
      'customer_id', 'invoice_date', 'due_date', 'payment_terms',
      'po_number', 'notes', 'status'
    ];

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    const { data: invoice, error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', resolvedParams.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Handle inventory for status changes
    if (user) {
      // Quotation/Proforma -> Invoice conversion
      if ((documentType === 'quotation' || documentType === 'proforma') && newStatus === 'posted' && oldStatus === 'draft') {
        // Release reservation
        await releaseReservedInventory(supabase, resolvedParams.id, existing.invoice_lines);
        
        // Reduce actual inventory
        const inventoryResult = await reduceInventoryForInvoice(
          supabase,
          resolvedParams.id,
          existing.invoice_lines,
          user.id
        );

        if (!inventoryResult.success) {
          return NextResponse.json(
            { error: inventoryResult.error || 'Insufficient inventory' },
            { status: 400 }
          );
        }
      }
      // Regular invoice: Draft -> Sent/Posted
      else if (documentType === 'invoice' && (newStatus === 'sent' || newStatus === 'posted') && oldStatus === 'draft') {
        const inventoryResult = await reduceInventoryForInvoice(
          supabase,
          resolvedParams.id,
          existing.invoice_lines,
          user.id
        );

        if (!inventoryResult.success) {
          return NextResponse.json(
            { error: inventoryResult.error || 'Insufficient inventory' },
            { status: 400 }
          );
        }
      }
    }

    // Create journal entry when invoice is marked as 'paid' or 'partial' (accrual accounting)
    if ((newStatus === 'paid' || newStatus === 'partial') && (oldStatus !== 'paid' && oldStatus !== 'partial') && !invoice.journal_entry_id && documentType === 'invoice') {
      console.log('Creating journal entry for invoice:', {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        total: invoice.total,
        status: newStatus,
      });

      const journalResult = await createInvoiceJournalEntry(
        supabase,
        {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          total: invoice.total,
          customer_id: invoice.customer_id,
        },
        user?.id || ''
      );

      console.log('Journal entry result:', journalResult);

      if (!journalResult.success) {
        console.error('Failed to create journal entry:', journalResult.error);
        return NextResponse.json(
          { error: `Failed to create journal entry: ${journalResult.error}` },
          { status: 500 }
        );
      }

      if (journalResult.success && journalResult.journalEntry) {
        await supabase
          .from('invoices')
          .update({ journal_entry_id: journalResult.journalEntry.id })
          .eq('id', resolvedParams.id);
      }
    }

    // Sync payment status to related booking if invoice is marked as paid
    if ((newStatus === 'paid' || newStatus === 'partial') && (oldStatus !== 'paid' && oldStatus !== 'partial')) {
      if (invoice.booking_id) {
        // When marking as paid, update amount_paid to total
        const newAmountPaid = newStatus === 'paid' ? invoice.total : invoice.amount_paid;
        
        await supabase
          .from('invoices')
          .update({ amount_paid: newAmountPaid })
          .eq('id', resolvedParams.id);

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
            let invAmountPaid;
            
            // For the current invoice, use the new amount
            if (inv.id === invoice.id) {
              invAmountPaid = newAmountPaid;
            } else {
              invAmountPaid = parseFloat(inv.amount_paid) || 0;
            }
            
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
                // Fallback: add the amount as-is
                totalPaidAcrossInvoices += invAmountPaid;
              }
            }
          }

          if (booking) {
            let newBookingStatus = booking.status;
            const bookingTotal = parseFloat(booking.total);
            
            if (totalPaidAcrossInvoices >= bookingTotal) {
              newBookingStatus = 'fully_paid';
            } else if (totalPaidAcrossInvoices > 0) {
              if (!['fully_paid', 'completed'].includes(booking.status)) {
                newBookingStatus = 'deposit_paid';
              }
            }

            // Update booking
            await supabase
              .from('bookings')
              .update({
                amount_paid: totalPaidAcrossInvoices,
                status: newBookingStatus,
              })
              .eq('id', invoice.booking_id);
          }
        }
      }
    }

    // If lines are provided, update them
    if (body.lines) {
      // Delete existing lines
      await supabase.from('invoice_lines').delete().eq('invoice_id', resolvedParams.id);

      // Calculate new totals
      let subtotal = 0;
      let taxAmount = 0;
      let discountAmount = 0;

      const invoiceLines = body.lines.map((line: any, index: number) => {
        const lineSubtotal = line.quantity * line.unit_price;
        const lineDiscount = lineSubtotal * ((line.discount_percent || 0) / 100);
        const lineNet = lineSubtotal - lineDiscount;
        const lineTax = lineNet * (line.tax_rate || 0);

        subtotal += lineNet;
        taxAmount += lineTax;
        discountAmount += lineDiscount;

        return {
          invoice_id: resolvedParams.id,
          line_number: index + 1,
          product_id: line.product_id || null,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_percent: line.discount_percent || 0,
          discount_amount: lineDiscount,
          tax_rate: line.tax_rate || 0,
          tax_amount: lineTax,
          line_total: lineNet,
        };
      });

      // Insert new lines
      await supabase.from('invoice_lines').insert(invoiceLines);

      // Update invoice totals
      const total = subtotal + taxAmount;
      await supabase
        .from('invoices')
        .update({
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          total,
        })
        .eq('id', resolvedParams.id);
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
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'void';

    // Get existing invoice with lines
    const { data: existing, error: fetchError } = await supabase
      .from('invoices')
      .select('*, invoice_lines(*)')
      .eq('id', resolvedParams.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (existing.status === 'void') {
      return NextResponse.json({ error: 'Invoice is already voided' }, { status: 400 });
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (action === 'delete') {
      // Only allow delete for drafts with no payments
      if (existing.status !== 'draft' || existing.amount_paid > 0) {
        return NextResponse.json(
          { error: 'Can only delete draft invoices with no payments' },
          { status: 400 }
        );
      }

      // Release inventory reservation if quotation/proforma
      if ((existing.document_type === 'quotation' || existing.document_type === 'proforma') && user) {
        await releaseReservedInventory(supabase, resolvedParams.id, existing.invoice_lines);
      }

      // Delete lines first
      await supabase.from('invoice_lines').delete().eq('invoice_id', resolvedParams.id);
      
      // Delete invoice
      const { error } = await supabase.from('invoices').delete().eq('id', resolvedParams.id);
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ message: 'Invoice deleted' });
    } else {
      // Restore inventory if invoice was posted/sent
      if ((existing.status === 'posted' || existing.status === 'sent') && 
          existing.document_type === 'invoice' && user) {
        await restoreInventoryForInvoice(supabase, resolvedParams.id, existing.invoice_lines, user.id);
      }

      // Void the invoice
      const { data, error } = await supabase
        .from('invoices')
        .update({ status: 'void' })
        .eq('id', resolvedParams.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ data, message: 'Invoice voided' });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

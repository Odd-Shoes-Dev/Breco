import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { releaseReservedInventory, reduceInventoryForInvoice } from '@/lib/accounting/inventory-server';

// POST /api/quotations/[id]/convert - Convert quotation to invoice
export async function POST(request: NextRequest, context: any) {
  const params = await context.params;
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the quotation
    const { data: quotation, error: fetchError } = await supabase
      .from('invoices')
      .select('*, invoice_lines(*)')
      .eq('id', params.id)
      .eq('document_type', 'quotation')
      .single();

    if (fetchError || !quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    // Check if already converted
    if (quotation.status === 'converted' || quotation.status === 'posted') {
      return NextResponse.json({ error: 'Quotation already converted' }, { status: 400 });
    }

    // Generate new invoice number
    const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number');

    // Update the quotation to invoice
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update({
        document_type: 'invoice',
        invoice_number: invoiceNumber,
        status: 'draft',
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Release reserved inventory (quotations have reserved stock)
    await releaseReservedInventory(supabase, params.id, quotation.invoice_lines);

    // Mark original quotation status
    await supabase
      .from('invoices')
      .update({ status: 'converted' })
      .eq('id', params.id);

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

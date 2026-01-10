import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/proformas/[id]/convert - Convert proforma to invoice
export async function POST(request: NextRequest, context: any) {
  const params = await context.params;
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the proforma
    const { data: proforma, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', params.id)
      .eq('document_type', 'proforma')
      .single();

    if (fetchError || !proforma) {
      return NextResponse.json({ error: 'Proforma invoice not found' }, { status: 404 });
    }

    // Check if already converted
    if (proforma.status === 'converted' || proforma.status === 'posted') {
      return NextResponse.json({ error: 'Proforma already converted' }, { status: 400 });
    }

    // Generate new invoice number
    const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number');

    // Update the proforma to invoice
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

    // Mark original proforma as converted
    await supabase
      .from('invoices')
      .update({ status: 'converted' })
      .eq('id', params.id);

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

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bank-transfers/[id] - Get bank transfer details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('bank_transfers')
      .select(`
        *,
        from_account:bank_accounts!bank_transfers_from_account_id_fkey(id, account_name, account_number),
        to_account:bank_accounts!bank_transfers_to_account_id_fkey(id, account_name, account_number),
        approved_by_user:user_profiles!bank_transfers_approved_by_fkey(id, full_name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Bank transfer not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bank-transfers/[id] - Cancel bank transfer
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    // Check current status
    const { data: existing } = await supabase
      .from('bank_transfers')
      .select('status')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Bank transfer not found' }, { status: 404 });
    }

    if (existing.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot cancel completed bank transfer' },
        { status: 400 }
      );
    }

    // Soft delete - change status to cancelled
    const { error } = await supabase
      .from('bank_transfers')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Bank transfer cancelled successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

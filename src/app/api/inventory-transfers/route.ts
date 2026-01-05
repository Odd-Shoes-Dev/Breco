import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { from_location_id, to_location_id, transfer_date, notes, lines } = await request.json();

    if (!from_location_id || !to_location_id || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate transfer number
    const { data: lastTransfer } = await supabase
      .from('inventory_transfers')
      .select('transfer_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
    if (lastTransfer?.transfer_number) {
      const match = lastTransfer.transfer_number.match(/TR-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const transfer_number = `TR-${nextNumber.toString().padStart(4, '0')}`;

    // Create transfer
    const { data: transfer, error: transferError } = await supabase
      .from('inventory_transfers')
      .insert({
        transfer_number,
        from_location_id,
        to_location_id,
        transfer_date,
        status: 'pending',
        notes,
      })
      .select()
      .single();

    if (transferError) throw transferError;

    // Create transfer lines
    const transferLines = lines.map((line: any) => ({
      transfer_id: transfer.id,
      product_id: line.product_id,
      quantity: line.quantity,
    }));

    const { error: linesError } = await supabase
      .from('inventory_transfer_lines')
      .insert(transferLines);

    if (linesError) throw linesError;

    return NextResponse.json(transfer);
  } catch (error: any) {
    console.error('Error creating transfer:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

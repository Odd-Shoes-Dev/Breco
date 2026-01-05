import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const { id } = await params;
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    // Get inventory count at this location
    const { data: inventoryData } = await supabase
      .from('inventory_by_location')
      .select('quantity')
      .eq('location_id', id);

    const totalQuantity = inventoryData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

    return NextResponse.json({ ...data, total_inventory: totalQuantity });
  } catch (error: any) {
    console.error('Error fetching location:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { id } = await params;

    const { data, error } = await supabase
      .from('locations')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating location:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const { id } = await params;
    // Check if location has inventory
    const { data: inventoryData } = await supabase
      .from('inventory_by_location')
      .select('id')
      .eq('location_id', id)
      .limit(1);

    if (inventoryData && inventoryData.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete location with existing inventory' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting location:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

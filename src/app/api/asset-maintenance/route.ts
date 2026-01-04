import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assetId = searchParams.get('asset_id');
    const maintenanceType = searchParams.get('maintenance_type');

    let query = supabase
      .from('asset_maintenance')
      .select(
        `
        *,
        assets (id, name, asset_tag, asset_categories (name)),
        employees:performed_by_employee_id (first_name, last_name, employee_number)
      `
      )
      .order('scheduled_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (assetId) {
      query = query.eq('asset_id', assetId);
    }

    if (maintenanceType) {
      query = query.eq('maintenance_type', maintenanceType);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching maintenance records:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      asset_id,
      maintenance_type,
      scheduled_date,
      performed_date,
      performed_by_employee_id,
      performed_by_vendor,
      description,
      cost,
      status,
      notes,
      next_maintenance_date,
    } = body;

    // Validate required fields
    if (!asset_id || !maintenance_type || !scheduled_date || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('asset_maintenance')
      .insert({
        asset_id,
        maintenance_type,
        scheduled_date,
        performed_date: performed_date || null,
        performed_by_employee_id: performed_by_employee_id || null,
        performed_by_vendor: performed_by_vendor || null,
        description,
        cost: cost || null,
        status: status || 'scheduled',
        notes: notes || null,
        next_maintenance_date: next_maintenance_date || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating maintenance record:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

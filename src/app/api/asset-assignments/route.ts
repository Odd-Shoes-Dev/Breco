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
    const employeeId = searchParams.get('employee_id');

    let query = supabase
      .from('asset_assignments')
      .select(
        `
        *,
        assets (id, name, asset_tag, asset_categories (name)),
        employees (id, first_name, last_name, employee_number, department)
      `
      )
      .order('assignment_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (assetId) {
      query = query.eq('asset_id', assetId);
    }

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching asset assignments:', error);
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
      employee_id,
      assignment_date,
      expected_return_date,
      condition_at_assignment,
      notes,
    } = body;

    // Validate required fields
    if (!asset_id || !employee_id || !assignment_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if asset is already assigned
    const { data: existingAssignment, error: checkError } = await supabase
      .from('asset_assignments')
      .select('id')
      .eq('asset_id', asset_id)
      .eq('status', 'assigned')
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'Asset is already assigned to another employee' },
        { status: 400 }
      );
    }

    // Create assignment
    const { data, error } = await supabase
      .from('asset_assignments')
      .insert({
        asset_id,
        employee_id,
        assignment_date,
        expected_return_date: expected_return_date || null,
        condition_at_assignment: condition_at_assignment || 'good',
        status: 'assigned',
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Update asset status to assigned
    const { error: assetError } = await supabase
      .from('assets')
      .update({ status: 'assigned' })
      .eq('id', asset_id);

    if (assetError) throw assetError;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating asset assignment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

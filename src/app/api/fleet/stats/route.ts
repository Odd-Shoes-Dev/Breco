import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/fleet/stats - Get fleet statistics
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get all vehicles for statistics
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('status, vehicle_type, purchase_price');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Get maintenance records
    const { data: maintenance } = await supabase
      .from('vehicle_maintenance')
      .select('cost');

    const stats = {
      totalVehicles: vehicles.length,
      available: vehicles.filter(v => v.status === 'available').length,
      inUse: vehicles.filter(v => v.status === 'in_use').length,
      maintenance: vehicles.filter(v => v.status === 'maintenance').length,
      outOfService: vehicles.filter(v => v.status === 'out_of_service').length,
      totalValue: vehicles.reduce((sum, v) => sum + (v.purchase_price || 0), 0),
      totalMaintenanceCost: maintenance?.reduce((sum, m) => sum + (m.cost || 0), 0) || 0,
      byType: {
        safari_4x4: vehicles.filter(v => v.vehicle_type === 'safari_4x4').length,
        minibus: vehicles.filter(v => v.vehicle_type === 'minibus').length,
        land_cruiser: vehicles.filter(v => v.vehicle_type === 'land_cruiser').length,
        coaster: vehicles.filter(v => v.vehicle_type === 'coaster').length,
        sedan: vehicles.filter(v => v.vehicle_type === 'sedan').length,
        other: vehicles.filter(v => v.vehicle_type === 'other').length,
      },
    };

    return NextResponse.json(stats, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

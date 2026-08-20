import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/fleet/stats - Get fleet statistics
export async function GET(request: NextRequest) {
  try {
    const vehicles = await sql`SELECT status, vehicle_type, purchase_price FROM vehicles`;
    const maintenance = await sql`SELECT cost FROM vehicle_maintenance`;

    const stats = {
      totalVehicles: vehicles.length,
      available: vehicles.filter((v: any) => v.status === 'available').length,
      inUse: vehicles.filter((v: any) => v.status === 'in_use').length,
      maintenance: vehicles.filter((v: any) => v.status === 'maintenance').length,
      outOfService: vehicles.filter((v: any) => v.status === 'out_of_service').length,
      totalValue: vehicles.reduce((sum: number, v: any) => sum + (v.purchase_price || 0), 0),
      totalMaintenanceCost: maintenance.reduce((sum: number, m: any) => sum + (m.cost || 0), 0),
      byType: {
        safari_4x4: vehicles.filter((v: any) => v.vehicle_type === 'safari_4x4').length,
        minibus: vehicles.filter((v: any) => v.vehicle_type === 'minibus').length,
        land_cruiser: vehicles.filter((v: any) => v.vehicle_type === 'land_cruiser').length,
        coaster: vehicles.filter((v: any) => v.vehicle_type === 'coaster').length,
        sedan: vehicles.filter((v: any) => v.vehicle_type === 'sedan').length,
        other: vehicles.filter((v: any) => v.vehicle_type === 'other').length,
      },
    };

    return NextResponse.json(stats, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/fleet - List all vehicles with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const searchQuery = searchParams.get('search');
    const status = searchParams.get('status');
    const vehicleType = searchParams.get('vehicle_type');

    let data;

    if (searchQuery && status && status !== 'all' && vehicleType && vehicleType !== 'all') {
      const q = `%${searchQuery}%`;
      data = await sql`
        SELECT * FROM vehicles
        WHERE (registration_number ILIKE ${q} OR make ILIKE ${q} OR model ILIKE ${q})
          AND status = ${status}
          AND vehicle_type = ${vehicleType}
        ORDER BY registration_number ASC
      `;
    } else if (searchQuery && status && status !== 'all') {
      const q = `%${searchQuery}%`;
      data = await sql`
        SELECT * FROM vehicles
        WHERE (registration_number ILIKE ${q} OR make ILIKE ${q} OR model ILIKE ${q})
          AND status = ${status}
        ORDER BY registration_number ASC
      `;
    } else if (searchQuery && vehicleType && vehicleType !== 'all') {
      const q = `%${searchQuery}%`;
      data = await sql`
        SELECT * FROM vehicles
        WHERE (registration_number ILIKE ${q} OR make ILIKE ${q} OR model ILIKE ${q})
          AND vehicle_type = ${vehicleType}
        ORDER BY registration_number ASC
      `;
    } else if (status && status !== 'all' && vehicleType && vehicleType !== 'all') {
      data = await sql`
        SELECT * FROM vehicles
        WHERE status = ${status} AND vehicle_type = ${vehicleType}
        ORDER BY registration_number ASC
      `;
    } else if (searchQuery) {
      const q = `%${searchQuery}%`;
      data = await sql`
        SELECT * FROM vehicles
        WHERE registration_number ILIKE ${q} OR make ILIKE ${q} OR model ILIKE ${q}
        ORDER BY registration_number ASC
      `;
    } else if (status && status !== 'all') {
      data = await sql`
        SELECT * FROM vehicles WHERE status = ${status} ORDER BY registration_number ASC
      `;
    } else if (vehicleType && vehicleType !== 'all') {
      data = await sql`
        SELECT * FROM vehicles WHERE vehicle_type = ${vehicleType} ORDER BY registration_number ASC
      `;
    } else {
      data = await sql`SELECT * FROM vehicles ORDER BY registration_number ASC`;
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/fleet - Create a new vehicle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.vehicle_number || !body.registration_number || !body.make || !body.model) {
      return NextResponse.json(
        { error: 'Missing required fields: vehicle_number, registration_number, make, model' },
        { status: 400 }
      );
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for duplicate registration number
    const existing = await sql`
      SELECT id FROM vehicles WHERE registration_number = ${body.registration_number}
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Vehicle with this registration number already exists' },
        { status: 409 }
      );
    }

    // Create the vehicle
    const rows = await sql`
      INSERT INTO vehicles (
        vehicle_number, registration_number, make, model, vehicle_type, year, color, status,
        fuel_type, transmission, seating_capacity, luggage_capacity, features,
        purchase_date, purchase_price, current_value, insurance_expiry,
        daily_rate_usd, daily_rate_ugx, weekly_rate_usd, mileage_rate,
        current_mileage, last_service_date, next_service_mileage,
        location, notes, is_active
      ) VALUES (
        ${body.vehicle_number}, ${body.registration_number}, ${body.make}, ${body.model},
        ${body.vehicle_type || null}, ${body.year || null}, ${body.color || null}, ${body.status || 'available'},
        ${body.fuel_type || null}, ${body.transmission || null},
        ${body.seating_capacity ?? 4}, ${body.luggage_capacity || null}, ${body.features ?? null},
        ${body.purchase_date || null}, ${body.purchase_price || null}, ${body.current_value || null},
        ${body.insurance_expiry || null},
        ${body.daily_rate_usd || null}, ${body.daily_rate_ugx || null}, ${body.weekly_rate_usd || null},
        ${body.mileage_rate || null},
        ${body.current_mileage ?? 0}, ${body.last_service_date || null}, ${body.next_service_mileage || null},
        ${body.location || null}, ${body.notes || null}, ${body.is_active ?? true}
      )
      RETURNING *
    `;
    const data = rows[0];

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json([], { status: 401 });

  const rows = await sql`
    SELECT b.id, b.bill_number, b.due_date, v.name AS vendor_name
    FROM bills b
    JOIN vendors v ON v.id = b.vendor_id
    WHERE b.status = 'overdue'
    ORDER BY b.due_date ASC
    LIMIT 5
  `;

  return NextResponse.json(rows);
}

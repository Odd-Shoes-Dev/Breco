import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json([], { status: 401 });

  const rows = await sql`
    SELECT i.id, i.invoice_number, i.due_date, c.name AS customer_name
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    WHERE i.status = 'overdue'
    ORDER BY i.due_date ASC
    LIMIT 5
  `;

  return NextResponse.json(rows);
}

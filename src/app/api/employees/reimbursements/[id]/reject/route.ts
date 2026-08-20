import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const rows = await sql`
      UPDATE employee_reimbursements
      SET status = 'rejected', approved_by = ${user.id}, approved_at = NOW()
      WHERE id = ${id} AND status = 'pending'
      RETURNING *
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Reimbursement not found or not in pending status' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error: any) {
    console.error('Failed to reject reimbursement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

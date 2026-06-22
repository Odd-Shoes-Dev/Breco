import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const assignmentId = id;
    const body = await request.json();
    const { return_date, condition_at_return, return_notes } = body;

    // Validate required fields
    if (!return_date) {
      return NextResponse.json(
        { error: 'Return date is required' },
        { status: 400 }
      );
    }

    // Get assignment details
    const assignments = await sql`
      SELECT asset_id, status FROM asset_assignments WHERE id = ${assignmentId}
    `;

    if (assignments.length === 0) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const assignment = assignments[0];

    if (assignment.status === 'returned') {
      return NextResponse.json(
        { error: 'Asset has already been returned' },
        { status: 400 }
      );
    }

    // Update assignment
    await sql`
      UPDATE asset_assignments
      SET
        return_date = ${return_date},
        condition_at_return = ${condition_at_return || null},
        return_notes = ${return_notes || null},
        status = 'returned'
      WHERE id = ${assignmentId}
    `;

    // Update asset status back to active
    await sql`UPDATE assets SET status = 'active' WHERE id = ${assignment.asset_id}`;

    return NextResponse.json({
      message: 'Asset returned successfully',
      assignmentId,
    });
  } catch (error: any) {
    console.error('Error returning asset:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

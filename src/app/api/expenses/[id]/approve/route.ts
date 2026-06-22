import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/expenses/[id]/approve - Approve expense
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expenseRows = await sql`SELECT *, created_by FROM expenses WHERE id = ${params.id}`;
    const expense = (expenseRows as any[])[0];

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    if (expense.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve expense with status: ${expense.status}` },
        { status: 400 }
      );
    }

    await sql`
      UPDATE expenses SET
        status = 'approved',
        approved_by = ${user.id},
        approved_at = ${new Date().toISOString()}
      WHERE id = ${params.id}
    `;

    const dataRows = await sql`
      SELECT
        e.*,
        json_build_object('id', up.id, 'full_name', up.full_name, 'email', up.email) AS approved_by_user
      FROM expenses e
      LEFT JOIN user_profiles up ON up.id = e.approved_by
      WHERE e.id = ${params.id}
    `;
    const updatedExpense = (dataRows as any[])[0];

    return NextResponse.json({
      data: updatedExpense,
      message: 'Expense approved successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

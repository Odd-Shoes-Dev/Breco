import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { createExpenseJournalEntry } from '@/lib/accounting/journal-entry-helpers';

// POST /api/expenses/[id]/pay - Mark expense as paid
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const body = await request.json();

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expenseRows = await sql`SELECT * FROM expenses WHERE id = ${params.id}`;
    const expense = (expenseRows as any[])[0];

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    if (expense.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only approved expenses can be marked as paid' },
        { status: 400 }
      );
    }

    // Validate bank account if provided
    if (body.bank_account_id) {
      const bankRows = await sql`SELECT id FROM bank_accounts WHERE id = ${body.bank_account_id} LIMIT 1`;
      if ((bankRows as any[]).length === 0) {
        return NextResponse.json({ error: 'Invalid bank account' }, { status: 400 });
      }
    }

    await sql`
      UPDATE expenses SET
        status = 'paid',
        paid_by = ${user.id},
        paid_at = ${new Date().toISOString()},
        bank_account_id = CASE WHEN ${body.bank_account_id !== undefined} THEN ${body.bank_account_id ?? null} ELSE bank_account_id END,
        payment_method = COALESCE(${body.payment_method ?? null}, payment_method),
        reference = COALESCE(${body.reference_number ?? null}, reference)
      WHERE id = ${params.id}
    `;

    const dataRows = await sql`
      SELECT
        e.*,
        json_build_object('id', up.id, 'full_name', up.full_name, 'email', up.email) AS paid_by_user,
        json_build_object('id', a.id, 'name', a.name, 'code', a.code) AS expense_account
      FROM expenses e
      LEFT JOIN user_profiles up ON up.id = e.paid_by
      LEFT JOIN accounts a ON a.id = e.expense_account_id
      WHERE e.id = ${params.id}
    `;
    const updatedExpense = (dataRows as any[])[0];

    // Create journal entry
    if (!expense.journal_entry_id && updatedExpense.expense_account) {
      const journalResult = await createExpenseJournalEntry(
        {
          id: updatedExpense.id,
          expense_number: updatedExpense.expense_number,
          expense_date: updatedExpense.expense_date,
          amount: updatedExpense.total,
          account_code: updatedExpense.expense_account.code,
          description: updatedExpense.description || 'Expense',
          bank_account_id: updatedExpense.bank_account_id,
        },
        user.id
      );

      if (journalResult.success && journalResult.journalEntry) {
        await sql`UPDATE expenses SET journal_entry_id = ${journalResult.journalEntry.id} WHERE id = ${params.id}`;
        updatedExpense.journal_entry_id = journalResult.journalEntry.id;
      } else {
        console.error('Failed to create journal entry for expense:', journalResult.error);
      }
    }

    return NextResponse.json({
      data: updatedExpense,
      message: 'Expense marked as paid successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

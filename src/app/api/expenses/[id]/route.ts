import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { createExpenseJournalEntry } from '@/lib/accounting/journal-entry-helpers';

// GET /api/expenses/[id] - Get expense details
export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const rows = await sql`
      SELECT
        e.*,
        json_build_object('id', v.id, 'name', v.name) AS vendor,
        json_build_object('id', ea.id, 'name', ea.name, 'code', ea.code) AS expense_account,
        json_build_object('id', pa.id, 'name', pa.name, 'code', pa.code) AS payment_account,
        json_build_object('id', ba.id, 'account_name', ba.account_name, 'account_number', ba.account_number) AS bank_account,
        json_build_object('id', c.id, 'name', c.name) AS customer,
        json_build_object('id', je.id, 'entry_number', je.entry_number, 'entry_date', je.entry_date) AS journal_entry,
        json_build_object('id', up.id, 'email', up.email, 'full_name', up.full_name) AS created_by_user
      FROM expenses e
      LEFT JOIN vendors v ON v.id = e.vendor_id
      LEFT JOIN accounts ea ON ea.id = e.expense_account_id
      LEFT JOIN accounts pa ON pa.id = e.payment_account_id
      LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id
      LEFT JOIN customers c ON c.id = e.customer_id
      LEFT JOIN journal_entries je ON je.id = e.journal_entry_id
      LEFT JOIN users up ON up.id = e.created_by
      WHERE e.id = ${params.id}
    `;
    const data = (rows as any[])[0];

    if (!data) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/expenses/[id] - Update expense
export async function PATCH(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const body = await request.json();

    const existingRows = await sql`SELECT status, journal_entry_id, expense_account_id, bank_account_id FROM expenses WHERE id = ${params.id}`;
    const existing = (existingRows as any[])[0];

    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    if (existing.status === 'paid' && body.status !== 'paid') {
      return NextResponse.json(
        { error: 'Cannot edit paid expenses. Void the expense first.' },
        { status: 400 }
      );
    }

    const user = await getSession();

    const total = (body.amount || 0) + (body.tax_amount || 0);

    await sql`
      UPDATE expenses SET
        expense_date = COALESCE(${body.expense_date ?? null}, expense_date),
        vendor_id = CASE WHEN ${body.vendor_id !== undefined} THEN ${body.vendor_id ?? null} ELSE vendor_id END,
        expense_account_id = COALESCE(${body.expense_account_id ?? null}, expense_account_id),
        payment_account_id = CASE WHEN ${body.payment_account_id !== undefined} THEN ${body.payment_account_id ?? null} ELSE payment_account_id END,
        amount = COALESCE(${body.amount ?? null}, amount),
        tax_amount = COALESCE(${body.tax_amount ?? null}, tax_amount),
        total = CASE WHEN ${(body.amount !== undefined || body.tax_amount !== undefined)} THEN ${total || null} ELSE total END,
        currency = COALESCE(${body.currency ?? null}, currency),
        description = CASE WHEN ${body.description !== undefined} THEN ${body.description ?? null} ELSE description END,
        category = CASE WHEN ${body.category !== undefined} THEN ${body.category ?? null} ELSE category END,
        department = CASE WHEN ${body.department !== undefined} THEN ${body.department ?? null} ELSE department END,
        payment_method = COALESCE(${body.payment_method ?? null}, payment_method),
        bank_account_id = CASE WHEN ${body.bank_account_id !== undefined} THEN ${body.bank_account_id ?? null} ELSE bank_account_id END,
        receipt_url = CASE WHEN ${body.receipt_url !== undefined} THEN ${body.receipt_url ?? null} ELSE receipt_url END,
        is_billable = COALESCE(${body.is_billable ?? null}, is_billable),
        customer_id = CASE WHEN ${body.customer_id !== undefined} THEN ${body.customer_id ?? null} ELSE customer_id END,
        status = COALESCE(${body.status ?? null}, status)
      WHERE id = ${params.id}
    `;

    const expenseRows = await sql`SELECT * FROM expenses WHERE id = ${params.id}`;
    const expense = (expenseRows as any[])[0];

    // Create journal entry if status changed to 'paid' and no journal entry exists
    if (body.status === 'paid' && existing.status !== 'paid' && !existing.journal_entry_id && user) {
      const acctRows = await sql`SELECT code FROM accounts WHERE id = ${expense.expense_account_id} LIMIT 1`;
      const expenseAccount = (acctRows as any[])[0];

      if (expenseAccount) {
        const journalResult = await createExpenseJournalEntry(
          {
            id: expense.id,
            expense_number: expense.expense_number,
            expense_date: expense.expense_date,
            amount: expense.total,
            account_code: expenseAccount.code,
            description: expense.description || 'Expense',
            bank_account_id: expense.bank_account_id,
          },
          user.id
        );

        if (journalResult.success && journalResult.journalEntry) {
          await sql`UPDATE expenses SET journal_entry_id = ${journalResult.journalEntry.id} WHERE id = ${params.id}`;
        }
      }
    }

    return NextResponse.json({ data: expense });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/expenses/[id] - Delete expense
export async function DELETE(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const existingRows = await sql`SELECT status, journal_entry_id FROM expenses WHERE id = ${params.id}`;
    const expense = (existingRows as any[])[0];

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    if (expense.status === 'paid' || expense.status === 'approved') {
      return NextResponse.json(
        { error: 'Cannot delete paid or approved expenses. Only pending/rejected expenses can be deleted.' },
        { status: 400 }
      );
    }

    if (expense.journal_entry_id) {
      return NextResponse.json(
        { error: 'Cannot delete expense with journal entry. Contact administrator.' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM expenses WHERE id = ${params.id}`;

    return NextResponse.json({ message: 'Expense deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

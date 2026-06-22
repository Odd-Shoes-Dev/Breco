import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { createExpenseJournalEntry } from '@/lib/accounting/journal-entry-helpers';
import { validatePeriodLock } from '@/lib/accounting/period-lock';

// GET /api/expenses - List expenses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const vendorId = searchParams.get('vendor_id');
    const accountId = searchParams.get('account_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const rows = await sql`
      SELECT
        e.*,
        json_build_object('id', v.id, 'name', v.name) AS vendors,
        json_build_object('id', a.id, 'name', a.name, 'code', a.code) AS accounts,
        json_build_object('id', ba.id, 'name', ba.name) AS bank_accounts
      FROM expenses e
      LEFT JOIN vendors v ON v.id = e.vendor_id
      LEFT JOIN accounts a ON a.id = e.account_id
      LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id
      ORDER BY e.expense_date DESC
    `;

    let data = rows as any[];

    if (status && status !== 'all') data = data.filter((e: any) => e.status === status);
    if (vendorId) data = data.filter((e: any) => e.vendor_id === vendorId);
    if (accountId) data = data.filter((e: any) => e.account_id === accountId);
    if (startDate) data = data.filter((e: any) => e.expense_date >= startDate);
    if (endDate) data = data.filter((e: any) => e.expense_date <= endDate);

    const total = data.length;
    const paged = data.slice(offset, offset + limit);

    return NextResponse.json({
      data: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/expenses - Create expense
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.expense_date || !body.amount || !body.account_id) {
      return NextResponse.json(
        { error: 'Missing required fields: expense_date, amount, account_id' },
        { status: 400 }
      );
    }

    const periodError = await validatePeriodLock(body.expense_date);
    if (periodError) {
      return NextResponse.json({ error: periodError }, { status: 403 });
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const date = new Date();
    const ref = `EXP-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const insertedRows = await sql`
      INSERT INTO expenses (
        expense_number, expense_date, vendor_id, account_id,
        bank_account_id, amount, tax_amount, currency, description,
        payment_method, receipt_url, status, created_by
      ) VALUES (
        ${ref},
        ${body.expense_date}, ${body.vendor_id ?? null}, ${body.account_id},
        ${body.bank_account_id ?? null},
        ${body.amount}, ${body.tax_amount || 0},
        ${body.currency || 'USD'}, ${body.description ?? null},
        ${body.payment_method || 'cash'},
        ${body.receipt_url ?? null}, ${body.status || 'pending'}, ${user.id}
      )
      RETURNING *
    `;
    const expense = (insertedRows as any[])[0];

    // Create journal entry if expense is paid
    if (body.status === 'paid') {
      const acctRows = await sql`SELECT code FROM accounts WHERE id = ${body.account_id} LIMIT 1`;
      const expenseAccount = (acctRows as any[])[0];

      if (expenseAccount) {
        const journalResult = await createExpenseJournalEntry(
          {
            id: expense.id,
            expense_number: expense.expense_number,
            expense_date: expense.expense_date,
            amount: expense.amount,
            account_code: expenseAccount.code,
            description: expense.description || 'Expense',
            bank_account_id: body.bank_account_id,
          },
          user.id
        );

        if (!journalResult.success) {
          console.error('Failed to create journal entry for expense:', journalResult.error);
        }
      }
    }

    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

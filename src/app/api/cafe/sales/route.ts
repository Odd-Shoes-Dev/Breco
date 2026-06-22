import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { validatePeriodLock } from '@/lib/accounting/period-lock';

// POST /api/cafe/sales - Record cafe sales
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!body.sale_date || !body.total || body.total <= 0) {
      return NextResponse.json(
        { error: 'Missing required fields: sale_date and total amount' },
        { status: 400 }
      );
    }

    const periodError = await validatePeriodLock(body.sale_date);
    if (periodError) {
      return NextResponse.json({ error: periodError }, { status: 403 });
    }

    // Get cafe revenue accounts
    const accountRows = await sql`
      SELECT id, code, name FROM accounts WHERE code IN ('4210', '4220', '4230', '1010') ORDER BY code
    `;
    const accounts = accountRows as any[];

    if (!accounts || accounts.length < 4) {
      return NextResponse.json(
        { error: 'Cafe accounts not found. Please run migration 035.' },
        { status: 400 }
      );
    }

    const foodAccount = accounts.find((a: any) => a.code === '4210');
    const beverageAccount = accounts.find((a: any) => a.code === '4220');
    const cateringAccount = accounts.find((a: any) => a.code === '4230');
    const cashAccount = accounts.find((a: any) => a.code === '1010');

    if (!foodAccount || !beverageAccount || !cateringAccount || !cashAccount) {
      return NextResponse.json({ error: 'Required cafe accounts missing' }, { status: 400 });
    }

    // Create journal entry
    const entryDate = new Date(body.sale_date);
    const ref = `CAFE-${entryDate.getFullYear()}${(entryDate.getMonth() + 1).toString().padStart(2, '0')}${entryDate.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const periodLabel = body.period === 'daily' ? 'Daily' : body.period === 'weekly' ? 'Weekly' : 'Monthly';

    const jeRows = await sql`
      INSERT INTO journal_entries (entry_number, entry_date, description, created_by, status)
      VALUES (
        ${ref},
        ${body.sale_date},
        ${`${periodLabel} Cafe Sales - ${new Date(body.sale_date).toLocaleDateString()}`},
        ${user.id},
        ${'posted'}
      )
      RETURNING *
    `;
    const journalEntry = (jeRows as any[])[0];

    // Build journal lines
    const lines = [];
    let lineNumber = 1;

    lines.push({
      journal_entry_id: journalEntry.id,
      line_number: lineNumber++,
      account_id: cashAccount.id,
      debit: body.total,
      credit: 0,
      description: `${periodLabel} sales receipt`,
    });

    if (body.food_sales > 0) {
      lines.push({
        journal_entry_id: journalEntry.id,
        line_number: lineNumber++,
        account_id: foodAccount.id,
        debit: 0,
        credit: body.food_sales,
        description: 'Food sales',
      });
    }

    if (body.beverage_sales > 0) {
      lines.push({
        journal_entry_id: journalEntry.id,
        line_number: lineNumber++,
        account_id: beverageAccount.id,
        debit: 0,
        credit: body.beverage_sales,
        description: 'Beverage sales',
      });
    }

    if (body.catering_sales > 0) {
      lines.push({
        journal_entry_id: journalEntry.id,
        line_number: lineNumber++,
        account_id: cateringAccount.id,
        debit: 0,
        credit: body.catering_sales,
        description: 'Catering sales',
      });
    }

    try {
      for (const line of lines) {
        await sql`
          INSERT INTO journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
          VALUES (${line.journal_entry_id}, ${line.line_number}, ${line.account_id}, ${line.debit}, ${line.credit}, ${line.description})
        `;
      }
    } catch (linesErr: any) {
      // Rollback journal entry
      await sql`DELETE FROM journal_entries WHERE id = ${journalEntry.id}`;
      return NextResponse.json({ error: linesErr.message }, { status: 400 });
    }

    return NextResponse.json({
      data: journalEntry,
      message: 'Sales recorded successfully',
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

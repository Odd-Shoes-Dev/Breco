import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { validatePeriodLock } from '@/lib/accounting/period-lock';

// POST /api/cafe/sales - Record cafe sales
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!body.sale_date || !body.total || body.total <= 0) {
      return NextResponse.json(
        { error: 'Missing required fields: sale_date and total amount' },
        { status: 400 }
      );
    }

    // Check if period is closed
    const periodError = await validatePeriodLock(supabase, body.sale_date);
    if (periodError) {
      return NextResponse.json({ error: periodError }, { status: 403 });
    }

    // Get cafe revenue accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, name')
      .in('code', ['4210', '4220', '4230', '1010']) // Food, Beverage, Catering, Cash
      .order('code');

    if (!accounts || accounts.length < 4) {
      return NextResponse.json(
        { error: 'Cafe accounts not found. Please run migration 035.' },
        { status: 400 }
      );
    }

    const foodAccount = accounts.find(a => a.code === '4210');
    const beverageAccount = accounts.find(a => a.code === '4220');
    const cateringAccount = accounts.find(a => a.code === '4230');
    const cashAccount = accounts.find(a => a.code === '1010');

    if (!foodAccount || !beverageAccount || !cateringAccount || !cashAccount) {
      return NextResponse.json(
        { error: 'Required cafe accounts missing' },
        { status: 400 }
      );
    }

    // Create journal entry
    const entryDate = new Date(body.sale_date);
    const ref = `CAFE-${entryDate.getFullYear()}${(entryDate.getMonth() + 1).toString().padStart(2, '0')}${entryDate.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const periodLabel = body.period === 'daily' ? 'Daily' : body.period === 'weekly' ? 'Weekly' : 'Monthly';
    
    const { data: journalEntry, error: journalError } = await supabase
      .from('journal_entries')
      .insert({
        entry_number: ref,
        entry_date: body.sale_date,
        description: `${periodLabel} Cafe Sales - ${new Date(body.sale_date).toLocaleDateString()}`,
        memo: body.notes || null,
        created_by: user.id,
        status: 'posted',
      })
      .select()
      .single();

    if (journalError) {
      return NextResponse.json({ error: journalError.message }, { status: 400 });
    }

    // Create journal lines
    const lines = [];
    let lineNumber = 1;

    // Debit: Cash account (asset increase)
    lines.push({
      journal_entry_id: journalEntry.id,
      line_number: lineNumber++,
      account_id: cashAccount.id,
      debit: body.total,
      credit: 0,
      description: `${periodLabel} sales receipt`,
    });

    // Credits: Revenue accounts
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

    const { error: linesError } = await supabase
      .from('journal_lines')
      .insert(lines);

    if (linesError) {
      // Rollback journal entry
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      return NextResponse.json({ error: linesError.message }, { status: 400 });
    }

    return NextResponse.json({ 
      data: journalEntry,
      message: 'Sales recorded successfully'
    }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

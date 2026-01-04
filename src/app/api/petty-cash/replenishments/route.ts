import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/petty-cash/replenishments - List petty cash replenishments
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const cash_account_id = searchParams.get('cash_account_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('petty_cash_replenishments')
      .select(`
        *,
        cash_account:bank_accounts!petty_cash_replenishments_cash_account_id_fkey(id, account_name),
        bank_account:bank_accounts!petty_cash_replenishments_bank_account_id_fkey(id, account_name)
      `, { count: 'exact' });

    if (cash_account_id) query = query.eq('cash_account_id', cash_account_id);

    const { data, error, count } = await query
      .order('replenishment_date', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/petty-cash/replenishments - Create petty cash replenishment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!body.cash_account_id || !body.bank_account_id || !body.amount || !body.replenishment_date) {
      return NextResponse.json(
        { error: 'Missing required fields: cash_account_id, bank_account_id, amount, replenishment_date' },
        { status: 400 }
      );
    }

    // Generate replenishment number
    const { data: lastReplenishment } = await supabase
      .from('petty_cash_replenishments')
      .select('replenishment_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
    if (lastReplenishment?.replenishment_number) {
      const match = lastReplenishment.replenishment_number.match(/PCR-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const replenishment_number = `PCR-${String(nextNumber).padStart(6, '0')}`;

    // Create journal entry: DR Petty Cash Account, CR Bank Account
    const { data: journalEntry, error: jeError } = await supabase
      .from('journal_entries')
      .insert({
        entry_date: body.replenishment_date,
        description: `Petty cash replenishment - ${body.amount}`,
        reference_type: 'petty_cash_replenishment',
        created_by: user.id,
      })
      .select()
      .single();

    if (jeError) {
      return NextResponse.json({ error: jeError.message }, { status: 400 });
    }

    // Create journal lines
    const lines = [
      {
        journal_entry_id: journalEntry.id,
        account_id: body.cash_account_id, // DR Petty Cash
        debit: body.amount,
        credit: 0,
      },
      {
        journal_entry_id: journalEntry.id,
        account_id: body.bank_account_id, // CR Bank
        debit: 0,
        credit: body.amount,
      },
    ];

    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(lines);

    if (linesError) {
      // Rollback journal entry
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      return NextResponse.json({ error: linesError.message }, { status: 400 });
    }

    // Create replenishment record
    const { data, error } = await supabase
      .from('petty_cash_replenishments')
      .insert({
        replenishment_number,
        cash_account_id: body.cash_account_id,
        bank_account_id: body.bank_account_id,
        replenishment_date: body.replenishment_date,
        amount: body.amount,
        reference: body.reference,
        notes: body.notes,
        journal_entry_id: journalEntry.id,
        created_by: user.id,
      })
      .select(`
        *,
        cash_account:bank_accounts!petty_cash_replenishments_cash_account_id_fkey(id, account_name),
        bank_account:bank_accounts!petty_cash_replenishments_bank_account_id_fkey(id, account_name)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Update reference_id in journal entry
    await supabase
      .from('journal_entries')
      .update({ reference_id: data.id })
      .eq('id', journalEntry.id);

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

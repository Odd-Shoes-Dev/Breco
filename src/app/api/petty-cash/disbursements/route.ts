import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/petty-cash/disbursements - List petty cash disbursements
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const cash_account_id = searchParams.get('cash_account_id');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('petty_cash_disbursements')
      .select(`
        *,
        cash_account:bank_accounts!petty_cash_disbursements_cash_account_id_fkey(id, account_name),
        approved_by_user:user_profiles!petty_cash_disbursements_approved_by_fkey(id, full_name)
      `, { count: 'exact' });

    if (cash_account_id) query = query.eq('cash_account_id', cash_account_id);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query
      .order('disbursement_date', { ascending: false })
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

// POST /api/petty-cash/disbursements - Create petty cash disbursement
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!body.cash_account_id || !body.amount || !body.category || !body.recipient || !body.disbursement_date) {
      return NextResponse.json(
        { error: 'Missing required fields: cash_account_id, amount, category, recipient, disbursement_date' },
        { status: 400 }
      );
    }

    // Generate disbursement number
    const { data: lastDisbursement } = await supabase
      .from('petty_cash_disbursements')
      .select('disbursement_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
    if (lastDisbursement?.disbursement_number) {
      const match = lastDisbursement.disbursement_number.match(/PC-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const disbursement_number = `PC-${String(nextNumber).padStart(6, '0')}`;

    const { data, error } = await supabase
      .from('petty_cash_disbursements')
      .insert({
        disbursement_number,
        cash_account_id: body.cash_account_id,
        disbursement_date: body.disbursement_date,
        amount: body.amount,
        category: body.category,
        description: body.description,
        recipient: body.recipient,
        receipt_number: body.receipt_number,
        status: body.status || 'pending',
        notes: body.notes,
        created_by: user.id,
      })
      .select(`
        *,
        cash_account:bank_accounts!petty_cash_disbursements_cash_account_id_fkey(id, account_name)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/petty-cash/replenishments - List petty cash replenishments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const cash_account_id = searchParams.get('cash_account_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let rows: any[];
    let countRows: any[];

    if (cash_account_id) {
      rows = await sql`
        SELECT pcr.*,
          json_build_object('id', ca.id, 'account_name', ca.account_name) AS cash_account,
          json_build_object('id', ba.id, 'account_name', ba.account_name) AS bank_account
        FROM petty_cash_replenishments pcr
        LEFT JOIN bank_accounts ca ON ca.id = pcr.cash_account_id
        LEFT JOIN bank_accounts ba ON ba.id = pcr.bank_account_id
        WHERE pcr.cash_account_id = ${cash_account_id}
        ORDER BY pcr.replenishment_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM petty_cash_replenishments WHERE cash_account_id = ${cash_account_id}`;
    } else {
      rows = await sql`
        SELECT pcr.*,
          json_build_object('id', ca.id, 'account_name', ca.account_name) AS cash_account,
          json_build_object('id', ba.id, 'account_name', ba.account_name) AS bank_account
        FROM petty_cash_replenishments pcr
        LEFT JOIN bank_accounts ca ON ca.id = pcr.cash_account_id
        LEFT JOIN bank_accounts ba ON ba.id = pcr.bank_account_id
        ORDER BY pcr.replenishment_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM petty_cash_replenishments`;
    }

    const count = parseInt(countRows[0]?.count || '0');

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/petty-cash/replenishments - Create petty cash replenishment
export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.cash_account_id || !body.bank_account_id || !body.amount || !body.replenishment_date) {
      return NextResponse.json(
        { error: 'Missing required fields: cash_account_id, bank_account_id, amount, replenishment_date' },
        { status: 400 }
      );
    }

    // Generate replenishment number
    const lastRows = await sql`
      SELECT replenishment_number FROM petty_cash_replenishments
      ORDER BY created_at DESC LIMIT 1
    `;
    const lastReplenishment = lastRows[0];

    let nextNumber = 1;
    if (lastReplenishment?.replenishment_number) {
      const match = lastReplenishment.replenishment_number.match(/PCR-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const replenishment_number = `PCR-${String(nextNumber).padStart(6, '0')}`;

    // Create journal entry: DR Petty Cash Account, CR Bank Account
    const jeRows = await sql`
      INSERT INTO journal_entries (entry_date, description, reference_type, created_by)
      VALUES (
        ${body.replenishment_date},
        ${`Petty cash replenishment - ${body.amount}`},
        'petty_cash_replenishment',
        ${user.id}
      )
      RETURNING *
    `;
    const journalEntry = jeRows[0];

    if (!journalEntry) {
      return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 400 });
    }

    // Create journal lines
    try {
      await sql`
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit)
        VALUES (${journalEntry.id}, ${body.cash_account_id}, ${body.amount}, 0)
      `;
      await sql`
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit)
        VALUES (${journalEntry.id}, ${body.bank_account_id}, 0, ${body.amount})
      `;
    } catch (linesError: any) {
      // Rollback journal entry
      await sql`DELETE FROM journal_entries WHERE id = ${journalEntry.id}`;
      return NextResponse.json({ error: linesError.message }, { status: 400 });
    }

    // Create replenishment record
    const repRows = await sql`
      INSERT INTO petty_cash_replenishments (
        replenishment_number, cash_account_id, bank_account_id,
        replenishment_date, amount, reference, notes, journal_entry_id, created_by
      ) VALUES (
        ${replenishment_number}, ${body.cash_account_id}, ${body.bank_account_id},
        ${body.replenishment_date}, ${body.amount},
        ${body.reference ?? null}, ${body.notes ?? null},
        ${journalEntry.id}, ${user.id}
      )
      RETURNING *
    `;
    const replenishment = repRows[0];

    // Update reference_id in journal entry
    await sql`UPDATE journal_entries SET reference_id = ${replenishment.id} WHERE id = ${journalEntry.id}`;

    // Fetch with joined data
    const fullRows = await sql`
      SELECT pcr.*,
        json_build_object('id', ca.id, 'account_name', ca.account_name) AS cash_account,
        json_build_object('id', ba.id, 'account_name', ba.account_name) AS bank_account
      FROM petty_cash_replenishments pcr
      LEFT JOIN bank_accounts ca ON ca.id = pcr.cash_account_id
      LEFT JOIN bank_accounts ba ON ba.id = pcr.bank_account_id
      WHERE pcr.id = ${replenishment.id}
    `;

    return NextResponse.json(fullRows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

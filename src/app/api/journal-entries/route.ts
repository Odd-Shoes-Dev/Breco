import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const postedOnly = searchParams.get('postedOnly') === 'true';

    let conditions = 'WHERE 1=1';
    const params: any[] = [];

    // Build conditions dynamically — we use raw interpolation carefully
    // since sql tagged template doesn't support dynamic WHERE easily,
    // we'll build separate queries based on filter combinations
    let rows: any[];

    if (startDate && endDate && postedOnly) {
      rows = await sql`
        SELECT je.*,
          json_agg(
            json_build_object(
              'id', jl.id,
              'account_id', jl.account_id,
              'debit', jl.debit,
              'credit', jl.credit,
              'description', jl.description,
              'account', json_build_object('code', a.code, 'name', a.name)
            )
          ) FILTER (WHERE jl.id IS NOT NULL) AS lines
        FROM journal_entries je
        LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
        LEFT JOIN accounts a ON a.id = jl.account_id
        WHERE je.entry_date >= ${startDate}
          AND je.entry_date <= ${endDate}
          AND je.status = 'posted'
        GROUP BY je.id
        ORDER BY je.entry_date DESC, je.entry_number DESC
      `;
    } else if (startDate && endDate) {
      rows = await sql`
        SELECT je.*,
          json_agg(
            json_build_object(
              'id', jl.id,
              'account_id', jl.account_id,
              'debit', jl.debit,
              'credit', jl.credit,
              'description', jl.description,
              'account', json_build_object('code', a.code, 'name', a.name)
            )
          ) FILTER (WHERE jl.id IS NOT NULL) AS lines
        FROM journal_entries je
        LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
        LEFT JOIN accounts a ON a.id = jl.account_id
        WHERE je.entry_date >= ${startDate}
          AND je.entry_date <= ${endDate}
        GROUP BY je.id
        ORDER BY je.entry_date DESC, je.entry_number DESC
      `;
    } else if (startDate && postedOnly) {
      rows = await sql`
        SELECT je.*,
          json_agg(
            json_build_object(
              'id', jl.id,
              'account_id', jl.account_id,
              'debit', jl.debit,
              'credit', jl.credit,
              'description', jl.description,
              'account', json_build_object('code', a.code, 'name', a.name)
            )
          ) FILTER (WHERE jl.id IS NOT NULL) AS lines
        FROM journal_entries je
        LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
        LEFT JOIN accounts a ON a.id = jl.account_id
        WHERE je.entry_date >= ${startDate}
          AND je.status = 'posted'
        GROUP BY je.id
        ORDER BY je.entry_date DESC, je.entry_number DESC
      `;
    } else if (endDate && postedOnly) {
      rows = await sql`
        SELECT je.*,
          json_agg(
            json_build_object(
              'id', jl.id,
              'account_id', jl.account_id,
              'debit', jl.debit,
              'credit', jl.credit,
              'description', jl.description,
              'account', json_build_object('code', a.code, 'name', a.name)
            )
          ) FILTER (WHERE jl.id IS NOT NULL) AS lines
        FROM journal_entries je
        LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
        LEFT JOIN accounts a ON a.id = jl.account_id
        WHERE je.entry_date <= ${endDate}
          AND je.status = 'posted'
        GROUP BY je.id
        ORDER BY je.entry_date DESC, je.entry_number DESC
      `;
    } else if (startDate) {
      rows = await sql`
        SELECT je.*,
          json_agg(
            json_build_object(
              'id', jl.id,
              'account_id', jl.account_id,
              'debit', jl.debit,
              'credit', jl.credit,
              'description', jl.description,
              'account', json_build_object('code', a.code, 'name', a.name)
            )
          ) FILTER (WHERE jl.id IS NOT NULL) AS lines
        FROM journal_entries je
        LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
        LEFT JOIN accounts a ON a.id = jl.account_id
        WHERE je.entry_date >= ${startDate}
        GROUP BY je.id
        ORDER BY je.entry_date DESC, je.entry_number DESC
      `;
    } else if (endDate) {
      rows = await sql`
        SELECT je.*,
          json_agg(
            json_build_object(
              'id', jl.id,
              'account_id', jl.account_id,
              'debit', jl.debit,
              'credit', jl.credit,
              'description', jl.description,
              'account', json_build_object('code', a.code, 'name', a.name)
            )
          ) FILTER (WHERE jl.id IS NOT NULL) AS lines
        FROM journal_entries je
        LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
        LEFT JOIN accounts a ON a.id = jl.account_id
        WHERE je.entry_date <= ${endDate}
        GROUP BY je.id
        ORDER BY je.entry_date DESC, je.entry_number DESC
      `;
    } else if (postedOnly) {
      rows = await sql`
        SELECT je.*,
          json_agg(
            json_build_object(
              'id', jl.id,
              'account_id', jl.account_id,
              'debit', jl.debit,
              'credit', jl.credit,
              'description', jl.description,
              'account', json_build_object('code', a.code, 'name', a.name)
            )
          ) FILTER (WHERE jl.id IS NOT NULL) AS lines
        FROM journal_entries je
        LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
        LEFT JOIN accounts a ON a.id = jl.account_id
        WHERE je.status = 'posted'
        GROUP BY je.id
        ORDER BY je.entry_date DESC, je.entry_number DESC
      `;
    } else {
      rows = await sql`
        SELECT je.*,
          json_agg(
            json_build_object(
              'id', jl.id,
              'account_id', jl.account_id,
              'debit', jl.debit,
              'credit', jl.credit,
              'description', jl.description,
              'account', json_build_object('code', a.code, 'name', a.name)
            )
          ) FILTER (WHERE jl.id IS NOT NULL) AS lines
        FROM journal_entries je
        LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
        LEFT JOIN accounts a ON a.id = jl.account_id
        GROUP BY je.id
        ORDER BY je.entry_date DESC, je.entry_number DESC
      `;
    }

    // Transform data to flatten account info
    const transformedData = rows.map((entry: any) => ({
      ...entry,
      lines: (entry.lines || []).map((line: any) => ({
        id: line.id,
        account_code: line.account?.code || '',
        account_name: line.account?.name || '',
        debit_amount: line.debit || 0,
        credit_amount: line.credit || 0,
        description: line.description,
      })),
    }));

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error in journal entries GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const {
      entry_date,
      description,
      reference,
      source,
      source_id,
      lines,
      is_posted = false,
    } = body;

    // Validate that debits equal credits
    const totalDebits = lines.reduce((sum: number, l: any) => sum + (l.debit_amount || 0), 0);
    const totalCredits = lines.reduce((sum: number, l: any) => sum + (l.credit_amount || 0), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json(
        { error: 'Debits must equal credits' },
        { status: 400 }
      );
    }

    // Generate entry number
    const year = new Date(entry_date).getFullYear();
    const prefix = `JE-${year}-%`;
    const lastEntries = await sql`
      SELECT entry_number FROM journal_entries
      WHERE entry_number LIKE ${prefix}
      ORDER BY entry_number DESC
      LIMIT 1
    `;

    let nextNumber = 1;
    const lastEntry = lastEntries[0];
    if (lastEntry?.entry_number) {
      const match = lastEntry.entry_number.match(/JE-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const entryNumber = `JE-${year}-${nextNumber.toString().padStart(4, '0')}`;

    // Create journal entry
    const entryRows = await sql`
      INSERT INTO journal_entries (
        entry_number, entry_date, description, memo,
        source_module, source_document_id, status
      ) VALUES (
        ${entryNumber}, ${entry_date}, ${description}, ${reference || null},
        ${source || 'manual'}, ${source_id || null}, ${is_posted ? 'posted' : 'draft'}
      )
      RETURNING *
    `;
    const entry = entryRows[0];

    if (!entry) {
      return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 });
    }

    // Create journal entry lines
    try {
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        await sql`
          INSERT INTO journal_lines (
            journal_entry_id, line_number, account_id, debit, credit, description
          ) VALUES (
            ${entry.id}, ${index + 1}, ${line.account_id},
            ${line.debit_amount || 0}, ${line.credit_amount || 0},
            ${line.description || ''}
          )
        `;
      }
    } catch (linesError) {
      // Rollback - delete the entry
      await sql`DELETE FROM journal_entries WHERE id = ${entry.id}`;
      console.error('Error creating journal entry lines:', linesError);
      return NextResponse.json({ error: 'Failed to create journal entry lines' }, { status: 500 });
    }

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error in journal entries POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

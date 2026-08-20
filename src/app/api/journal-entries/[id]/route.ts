import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/journal-entries/[id] - Get single journal entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch journal entry with lines
    const entryRows = await sql`
      SELECT je.*,
        json_agg(
          json_build_object(
            'id', jl.id,
            'account_id', jl.account_id,
            'debit', jl.debit,
            'credit', jl.credit,
            'description', jl.description,
            'line_number', jl.line_number,
            'account', json_build_object('code', a.code, 'name', a.name)
          )
        ) FILTER (WHERE jl.id IS NOT NULL) AS lines
      FROM journal_entries je
      LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
      LEFT JOIN accounts a ON a.id = jl.account_id
      WHERE je.id = ${id}
      GROUP BY je.id
    `;

    const entry = entryRows[0];

    if (!entry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    // Transform the response
    const transformedEntry = {
      id: entry.id,
      entry_number: entry.entry_number,
      entry_date: entry.entry_date,
      description: entry.description,
      reference: entry.description || '',
      source: entry.reference_type,
      source_id: entry.reference_id,
      status: entry.status,
      is_posted: entry.status === 'posted',
      lines: (entry.lines || []).map((line: any) => ({
        id: line.id,
        account_id: line.account_id,
        account_code: line.account?.code,
        account_name: line.account?.name,
        debit_amount: line.debit,
        credit_amount: line.credit,
        description: line.description,
        line_number: line.line_number,
      })),
    };

    return NextResponse.json(transformedEntry);
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journal entry' },
      { status: 500 }
    );
  }
}

// PATCH /api/journal-entries/[id] - Update or void journal entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...updateData } = body;

    // Check if entry exists
    const existingRows = await sql`
      SELECT id, status FROM journal_entries WHERE id = ${id}
    `;
    const existingEntry = existingRows[0];

    if (!existingEntry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    // Handle void action
    if (action === 'void') {
      if (existingEntry.status !== 'posted') {
        return NextResponse.json(
          { error: 'Only posted entries can be voided' },
          { status: 400 }
        );
      }

      await sql`UPDATE journal_entries SET status = 'void' WHERE id = ${id}`;

      return NextResponse.json({ message: 'Journal entry voided successfully' });
    }

    // Handle edit action - only drafts can be edited (unless just posting)
    if (existingEntry.status !== 'draft' && action !== 'void') {
      if (!(existingEntry.status === 'draft' && updateData.is_posted === true)) {
        return NextResponse.json(
          { error: 'Only draft entries can be edited' },
          { status: 400 }
        );
      }
    }

    // Validate that debits equal credits if lines are provided
    if (updateData.lines) {
      const totalDebits = updateData.lines.reduce(
        (sum: number, line: any) => sum + (line.debit_amount || 0),
        0
      );
      const totalCredits = updateData.lines.reduce(
        (sum: number, line: any) => sum + (line.credit_amount || 0),
        0
      );

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        return NextResponse.json(
          { error: 'Debits must equal credits' },
          { status: 400 }
        );
      }
    }

    // Update journal entry header fields
    if (updateData.entry_date !== undefined) {
      await sql`UPDATE journal_entries SET entry_date = ${updateData.entry_date} WHERE id = ${id}`;
    }
    if (updateData.description !== undefined) {
      await sql`UPDATE journal_entries SET description = ${updateData.description} WHERE id = ${id}`;
    }
    if (updateData.source !== undefined) {
      await sql`UPDATE journal_entries SET reference_type = ${updateData.source} WHERE id = ${id}`;
    }
    if (updateData.is_posted !== undefined) {
      const newStatus = updateData.is_posted ? 'posted' : 'draft';
      await sql`UPDATE journal_entries SET status = ${newStatus} WHERE id = ${id}`;
    }

    // Update journal lines if provided
    if (updateData.lines) {
      // Delete existing lines
      await sql`DELETE FROM journal_lines WHERE journal_entry_id = ${id}`;

      // Insert new lines
      for (let index = 0; index < updateData.lines.length; index++) {
        const line = updateData.lines[index];
        await sql`
          INSERT INTO journal_lines (
            journal_entry_id, account_id, debit, credit, description, line_number
          ) VALUES (
            ${id}, ${line.account_id}, ${line.debit_amount || 0},
            ${line.credit_amount || 0}, ${line.description || null}, ${index + 1}
          )
        `;
      }
    }

    return NextResponse.json({ message: 'Journal entry updated successfully' });
  } catch (error) {
    console.error('Error updating journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to update journal entry' },
      { status: 500 }
    );
  }
}

// DELETE /api/journal-entries/[id] - Delete draft journal entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if entry exists and is a draft
    const existingRows = await sql`
      SELECT id, status FROM journal_entries WHERE id = ${id}
    `;
    const existingEntry = existingRows[0];

    if (!existingEntry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    if (existingEntry.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft entries can be deleted. Posted entries must be voided.' },
        { status: 400 }
      );
    }

    // Delete journal lines first (due to foreign key constraint)
    await sql`DELETE FROM journal_lines WHERE journal_entry_id = ${id}`;

    // Delete journal entry
    await sql`DELETE FROM journal_entries WHERE id = ${id}`;

    return NextResponse.json({ message: 'Journal entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete journal entry' },
      { status: 500 }
    );
  }
}

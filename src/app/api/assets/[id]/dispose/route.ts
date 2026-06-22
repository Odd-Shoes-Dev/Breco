import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/assets/[id]/dispose - Dispose/sell fixed asset
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    // Validate required fields
    if (!body.disposal_date) {
      return NextResponse.json(
        { error: 'Missing required fields: disposal_date' },
        { status: 400 }
      );
    }

    // Get asset details
    const assetRows = await sql`
      SELECT fa.*, a.* FROM fixed_assets fa
      LEFT JOIN accounts a ON a.id = fa.asset_account_id
      WHERE fa.id = ${id}
    `;

    if (assetRows.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const asset = assetRows[0];

    if (asset.status === 'disposed') {
      return NextResponse.json({ error: 'Asset already disposed' }, { status: 400 });
    }

    // Calculate current book value (purchase_price - accumulated depreciation)
    const bookValue = asset.purchase_price - (asset.accumulated_depreciation || 0);
    const disposalAmount = body.disposal_amount || 0;
    const gainLoss = disposalAmount - bookValue;

    // Get accounts needed for disposal
    const accounts = await sql`
      SELECT * FROM accounts WHERE code IN ('1800', '1900', '4500', '5500')
    `;

    const cashAccount = accounts.find((a: any) => a.code === '1800');
    const accumDeprAccount = accounts.find((a: any) => a.code === '1900');
    const gainAccount = accounts.find((a: any) => a.code === '4500');
    const lossAccount = accounts.find((a: any) => a.code === '5500');

    if (!cashAccount || !accumDeprAccount) {
      return NextResponse.json(
        { error: 'Required accounts not found (1800, 1900)' },
        { status: 400 }
      );
    }

    // Create journal entry for disposal
    const description = `Asset disposal - ${asset.name}`;
    const jeRows = await sql`
      INSERT INTO journal_entries (entry_date, description, reference_type, reference_id, created_by)
      VALUES (${body.disposal_date}, ${description}, 'asset_disposal', ${id}, ${user.id})
      RETURNING *
    `;
    const journalEntry = jeRows[0];

    // Create journal lines
    const lines: any[] = [];

    // 1. DR Cash (if sold)
    if (disposalAmount > 0) {
      lines.push({
        journal_entry_id: journalEntry.id,
        account_id: cashAccount.id,
        debit: disposalAmount,
        credit: 0,
        description: 'Cash received from disposal',
      });
    }

    // 2. DR Accumulated Depreciation
    if (asset.accumulated_depreciation > 0) {
      lines.push({
        journal_entry_id: journalEntry.id,
        account_id: accumDeprAccount.id,
        debit: asset.accumulated_depreciation,
        credit: 0,
        description: 'Remove accumulated depreciation',
      });
    }

    // 3. DR Loss on Sale OR CR Gain on Sale
    if (gainLoss < 0 && lossAccount) {
      lines.push({
        journal_entry_id: journalEntry.id,
        account_id: lossAccount.id,
        debit: Math.abs(gainLoss),
        credit: 0,
        description: 'Loss on asset disposal',
      });
    } else if (gainLoss > 0 && gainAccount) {
      lines.push({
        journal_entry_id: journalEntry.id,
        account_id: gainAccount.id,
        debit: 0,
        credit: gainLoss,
        description: 'Gain on asset disposal',
      });
    }

    // 4. CR Asset (at cost)
    lines.push({
      journal_entry_id: journalEntry.id,
      account_id: asset.asset_account_id,
      debit: 0,
      credit: asset.purchase_price,
      description: 'Remove asset from books',
    });

    try {
      for (const line of lines) {
        await sql`
          INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description)
          VALUES (${line.journal_entry_id}, ${line.account_id}, ${line.debit}, ${line.credit}, ${line.description})
        `;
      }
    } catch (linesError: any) {
      // Rollback journal entry
      await sql`DELETE FROM journal_entries WHERE id = ${journalEntry.id}`;
      return NextResponse.json({ error: linesError.message }, { status: 400 });
    }

    // Update asset status
    const updatedRows = await sql`
      UPDATE fixed_assets
      SET
        status = 'disposed',
        disposal_date = ${body.disposal_date},
        disposal_amount = ${disposalAmount},
        current_book_value = 0,
        notes = ${body.disposal_notes || null}
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({
      asset: updatedRows[0],
      disposal_summary: {
        original_cost: asset.purchase_price,
        accumulated_depreciation: asset.accumulated_depreciation,
        book_value: bookValue,
        disposal_amount: disposalAmount,
        gain_loss: gainLoss,
        journal_entry_id: journalEntry.id,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

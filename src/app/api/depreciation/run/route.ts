import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { period_end_date } = await request.json();

    if (!period_end_date) {
      return NextResponse.json(
        { error: 'period_end_date is required' },
        { status: 400 }
      );
    }

    const periodDate = new Date(period_end_date);
    const year = periodDate.getFullYear();
    const month = periodDate.getMonth() + 1;

    // Get all active assets
    const assetRows = await sql`
      SELECT * FROM fixed_assets
      WHERE status = 'active' AND depreciation_method IS NOT NULL
    `;
    const assets = assetRows as any[];

    if (!assets || assets.length === 0) {
      return NextResponse.json({ message: 'No assets to depreciate', entries: [] });
    }

    const depreciationEntries = [];
    const journalEntries = [];

    for (const asset of assets) {
      // Skip if already fully depreciated
      if (Number(asset.accumulated_depreciation) >= (Number(asset.purchase_price) - (Number(asset.salvage_value) || 0))) {
        continue;
      }

      // Check if depreciation already posted for this period
      const periodStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const periodEnd = new Date(year, month, 0).toISOString().split('T')[0];
      const existingRows = await sql`
        SELECT id FROM depreciation_entries
        WHERE asset_id = ${asset.id} AND period_start = ${periodStart} AND period_end = ${periodEnd}
        LIMIT 1
      `;
      if ((existingRows as any[]).length > 0) continue;

      // Calculate depreciation based on method
      let monthlyDepreciation = 0;
      const depreciableAmount = Number(asset.purchase_price) - (Number(asset.salvage_value) || 0);

      if (asset.depreciation_method === 'straight_line') {
        const monthsInUsefulLife = Number(asset.useful_life_months) || 1;
        monthlyDepreciation = depreciableAmount / monthsInUsefulLife;
      } else if (asset.depreciation_method === 'reducing_balance') {
        const rate = 2 / ((Number(asset.useful_life_months) || 1) / 12);
        const bookValue = Number(asset.purchase_price) - Number(asset.accumulated_depreciation);
        monthlyDepreciation = (bookValue * rate) / 12;
      } else if (asset.depreciation_method === 'units_of_production') {
        continue;
      }

      const remainingDepreciable = depreciableAmount - Number(asset.accumulated_depreciation);
      monthlyDepreciation = Math.min(monthlyDepreciation, remainingDepreciable);

      if (monthlyDepreciation <= 0) continue;

      const newAccumulated = Number(asset.accumulated_depreciation) + monthlyDepreciation;
      const newBookValue = Number(asset.purchase_price) - newAccumulated;

      // Create depreciation entry
      const entryRows = await sql`
        INSERT INTO depreciation_entries (
          asset_id, entry_date, period_start, period_end, depreciation_amount,
          accumulated_depreciation, book_value
        ) VALUES (
          ${asset.id}, ${period_end_date}, ${periodStart}, ${periodEnd},
          ${monthlyDepreciation},
          ${newAccumulated},
          ${newBookValue}
        )
        RETURNING *
      `;
      const entry = (entryRows as any[])[0];

      // Update asset accumulated depreciation and book value
      await sql`
        UPDATE fixed_assets
        SET accumulated_depreciation = ${newAccumulated},
            current_book_value = ${newBookValue}
        WHERE id = ${asset.id}
      `;

      depreciationEntries.push(entry);

      // Create journal entry
      const jeRows = await sql`
        INSERT INTO journal_entries (
          entry_number, entry_date, description, reference_type, reference_id
        ) VALUES (
          ${`DEP-${year}-${month.toString().padStart(2, '0')}-${asset.id.slice(0, 8)}`},
          ${period_end_date},
          ${`Depreciation for ${asset.name} - ${month}/${year}`},
          ${'depreciation'}, ${entry.id}
        )
        RETURNING *
      `;
      const journalEntry = (jeRows as any[])[0];

      // Get accounts
      const depExpAcctRows = await sql`
        SELECT id FROM accounts
        WHERE account_type = 'expense' AND name ILIKE '%depreciation%'
        LIMIT 1
      `;
      const accumDepAcctRows = await sql`
        SELECT id FROM accounts
        WHERE account_subtype = 'fixed_asset' AND name ILIKE '%accumulated%depreciation%'
        LIMIT 1
      `;
      const depreciationExpenseAccount = (depExpAcctRows as any[])[0];
      const accumulatedDepreciationAccount = (accumDepAcctRows as any[])[0];

      const lines = [];

      if (depreciationExpenseAccount) {
        lines.push({
          journal_entry_id: journalEntry.id,
          account_id: depreciationExpenseAccount.id,
          debit: monthlyDepreciation,
          credit: 0,
          description: `Depreciation - ${asset.name}`,
        });
      }

      if (accumulatedDepreciationAccount) {
        lines.push({
          journal_entry_id: journalEntry.id,
          account_id: accumulatedDepreciationAccount.id,
          debit: 0,
          credit: monthlyDepreciation,
          description: `Accumulated Depreciation - ${asset.name}`,
        });
      }

      if (lines.length > 0) {
        for (const line of lines) {
          await sql`
            INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (${line.journal_entry_id}, ${line.account_id}, ${line.debit}, ${line.credit}, ${line.description})
          `;
        }
        journalEntries.push(journalEntry);
      }
    }

    return NextResponse.json({
      message: `Depreciation posted for ${depreciationEntries.length} assets`,
      entries: depreciationEntries,
      journal_entries: journalEntries.length,
    });
  } catch (error: any) {
    console.error('Error running depreciation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

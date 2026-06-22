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
      if (Number(asset.accumulated_depreciation) >= (Number(asset.purchase_cost) - (Number(asset.residual_value) || 0))) {
        continue;
      }

      // Check if depreciation already posted for this period
      const existingRows = await sql`
        SELECT id FROM depreciation_schedules
        WHERE asset_id = ${asset.id} AND year = ${year} AND month = ${month}
        LIMIT 1
      `;
      if ((existingRows as any[]).length > 0) continue;

      // Calculate depreciation based on method
      let monthlyDepreciation = 0;
      const depreciableAmount = Number(asset.purchase_cost) - (Number(asset.residual_value) || 0);

      if (asset.depreciation_method === 'straight_line') {
        const monthsInUsefulLife = (Number(asset.useful_life_years) || 1) * 12;
        monthlyDepreciation = depreciableAmount / monthsInUsefulLife;
      } else if (asset.depreciation_method === 'declining_balance') {
        const rate = 2 / (Number(asset.useful_life_years) || 1);
        const bookValue = Number(asset.purchase_cost) - Number(asset.accumulated_depreciation);
        monthlyDepreciation = (bookValue * rate) / 12;
      } else if (asset.depreciation_method === 'units_of_production') {
        continue;
      }

      const remainingDepreciable = depreciableAmount - Number(asset.accumulated_depreciation);
      monthlyDepreciation = Math.min(monthlyDepreciation, remainingDepreciable);

      if (monthlyDepreciation <= 0) continue;

      // Create depreciation schedule entry
      const scheduleRows = await sql`
        INSERT INTO depreciation_schedules (
          asset_id, company_id, year, month, depreciation_amount,
          accumulated_depreciation, book_value, is_posted
        ) VALUES (
          ${asset.id}, ${asset.company_id}, ${year}, ${month},
          ${monthlyDepreciation},
          ${Number(asset.accumulated_depreciation) + monthlyDepreciation},
          ${Number(asset.purchase_cost) - (Number(asset.accumulated_depreciation) + monthlyDepreciation)},
          ${true}
        )
        RETURNING *
      `;
      const schedule = (scheduleRows as any[])[0];

      // Update asset accumulated depreciation
      await sql`
        UPDATE fixed_assets
        SET accumulated_depreciation = ${Number(asset.accumulated_depreciation) + monthlyDepreciation}
        WHERE id = ${asset.id}
      `;

      depreciationEntries.push(schedule);

      // Create journal entry
      const jeRows = await sql`
        INSERT INTO journal_entries (
          company_id, entry_date, description, reference_type, reference_id
        ) VALUES (
          ${asset.company_id}, ${period_end_date},
          ${`Depreciation for ${asset.asset_name} - ${month}/${year}`},
          ${'depreciation'}, ${schedule.id}
        )
        RETURNING *
      `;
      const journalEntry = (jeRows as any[])[0];

      // Get accounts
      const depExpAcctRows = await sql`
        SELECT id FROM accounts
        WHERE company_id = ${asset.company_id} AND account_type = 'Expense' AND account_name ILIKE '%depreciation%'
        LIMIT 1
      `;
      const accumDepAcctRows = await sql`
        SELECT id FROM accounts
        WHERE company_id = ${asset.company_id} AND account_type = 'Contra Asset' AND account_name ILIKE '%accumulated%depreciation%'
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
          description: `Depreciation - ${asset.asset_name}`,
        });
      }

      if (accumulatedDepreciationAccount) {
        lines.push({
          journal_entry_id: journalEntry.id,
          account_id: accumulatedDepreciationAccount.id,
          debit: 0,
          credit: monthlyDepreciation,
          description: `Accumulated Depreciation - ${asset.asset_name}`,
        });
      }

      if (lines.length > 0) {
        for (const line of lines) {
          await sql`
            INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
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

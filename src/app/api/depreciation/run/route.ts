import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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
    const { data: assets, error: assetsError } = await supabase
      .from('fixed_assets')
      .select('*')
      .eq('status', 'active')
      .not('depreciation_method', 'is', null);

    if (assetsError) throw assetsError;

    if (!assets || assets.length === 0) {
      return NextResponse.json({ message: 'No assets to depreciate', entries: [] });
    }

    const depreciationEntries = [];
    const journalEntries = [];

    for (const asset of assets) {
      // Skip if already fully depreciated
      if (asset.accumulated_depreciation >= (asset.purchase_cost - (asset.residual_value || 0))) {
        continue;
      }

      // Check if depreciation already posted for this period
      const { data: existingSchedule } = await supabase
        .from('depreciation_schedules')
        .select('id')
        .eq('asset_id', asset.id)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (existingSchedule) {
        continue; // Already posted
      }

      // Calculate depreciation based on method
      let monthlyDepreciation = 0;
      const depreciableAmount = asset.purchase_cost - (asset.residual_value || 0);
      
      if (asset.depreciation_method === 'straight_line') {
        const monthsInUsefulLife = (asset.useful_life_years || 1) * 12;
        monthlyDepreciation = depreciableAmount / monthsInUsefulLife;
      } else if (asset.depreciation_method === 'declining_balance') {
        const rate = 2 / (asset.useful_life_years || 1); // Double declining
        const bookValue = asset.purchase_cost - asset.accumulated_depreciation;
        monthlyDepreciation = (bookValue * rate) / 12;
      } else if (asset.depreciation_method === 'units_of_production') {
        // Would need usage data - skip for now
        continue;
      }

      // Don't exceed remaining depreciable amount
      const remainingDepreciable = depreciableAmount - asset.accumulated_depreciation;
      monthlyDepreciation = Math.min(monthlyDepreciation, remainingDepreciable);

      if (monthlyDepreciation <= 0) {
        continue;
      }

      // Create depreciation schedule entry
      const { data: schedule, error: scheduleError } = await supabase
        .from('depreciation_schedules')
        .insert({
          asset_id: asset.id,
          company_id: asset.company_id,
          year,
          month,
          depreciation_amount: monthlyDepreciation,
          accumulated_depreciation: asset.accumulated_depreciation + monthlyDepreciation,
          book_value: asset.purchase_cost - (asset.accumulated_depreciation + monthlyDepreciation),
          is_posted: true,
        })
        .select()
        .single();

      if (scheduleError) throw scheduleError;

      // Update asset accumulated depreciation
      await supabase
        .from('fixed_assets')
        .update({
          accumulated_depreciation: asset.accumulated_depreciation + monthlyDepreciation,
        })
        .eq('id', asset.id);

      depreciationEntries.push(schedule);

      // Create journal entry
      const { data: journalEntry, error: jeError } = await supabase
        .from('journal_entries')
        .insert({
          company_id: asset.company_id,
          entry_date: period_end_date,
          description: `Depreciation for ${asset.asset_name} - ${month}/${year}`,
          reference_type: 'depreciation',
          reference_id: schedule.id,
        })
        .select()
        .single();

      if (jeError) throw jeError;

      // Get accounts
      const { data: depreciationExpenseAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('company_id', asset.company_id)
        .eq('account_type', 'Expense')
        .ilike('account_name', '%depreciation%')
        .limit(1)
        .single();

      const { data: accumulatedDepreciationAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('company_id', asset.company_id)
        .eq('account_type', 'Contra Asset')
        .ilike('account_name', '%accumulated%depreciation%')
        .limit(1)
        .single();

      // Create journal lines
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
        await supabase.from('journal_entry_lines').insert(lines);
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

// =====================================================
// Fixed Assets & Depreciation Logic
// Breco Safaris Ltd Financial System
// =====================================================

import { sql } from '@/lib/db';
import { createJournalEntry, postJournalEntry } from './general-ledger';
import type { FixedAsset, DepreciationEntry } from '@/types/database';
import Decimal from 'decimal.js';

/**
 * Calculates monthly depreciation amount based on method
 */
export function calculateMonthlyDepreciation(
  asset: {
    purchase_price: number;
    salvage_value: number;
    useful_life_months: number;
    depreciation_method: string;
    accumulated_depreciation: number;
  }
): Decimal {
  const cost = new Decimal(asset.purchase_price);
  const residual = new Decimal(asset.salvage_value || 0);
  const depreciableAmount = cost.minus(residual);
  const accumulated = new Decimal(asset.accumulated_depreciation || 0);
  const remainingValue = cost.minus(accumulated).minus(residual);

  if (remainingValue.lessThanOrEqualTo(0)) {
    return new Decimal(0);
  }

  switch (asset.depreciation_method) {
    case 'straight_line': {
      // (Cost - Residual) / Useful Life in months
      return depreciableAmount.div(asset.useful_life_months);
    }
    case 'reducing_balance': {
      // Double declining balance: (2 / Useful Life) * Book Value
      const rate = new Decimal(2).div(asset.useful_life_months);
      const bookValue = cost.minus(accumulated);
      let monthlyDepr = bookValue.times(rate).div(12);

      // Don't depreciate below residual value
      if (bookValue.minus(monthlyDepr).lessThan(residual)) {
        monthlyDepr = bookValue.minus(residual);
      }
      return monthlyDepr.greaterThan(0) ? monthlyDepr : new Decimal(0);
    }
    default:
      return depreciableAmount.div(asset.useful_life_months);
  }
}

/**
 * Gets assets due for depreciation in a given period
 */
export async function getAssetsDueForDepreciation(
  periodEndDate: string
): Promise<FixedAsset[]> {
  const assets = await sql`
    SELECT * FROM fixed_assets
    WHERE status = 'active'
      AND depreciation_start_date <= ${periodEndDate}
  `;

  if (!assets || assets.length === 0) return [];

  // Filter out assets that have already been depreciated this month
  const periodStart = periodEndDate.substring(0, 7) + '-01';

  const assetsWithDepreciation = await Promise.all(
    assets.map(async (asset: any) => {
      const existing = await sql`
        SELECT id FROM depreciation_entries
        WHERE asset_id = ${asset.id}
          AND depreciation_date >= ${periodStart}
          AND depreciation_date <= ${periodEndDate}
        LIMIT 1
      `;
      return { asset, hasDepreciation: existing.length > 0 };
    })
  );

  return assetsWithDepreciation
    .filter((a) => !a.hasDepreciation)
    .map((a) => a.asset);
}

/**
 * Runs depreciation for a single asset
 */
export async function runAssetDepreciation(
  assetId: string,
  depreciationDate: string,
  userId: string
): Promise<DepreciationEntry> {
  // Get asset with category
  const assetRows = await sql`
    SELECT fa.*, ac.depreciation_expense_account_id, ac.accumulated_depreciation_account_id
    FROM fixed_assets fa
    LEFT JOIN asset_categories ac ON ac.id = fa.category_id
    WHERE fa.id = ${assetId}
    LIMIT 1
  `;
  const asset = assetRows[0];
  if (!asset) throw new Error('Asset not found');
  if (asset.status !== 'active') {
    throw new Error(`Cannot depreciate asset with status: ${asset.status}`);
  }

  // Calculate depreciation amount
  const depreciationAmount = calculateMonthlyDepreciation(asset);

  if (depreciationAmount.lessThanOrEqualTo(0)) {
    // Asset is fully depreciated
    await sql`UPDATE fixed_assets SET status = 'fully_depreciated' WHERE id = ${assetId}`;
    throw new Error('Asset is fully depreciated');
  }

  // Get accounts from category or defaults
  const deprExpenseAccountId = asset.depreciation_expense_account_id;
  const accumDeprAccountId = asset.accumulated_depreciation_account_id;

  if (!deprExpenseAccountId || !accumDeprAccountId) {
    throw new Error('Asset category missing depreciation accounts');
  }

  // Get period
  const periodRows = await sql`
    SELECT id FROM fiscal_periods
    WHERE level = 'monthly'
      AND start_date <= ${depreciationDate}
      AND end_date >= ${depreciationDate}
    LIMIT 1
  `;
  const period = periodRows[0];

  // Create journal entry: DR Depreciation Expense, CR Accumulated Depreciation
  const journalEntry = await createJournalEntry(
    {
      entry_date: depreciationDate,
      description: `Depreciation - ${asset.name} (${asset.asset_number})`,
      reference_type: 'depreciation',
      reference_id: assetId,
      lines: [
        {
          account_id: deprExpenseAccountId,
          description: `Depreciation - ${asset.name}`,
          debit: depreciationAmount.toNumber(),
          credit: 0,
        },
        {
          account_id: accumDeprAccountId,
          description: `Accumulated Depreciation - ${asset.name}`,
          debit: 0,
          credit: depreciationAmount.toNumber(),
        },
      ],
    },
    userId
  );

  await postJournalEntry(journalEntry.id, userId);

  // Create depreciation entry record
  const deprRows = await sql`
    INSERT INTO depreciation_entries (asset_id, period_id, depreciation_date, amount, journal_entry_id)
    VALUES (${assetId}, ${period?.id ?? null}, ${depreciationDate}, ${depreciationAmount.toNumber()}, ${journalEntry.id})
    RETURNING *
  `;
  const deprEntry = deprRows[0];
  if (!deprEntry) throw new Error('Failed to create depreciation entry');

  // Update asset accumulated depreciation
  const newAccumDepr = new Decimal(asset.accumulated_depreciation || 0)
    .plus(depreciationAmount)
    .toNumber();

  const newStatus =
    new Decimal(asset.purchase_price).minus(newAccumDepr).lessThanOrEqualTo(asset.salvage_value || 0)
      ? 'fully_depreciated'
      : 'active';

  await sql`
    UPDATE fixed_assets
    SET accumulated_depreciation = ${newAccumDepr}, status = ${newStatus}
    WHERE id = ${assetId}
  `;

  // Log activity
  await sql`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (
      ${userId}, 'depreciate', 'fixed_asset', ${assetId},
      ${JSON.stringify({ amount: depreciationAmount.toNumber(), accumulated: newAccumDepr })}
    )
  `;

  return deprEntry;
}

/**
 * Runs monthly depreciation for all active assets
 */
export async function runMonthlyDepreciation(
  depreciationDate: string,
  userId: string
): Promise<{ processed: number; errors: string[] }> {
  const assets = await getAssetsDueForDepreciation(depreciationDate);
  const errors: string[] = [];
  let processed = 0;

  for (const asset of assets) {
    try {
      await runAssetDepreciation(asset.id, depreciationDate, userId);
      processed++;
    } catch (error) {
      errors.push(`${asset.asset_number}: ${(error as Error).message}`);
    }
  }

  return { processed, errors };
}

/**
 * Disposes of a fixed asset
 */
export async function disposeAsset(
  assetId: string,
  disposalDate: string,
  disposalPrice: number,
  userId: string
): Promise<{ journalEntryId: string; gainLoss: number }> {
  // Get asset with category
  const assetRows = await sql`
    SELECT fa.*, ac.accumulated_depreciation_account_id
    FROM fixed_assets fa
    LEFT JOIN asset_categories ac ON ac.id = fa.category_id
    WHERE fa.id = ${assetId}
    LIMIT 1
  `;
  const asset = assetRows[0];
  if (!asset) throw new Error('Asset not found');
  if (asset.status === 'disposed') {
    throw new Error('Asset is already disposed');
  }

  const bookValue = new Decimal(asset.purchase_price)
    .minus(asset.accumulated_depreciation || 0)
    .toNumber();
  const gainLoss = disposalPrice - bookValue;

  // Get accounts
  const accumDeprAccountId = asset.accumulated_depreciation_account_id;
  const assetAccountId = asset.asset_account_id;

  // Get cash account (assuming disposal proceeds go to cash)
  const cashRows = await sql`SELECT id FROM accounts WHERE code = '1100' LIMIT 1`;
  const cashAccount = cashRows[0];

  // Get gain/loss account
  const gainLossAccountCode = gainLoss >= 0 ? '4900' : '8920'; // Other Income or Loss on Disposal
  const gainLossRows = await sql`SELECT id FROM accounts WHERE code = ${gainLossAccountCode} LIMIT 1`;
  const gainLossAccount = gainLossRows[0];

  // Build journal entry lines
  const lines: {
    account_id: string;
    description: string;
    debit: number;
    credit: number;
  }[] = [];

  // DR Cash for disposal proceeds
  if (disposalPrice > 0) {
    lines.push({
      account_id: cashAccount!.id,
      description: `Disposal of ${asset.name}`,
      debit: disposalPrice,
      credit: 0,
    });
  }

  // DR Accumulated Depreciation to remove it
  if (asset.accumulated_depreciation > 0) {
    lines.push({
      account_id: accumDeprAccountId!,
      description: `Remove accumulated depreciation - ${asset.name}`,
      debit: asset.accumulated_depreciation,
      credit: 0,
    });
  }

  // CR Asset account to remove asset
  lines.push({
    account_id: assetAccountId!,
    description: `Disposal of ${asset.name}`,
    debit: 0,
    credit: asset.purchase_price,
  });

  // Gain or Loss
  if (gainLoss > 0) {
    // Gain - Credit
    lines.push({
      account_id: gainLossAccount!.id,
      description: `Gain on disposal of ${asset.name}`,
      debit: 0,
      credit: gainLoss,
    });
  } else if (gainLoss < 0) {
    // Loss - Debit
    lines.push({
      account_id: gainLossAccount!.id,
      description: `Loss on disposal of ${asset.name}`,
      debit: Math.abs(gainLoss),
      credit: 0,
    });
  }

  // Create and post journal entry
  const journalEntry = await createJournalEntry(
    {
      entry_date: disposalDate,
      description: `Asset Disposal - ${asset.name} (${asset.asset_number})`,
      reference_type: 'asset_disposal',
      reference_id: assetId,
      lines,
    },
    userId
  );

  await postJournalEntry(journalEntry.id, userId);

  // Update asset status
  await sql`
    UPDATE fixed_assets
    SET status = 'disposed', disposal_date = ${disposalDate},
        disposal_price = ${disposalPrice}, disposal_journal_id = ${journalEntry.id}
    WHERE id = ${assetId}
  `;

  // Log activity
  await sql`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (
      ${userId}, 'dispose', 'fixed_asset', ${assetId},
      ${JSON.stringify({ disposal_date: disposalDate, disposal_price: disposalPrice, gain_loss: gainLoss })}
    )
  `;

  return { journalEntryId: journalEntry.id, gainLoss };
}

/**
 * Gets depreciation schedule for an asset
 */
export function generateDepreciationSchedule(
  asset: {
    purchase_price: number;
    salvage_value: number;
    useful_life_months: number;
    depreciation_method: string;
    depreciation_start_date: string;
    accumulated_depreciation: number;
  }
): {
  month: string;
  depreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
}[] {
  const schedule: {
    month: string;
    depreciation: number;
    accumulatedDepreciation: number;
    bookValue: number;
  }[] = [];

  let accumulated = new Decimal(asset.accumulated_depreciation || 0);
  const cost = new Decimal(asset.purchase_price);
  const residual = new Decimal(asset.salvage_value || 0);

  const startDate = new Date(asset.depreciation_start_date);

  for (let i = 0; i < asset.useful_life_months; i++) {
    const currentDate = new Date(startDate);
    currentDate.setMonth(currentDate.getMonth() + i);

    const depr = calculateMonthlyDepreciation({
      ...asset,
      accumulated_depreciation: accumulated.toNumber(),
    });

    if (depr.lessThanOrEqualTo(0)) break;

    accumulated = accumulated.plus(depr);
    const bookValue = cost.minus(accumulated);

    schedule.push({
      month: currentDate.toISOString().substring(0, 7),
      depreciation: depr.toNumber(),
      accumulatedDepreciation: accumulated.toNumber(),
      bookValue: bookValue.toNumber(),
    });

    if (bookValue.lessThanOrEqualTo(residual)) break;
  }

  return schedule;
}

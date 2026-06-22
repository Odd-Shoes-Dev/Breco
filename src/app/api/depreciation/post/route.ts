import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { calculateMonthlyDepreciation } from '@/lib/accounting/assets';

// GET /api/depreciation/post - Preview next depreciation posting
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const periodEnd = searchParams.get('period_end') || new Date().toISOString().split('T')[0];
    const periodEndDate = new Date(periodEnd);
    const periodStart = searchParams.get('period_start') ||
      new Date(periodEndDate.getFullYear(), periodEndDate.getMonth(), 1).toISOString().split('T')[0];

    // Check if depreciation already posted for this period
    const existingRows = await sql`
      SELECT id, posting_date, total_depreciation
      FROM depreciation_postings
      WHERE period_start = ${periodStart} AND period_end = ${periodEnd} AND status = 'posted'
      LIMIT 1
    `;
    const existingPosting = (existingRows as any[])[0];

    if (existingPosting) {
      return NextResponse.json({
        error: 'Depreciation already posted for this period',
        existing_posting: existingPosting,
      }, { status: 400 });
    }

    const assetRows = await sql`
      SELECT * FROM assets
      WHERE status = 'active' AND depreciation_start_date <= ${periodEnd}
    `;
    const assets = assetRows as any[];

    if (!assets || assets.length === 0) {
      return NextResponse.json({
        message: 'No active assets to depreciate',
        preview: {
          period_start: periodStart,
          period_end: periodEnd,
          assets: [],
          total_depreciation: 0,
          assets_count: 0,
        },
      });
    }

    const assetDetails = [];
    let totalDepreciation = 0;

    for (const asset of assets) {
      if (asset.accumulated_depreciation >= (asset.purchase_price - (asset.salvage_value || 0))) {
        continue;
      }

      const monthlyDepreciation = calculateMonthlyDepreciation(asset);
      const monthlyDepreciationNum = monthlyDepreciation.toNumber();

      if (monthlyDepreciationNum > 0) {
        const accumulatedBefore = Number(asset.accumulated_depreciation) || 0;
        const accumulatedAfter = Math.min(
          accumulatedBefore + monthlyDepreciationNum,
          Number(asset.purchase_price) - (Number(asset.salvage_value) || 0)
        );
        const actualDepreciation = accumulatedAfter - accumulatedBefore;

        assetDetails.push({
          asset_id: asset.id,
          asset_name: asset.name,
          asset_code: asset.asset_code,
          depreciation_method: asset.depreciation_method,
          depreciation_amount: actualDepreciation,
          accumulated_before: accumulatedBefore,
          accumulated_after: accumulatedAfter,
          book_value_before: asset.book_value || (Number(asset.purchase_price) - accumulatedBefore),
          book_value_after: Number(asset.purchase_price) - accumulatedAfter,
          purchase_price: asset.purchase_price,
          salvage_value: asset.salvage_value,
        });

        totalDepreciation += actualDepreciation;
      }
    }

    return NextResponse.json({
      data: {
        period_start: periodStart,
        period_end: periodEnd,
        posting_date: periodEnd,
        assets: assetDetails,
        total_depreciation: totalDepreciation,
        assets_count: assetDetails.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/depreciation/post - Post monthly depreciation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!body.period_start || !body.period_end) {
      return NextResponse.json(
        { error: 'Missing required fields: period_start, period_end' },
        { status: 400 }
      );
    }

    const periodStart = body.period_start;
    const periodEnd = body.period_end;
    const postingDate = body.posting_date || periodEnd;

    // Check if already posted
    const existingRows = await sql`
      SELECT id FROM depreciation_postings
      WHERE period_start = ${periodStart} AND period_end = ${periodEnd} AND status = 'posted'
      LIMIT 1
    `;
    if ((existingRows as any[]).length > 0) {
      return NextResponse.json(
        { error: 'Depreciation already posted for this period' },
        { status: 400 }
      );
    }

    const assetRows = await sql`
      SELECT * FROM assets WHERE status = 'active' AND depreciation_start_date <= ${periodEnd}
    `;
    const assets = assetRows as any[];

    if (!assets || assets.length === 0) {
      return NextResponse.json({ error: 'No active assets to depreciate' }, { status: 400 });
    }

    const assetDetails = [];
    let totalDepreciation = 0;

    for (const asset of assets) {
      if (asset.accumulated_depreciation >= (Number(asset.purchase_price) - (Number(asset.salvage_value) || 0))) {
        continue;
      }

      const monthlyDepreciation = calculateMonthlyDepreciation(asset);
      const monthlyDepreciationNum = monthlyDepreciation.toNumber();

      if (monthlyDepreciationNum > 0) {
        const accumulatedBefore = Number(asset.accumulated_depreciation) || 0;
        const accumulatedAfter = Math.min(
          accumulatedBefore + monthlyDepreciationNum,
          Number(asset.purchase_price) - (Number(asset.salvage_value) || 0)
        );
        const actualDepreciation = accumulatedAfter - accumulatedBefore;

        assetDetails.push({
          asset_id: asset.id,
          depreciation_amount: actualDepreciation,
          accumulated_before: accumulatedBefore,
          accumulated_after: accumulatedAfter,
          book_value_before: asset.book_value || (Number(asset.purchase_price) - accumulatedBefore),
          book_value_after: Number(asset.purchase_price) - accumulatedAfter,
        });

        totalDepreciation += actualDepreciation;
      }
    }

    if (assetDetails.length === 0) {
      return NextResponse.json(
        { error: 'No assets require depreciation for this period' },
        { status: 400 }
      );
    }

    // Generate journal entry number
    const year = new Date(postingDate).getFullYear();
    const lastEntryRows = await sql`
      SELECT entry_number FROM journal_entries
      WHERE entry_number LIKE ${`JE-${year}-%`}
      ORDER BY entry_number DESC
      LIMIT 1
    `;
    const lastEntry = (lastEntryRows as any[])[0];
    let nextNumber = 1;
    if (lastEntry?.entry_number) {
      const match = lastEntry.entry_number.match(/JE-\d{4}-(\d+)/);
      if (match) nextNumber = parseInt(match[1], 10) + 1;
    }
    const entryNumber = `JE-${year}-${nextNumber.toString().padStart(4, '0')}`;

    // Get depreciation accounts
    const depExpAcctRows = await sql`SELECT id FROM accounts WHERE code = '6300' LIMIT 1`;
    const accumDepAcctRows = await sql`SELECT id FROM accounts WHERE code = '1500' LIMIT 1`;
    const depExpenseAcct = (depExpAcctRows as any[])[0];
    const accumDepAcct = (accumDepAcctRows as any[])[0];

    if (!depExpenseAcct || !accumDepAcct) {
      return NextResponse.json(
        { error: 'Depreciation accounts not found. Please create accounts with codes 6300 (Depreciation Expense) and 1500 (Accumulated Depreciation)' },
        { status: 400 }
      );
    }

    // Create journal entry
    const jeRows = await sql`
      INSERT INTO journal_entries (
        entry_number, entry_date, description, source_module, status,
        created_by, posted_by, posted_at
      ) VALUES (
        ${entryNumber}, ${postingDate},
        ${`Depreciation for period ${periodStart} to ${periodEnd}`},
        ${'assets'}, ${'posted'}, ${user.id}, ${user.id}, ${new Date().toISOString()}
      )
      RETURNING *
    `;
    const journalEntry = (jeRows as any[])[0];

    // Create journal lines
    await sql`
      INSERT INTO journal_lines (journal_entry_id, line_number, account_id, description, debit, credit, base_debit, base_credit)
      VALUES
        (${journalEntry.id}, ${1}, ${depExpenseAcct.id}, ${'Depreciation Expense'}, ${totalDepreciation}, ${0}, ${totalDepreciation}, ${0}),
        (${journalEntry.id}, ${2}, ${accumDepAcct.id}, ${'Accumulated Depreciation'}, ${0}, ${totalDepreciation}, ${0}, ${totalDepreciation})
    `;

    // Create depreciation posting record
    const postingRows = await sql`
      INSERT INTO depreciation_postings (
        posting_date, period_start, period_end, total_depreciation,
        assets_count, journal_entry_id, notes, posted_by
      ) VALUES (
        ${postingDate}, ${periodStart}, ${periodEnd}, ${totalDepreciation},
        ${assetDetails.length}, ${journalEntry.id}, ${body.notes ?? null}, ${user.id}
      )
      RETURNING *
    `;
    const posting = (postingRows as any[])[0];

    // Create posting details
    try {
      for (const detail of assetDetails) {
        await sql`
          INSERT INTO depreciation_posting_details (
            posting_id, asset_id, depreciation_amount, accumulated_before,
            accumulated_after, book_value_before, book_value_after
          ) VALUES (
            ${posting.id}, ${detail.asset_id}, ${detail.depreciation_amount},
            ${detail.accumulated_before}, ${detail.accumulated_after},
            ${detail.book_value_before}, ${detail.book_value_after}
          )
        `;
      }
    } catch (detailsErr: any) {
      // Rollback
      await sql`DELETE FROM depreciation_postings WHERE id = ${posting.id}`;
      await sql`DELETE FROM journal_entries WHERE id = ${journalEntry.id}`;
      return NextResponse.json({ error: detailsErr.message }, { status: 400 });
    }

    return NextResponse.json({
      data: posting,
      message: `Depreciation posted successfully for ${assetDetails.length} assets. Total: ${totalDepreciation}`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error posting depreciation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

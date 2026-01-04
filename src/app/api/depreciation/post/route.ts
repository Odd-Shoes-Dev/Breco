import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { calculateMonthlyDepreciation } from '@/lib/accounting/assets';

// GET /api/depreciation/preview - Preview next depreciation posting
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Get period from query params or default to current month
    const periodEnd = searchParams.get('period_end') || new Date().toISOString().split('T')[0];
    const periodEndDate = new Date(periodEnd);
    const periodStart = searchParams.get('period_start') || 
      new Date(periodEndDate.getFullYear(), periodEndDate.getMonth(), 1).toISOString().split('T')[0];

    // Check if depreciation already posted for this period
    const { data: existingPosting } = await supabase
      .from('depreciation_postings')
      .select('id, posting_date, total_depreciation')
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .eq('status', 'posted')
      .single();

    if (existingPosting) {
      return NextResponse.json({
        error: 'Depreciation already posted for this period',
        existing_posting: existingPosting,
      }, { status: 400 });
    }

    // Get all active assets
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .eq('status', 'active')
      .lte('depreciation_start_date', periodEnd);

    if (assetsError) {
      return NextResponse.json({ error: assetsError.message }, { status: 400 });
    }

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

    // Calculate depreciation for each asset
    const assetDetails = [];
    let totalDepreciation = 0;

    for (const asset of assets) {
      // Check if asset is fully depreciated
      if (asset.accumulated_depreciation >= (asset.purchase_price - (asset.salvage_value || 0))) {
        continue;
      }

      const monthlyDepreciation = calculateMonthlyDepreciation(asset);
      const monthlyDepreciationNum = monthlyDepreciation.toNumber();
      
      if (monthlyDepreciationNum > 0) {
        const accumulatedBefore = asset.accumulated_depreciation || 0;
        const accumulatedAfter = Math.min(
          accumulatedBefore + monthlyDepreciationNum,
          asset.purchase_price - (asset.salvage_value || 0)
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
          book_value_before: asset.book_value || (asset.purchase_price - accumulatedBefore),
          book_value_after: asset.purchase_price - accumulatedAfter,
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
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
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
    const { data: existingPosting } = await supabase
      .from('depreciation_postings')
      .select('id')
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .eq('status', 'posted')
      .single();

    if (existingPosting) {
      return NextResponse.json(
        { error: 'Depreciation already posted for this period' },
        { status: 400 }
      );
    }

    // Get active assets
    const { data: assets } = await supabase
      .from('assets')
      .select('*')
      .eq('status', 'active')
      .lte('depreciation_start_date', periodEnd);

    if (!assets || assets.length === 0) {
      return NextResponse.json(
        { error: 'No active assets to depreciate' },
        { status: 400 }
      );
    }

    // Calculate depreciation
    const assetDetails = [];
    let totalDepreciation = 0;

    for (const asset of assets) {
      if (asset.accumulated_depreciation >= (asset.purchase_price - (asset.salvage_value || 0))) {
        continue;
      }

      const monthlyDepreciation = calculateMonthlyDepreciation(asset);
      const monthlyDepreciationNum = monthlyDepreciation.toNumber();
      
      if (monthlyDepreciationNum > 0) {
        const accumulatedBefore = asset.accumulated_depreciation || 0;
        const accumulatedAfter = Math.min(
          accumulatedBefore + monthlyDepreciationNum,
          asset.purchase_price - (asset.salvage_value || 0)
        );
        const actualDepreciation = accumulatedAfter - accumulatedBefore;

        assetDetails.push({
          asset_id: asset.id,
          depreciation_amount: actualDepreciation,
          accumulated_before: accumulatedBefore,
          accumulated_after: accumulatedAfter,
          book_value_before: asset.book_value || (asset.purchase_price - accumulatedBefore),
          book_value_after: asset.purchase_price - accumulatedAfter,
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

    // Create journal entry
    const year = new Date(postingDate).getFullYear();
    const { data: lastEntry } = await supabase
      .from('journal_entries')
      .select('entry_number')
      .like('entry_number', `JE-${year}-%`)
      .order('entry_number', { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
    if (lastEntry?.entry_number) {
      const match = lastEntry.entry_number.match(/JE-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const entryNumber = `JE-${year}-${nextNumber.toString().padStart(4, '0')}`;

    // Get depreciation expense and accumulated depreciation accounts
    const { data: depExpenseAcct } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', '6300') // Depreciation Expense
      .single();

    const { data: accumDepAcct } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', '1500') // Accumulated Depreciation
      .single();

    if (!depExpenseAcct || !accumDepAcct) {
      return NextResponse.json(
        { error: 'Depreciation accounts not found. Please create accounts with codes 6300 (Depreciation Expense) and 1500 (Accumulated Depreciation)' },
        { status: 400 }
      );
    }

    // Create journal entry
    const { data: journalEntry, error: jeError } = await supabase
      .from('journal_entries')
      .insert({
        entry_number: entryNumber,
        entry_date: postingDate,
        description: `Depreciation for period ${periodStart} to ${periodEnd}`,
        source_module: 'assets',
        status: 'posted',
        created_by: user.id,
        posted_by: user.id,
        posted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jeError) {
      return NextResponse.json({ error: jeError.message }, { status: 400 });
    }

    // Create journal lines
    await supabase.from('journal_lines').insert([
      {
        journal_entry_id: journalEntry.id,
        line_number: 1,
        account_id: depExpenseAcct.id,
        description: 'Depreciation Expense',
        debit: totalDepreciation,
        credit: 0,
        base_debit: totalDepreciation,
        base_credit: 0,
      },
      {
        journal_entry_id: journalEntry.id,
        line_number: 2,
        account_id: accumDepAcct.id,
        description: 'Accumulated Depreciation',
        debit: 0,
        credit: totalDepreciation,
        base_debit: 0,
        base_credit: totalDepreciation,
      },
    ]);

    // Create depreciation posting record
    const { data: posting, error: postingError } = await supabase
      .from('depreciation_postings')
      .insert({
        posting_date: postingDate,
        period_start: periodStart,
        period_end: periodEnd,
        total_depreciation: totalDepreciation,
        assets_count: assetDetails.length,
        journal_entry_id: journalEntry.id,
        notes: body.notes || null,
        posted_by: user.id,
      })
      .select()
      .single();

    if (postingError) {
      // Rollback journal entry
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      return NextResponse.json({ error: postingError.message }, { status: 400 });
    }

    // Create posting details (trigger will update assets)
    const detailRecords = assetDetails.map(detail => ({
      ...detail,
      posting_id: posting.id,
    }));

    const { error: detailsError } = await supabase
      .from('depreciation_posting_details')
      .insert(detailRecords);

    if (detailsError) {
      // Rollback
      await supabase.from('depreciation_postings').delete().eq('id', posting.id);
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      return NextResponse.json({ error: detailsError.message }, { status: 400 });
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

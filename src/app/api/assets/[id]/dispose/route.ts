import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/assets/[id]/dispose - Dispose/sell fixed asset
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!body.disposal_date || !body.disposal_method) {
      return NextResponse.json(
        { error: 'Missing required fields: disposal_date, disposal_method' },
        { status: 400 }
      );
    }

    // Get asset details
    const { data: asset, error: assetError } = await supabase
      .from('fixed_assets')
      .select('*, account:accounts(*)')
      .eq('id', id)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (asset.status === 'disposed') {
      return NextResponse.json({ error: 'Asset already disposed' }, { status: 400 });
    }

    // Calculate current book value (cost - accumulated depreciation)
    const bookValue = asset.cost - (asset.accumulated_depreciation || 0);
    const disposalAmount = body.disposal_amount || 0;
    const gainLoss = disposalAmount - bookValue;

    // Get accounts needed for disposal
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .in('code', ['1800', '1900', '4500', '5500']); // Cash, Accum Depr, Gain on Sale, Loss on Sale

    const cashAccount = accounts?.find(a => a.code === '1800');
    const accumDeprAccount = accounts?.find(a => a.code === '1900');
    const gainAccount = accounts?.find(a => a.code === '4500');
    const lossAccount = accounts?.find(a => a.code === '5500');

    if (!cashAccount || !accumDeprAccount) {
      return NextResponse.json(
        { error: 'Required accounts not found (1800, 1900)' },
        { status: 400 }
      );
    }

    // Create journal entry for disposal
    const description = `Asset disposal - ${asset.name} (${body.disposal_method})`;
    const { data: journalEntry, error: jeError } = await supabase
      .from('journal_entries')
      .insert({
        entry_date: body.disposal_date,
        description,
        reference_type: 'asset_disposal',
        reference_id: id,
        created_by: user.id,
      })
      .select()
      .single();

    if (jeError) {
      return NextResponse.json({ error: jeError.message }, { status: 400 });
    }

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
      account_id: asset.account_id,
      debit: 0,
      credit: asset.cost,
      description: 'Remove asset from books',
    });

    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(lines);

    if (linesError) {
      // Rollback journal entry
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      return NextResponse.json({ error: linesError.message }, { status: 400 });
    }

    // Update asset status
    const { data: updatedAsset, error: updateError } = await supabase
      .from('fixed_assets')
      .update({
        status: 'disposed',
        disposal_date: body.disposal_date,
        disposal_method: body.disposal_method,
        disposal_amount: disposalAmount,
        disposal_journal_entry_id: journalEntry.id,
        disposal_notes: body.disposal_notes,
      })
      .eq('id', id)
      .select('*, account:accounts(*)')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      asset: updatedAsset,
      disposal_summary: {
        original_cost: asset.cost,
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

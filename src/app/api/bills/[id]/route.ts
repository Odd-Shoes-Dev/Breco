import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { increaseInventoryForBill } from '@/lib/accounting/inventory-server';
import { createBillJournalEntry } from '@/lib/accounting/journal-entry-helpers';

// GET /api/bills/[id] - Get single bill
export async function GET(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('bills')
      .select(`
        *,
        vendors (id, name, company_name, email, phone, address_line1, address_line2, city, state, zip_code, country)
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/bills/[id] - Update bill
export async function PATCH(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Get existing bill with lines
    const { data: existing, error: fetchError } = await supabase
      .from('bills')
      .select('*, bill_lines(*)')
      .eq('id', params.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const oldStatus = existing.status;

    // Prevent editing paid/void bills
    if (['paid', 'void'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Cannot edit paid or voided bills' },
        { status: 400 }
      );
    }

    // Get current user for journal entries
    const { data: { user } } = await supabase.auth.getUser();

    // Get account IDs from codes if needed
    const lines = body.line_items || body.lines || [];
    const accountCodes = lines
      .map((line: any) => line.account_code)
      .filter((code: any) => code);
    
    let accountMap: Record<string, string> = {};
    if (accountCodes.length > 0) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, code')
        .in('code', accountCodes);
      
      if (accounts) {
        accountMap = Object.fromEntries(
          accounts.map((acc: any) => [acc.code, acc.id])
        );
      }
    }

    // Calculate new totals
    let subtotal = 0;
    let taxAmount = 0;

    lines.forEach((line: any) => {
      const unitCost = line.unit_cost || line.unit_price || 0;
      const lineSubtotal = line.quantity * unitCost;
      const lineTax = lineSubtotal * (line.tax_rate || 0);
      subtotal += lineSubtotal;
      taxAmount += lineTax;
    });

    const total = subtotal + taxAmount;

    // Update bill
    const updateData: any = {
      subtotal,
      tax_amount: taxAmount,
      total,
    };

    const allowedFields = [
      'vendor_id', 'bill_date', 'due_date', 'vendor_invoice_number', 'notes', 'status'
    ];

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    const { data: bill, error: updateError } = await supabase
      .from('bills')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const newStatus = bill.status;

    // Handle inventory when bill is approved/posted
    if ((newStatus === 'approved' || newStatus === 'posted') && oldStatus === 'draft' && user) {
      const billLinesToProcess = lines.length > 0 ? lines : existing.bill_lines;
      
      const inventoryResult = await increaseInventoryForBill(
        supabase,
        bill.id,
        bill.bill_date,
        billLinesToProcess.map((line: any) => ({
          product_id: line.product_id,
          quantity: line.quantity,
          unit_cost: line.unit_cost || line.unit_price || 0,
          line_total: line.line_total || (line.quantity * (line.unit_cost || line.unit_price || 0)),
          description: line.description,
        })),
        user.id
      );

      if (!inventoryResult.success) {
        console.error('Failed to update inventory for bill:', inventoryResult.error);
        // Don't fail bill update for inventory errors, just log
      }
    }

    // Create journal entry when bill is marked as 'approved' or 'posted'
    if ((newStatus === 'approved' || newStatus === 'posted') && oldStatus !== 'approved' && 
        oldStatus !== 'posted' && !bill.journal_entry_id && user) {
      // Get bill lines for journal entry
      const { data: billLines } = await supabase
        .from('bill_lines')
        .select('*, accounts(code)')
        .eq('bill_id', params.id);

      if (billLines && billLines.length > 0) {
        // Calculate bill total from lines to ensure it's a number
        let billTotalFromLines = 0;
        billLines.forEach((line: any) => {
          billTotalFromLines += parseFloat(line.line_total || 0) + parseFloat(line.tax_amount || 0);
        });

        const journalBillLines = billLines.map((line: any) => ({
          account_code: line.accounts?.code || '5000',
          amount: parseFloat(line.line_total || 0) + parseFloat(line.tax_amount || 0),
          description: line.description,
        }));

        // Use the calculated total from lines to ensure accuracy
        const billTotal = billTotalFromLines;

        const journalResult = await createBillJournalEntry(
          supabase,
          {
            id: bill.id,
            bill_number: bill.bill_number,
            bill_date: bill.bill_date,
            total: billTotal,
          },
          journalBillLines,
          user.id
        );

        if (!journalResult.success) {
          console.error('Failed to create journal entry for bill:', journalResult.error);
          return NextResponse.json(
            { error: `Bill updated but journal entry failed: ${journalResult.error}` },
            { status: 500 }
          );
        }

        if (journalResult.journalEntry) {
          await supabase
            .from('bills')
            .update({ journal_entry_id: journalResult.journalEntry.id })
            .eq('id', params.id);
        }
      }
    }

    // If lines are provided, update them
    if (lines.length > 0) {
      // Delete existing lines
      await supabase.from('bill_lines').delete().eq('bill_id', params.id);

      // Create new lines
      const billLines = lines
        .filter((line: any) => {
          const unitCost = line.unit_cost || line.unit_price || 0;
          const hasDescription = line.description && line.description.trim();
          return hasDescription && (line.quantity * unitCost) > 0;
        })
        .map((line: any, index: number) => {
          const unitCost = line.unit_cost || line.unit_price || 0;
          const expenseAccountId = line.expense_account_id || (line.account_code ? accountMap[line.account_code] : null);
          return {
            bill_id: bill.id,
            line_number: index + 1,
            expense_account_id: expenseAccountId,
            product_id: line.product_id || null,
            project_id: line.project_id || null,
            department: line.department || null,
            description: line.description || '',
            quantity: line.quantity,
            unit_cost: unitCost,
            tax_rate: line.tax_rate || 0,
            tax_amount: line.quantity * unitCost * (line.tax_rate || 0),
            line_total: line.quantity * unitCost,
          };
        });

      if (billLines.length > 0) {
        const { error: linesError } = await supabase
          .from('bill_lines')
          .insert(billLines);

        if (linesError) {
          return NextResponse.json({ error: linesError.message }, { status: 400 });
        }
      }
    }

    return NextResponse.json({ data: bill });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bills/[id] - Delete or void bill
export async function DELETE(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'void';

    // Get existing bill
    const { data: existing, error: fetchError } = await supabase
      .from('bills')
      .select('status, amount_paid')
      .eq('id', params.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    if (existing.status === 'void') {
      return NextResponse.json({ error: 'Bill is already voided' }, { status: 400 });
    }

    if (action === 'delete') {
      // Only allow delete for drafts with no payments
      if (existing.status !== 'draft' || existing.amount_paid > 0) {
        return NextResponse.json(
          { error: 'Can only delete draft bills with no payments' },
          { status: 400 }
        );
      }

      // Delete lines first
      await supabase.from('bill_lines').delete().eq('bill_id', params.id);
      
      // Delete bill
      const { error } = await supabase.from('bills').delete().eq('id', params.id);
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ message: 'Bill deleted' });
    } else {
      // Void the bill
      const { data, error } = await supabase
        .from('bills')
        .update({ status: 'void' })
        .eq('id', params.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ data });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

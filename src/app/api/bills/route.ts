import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createBillJournalEntry } from '@/lib/accounting/journal-entry-helpers';
import { increaseInventoryForBill } from '@/lib/accounting/inventory-server';

// GET /api/bills - List bills
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status');
    const vendorId = searchParams.get('vendor_id');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('bills')
      .select(
        `
        *,
        vendors (id, name, company_name)
      `,
        { count: 'exact' }
      )
      .order('bill_date', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    if (search) {
      query = query.ilike('bill_number', `%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bills - Create bill
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    if (!body.vendor_id || !body.bill_date || !body.due_date) {
      return NextResponse.json(
        { error: 'Missing required fields: vendor_id, bill_date, due_date' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate bill number
    const { data: billNumber, error: numError } = await supabase.rpc('generate_bill_number');
    if (numError) {
      return NextResponse.json({ error: 'Failed to generate bill number' }, { status: 500 });
    }

    // Get AP account
    const { data: apAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', '2000')
      .single();

    // Calculate totals
    const lines = body.line_items || body.lines || [];
    let subtotal = 0;
    let taxAmount = 0;

    // Get account IDs from codes if needed
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

    lines.forEach((line: any) => {
      const unitCost = parseFloat(line.unit_cost || line.unit_price || 0);
      const quantity = parseFloat(line.quantity || 0);
      const taxRate = parseFloat(line.tax_rate || 0);
      const lineSubtotal = quantity * unitCost;
      const lineTax = lineSubtotal * taxRate;
      subtotal += lineSubtotal;
      taxAmount += lineTax;
    });

    const total = subtotal + taxAmount;

    console.log('Bill creation totals:', { subtotal, taxAmount, total, linesCount: lines.length });

    const { data: bill, error: billError } = await supabase
      .from('bills')
      .insert({
        bill_number: billNumber,
        vendor_id: body.vendor_id,
        bill_date: body.bill_date,
        due_date: body.due_date,
        vendor_invoice_number: body.vendor_invoice_number || null,
        notes: body.notes || null,
        subtotal,
        tax_amount: taxAmount,
        total,
        amount_paid: 0,
        status: body.status || 'draft',
        currency: body.currency || 'USD',
        exchange_rate: body.exchange_rate || 1,
        payment_terms: body.payment_terms || 30,
        ap_account_id: apAccount?.id,
        created_by: user.id,
      })
      .select()
      .single();

    if (billError) {
      return NextResponse.json({ error: billError.message }, { status: 400 });
    }

    // Create bill lines
    if (lines.length > 0) {
      const billLines = lines
        .filter((line: any) => {
          const unitCost = parseFloat(line.unit_cost || line.unit_price || 0);
          const quantity = parseFloat(line.quantity || 0);
          const hasDescription = line.description && line.description.trim();
          return hasDescription && (quantity * unitCost) > 0;
        })
        .map((line: any, index: number) => {
          const unitCost = parseFloat(line.unit_cost || line.unit_price || 0);
          const quantity = parseFloat(line.quantity || 0);
          const taxRate = parseFloat(line.tax_rate || 0);
          const expenseAccountId = line.expense_account_id || (line.account_code ? accountMap[line.account_code] : null);
          return {
            bill_id: bill.id,
            line_number: index + 1,
            expense_account_id: expenseAccountId,
            product_id: line.product_id || null,
            project_id: line.project_id || null,
            department: line.department || null,
            description: line.description || '',
            quantity: quantity,
            unit_cost: unitCost,
            tax_rate: taxRate,
            tax_amount: quantity * unitCost * taxRate,
            line_total: quantity * unitCost,
          };
        });

      const { error: linesError } = await supabase
        .from('bill_lines')
        .insert(billLines);

      if (linesError) {
        await supabase.from('bills').delete().eq('id', bill.id);
        return NextResponse.json({ error: linesError.message }, { status: 400 });
      }

      // Create journal entry and update inventory for the bill
      if (bill.status === 'posted' || bill.status === 'approved') {
        // Update inventory for posted/approved bills
        const inventoryResult = await increaseInventoryForBill(
          supabase,
          bill.id,
          bill.bill_date,
          billLines.map((line: any) => ({
            product_id: line.product_id,
            quantity: line.quantity,
            unit_cost: line.unit_cost,
            line_total: line.line_total,
            description: line.description,
          })),
          user.id
        );

        if (!inventoryResult.success) {
          console.error('Failed to update inventory for bill:', inventoryResult.error);
          // Don't fail bill creation for inventory errors, just log
        }

        // Prepare bill lines for journal entry
        const journalBillLines = billLines.map((line: any) => {
          // Get account code from the line
          const accountCode = Object.keys(accountMap).find(
            key => accountMap[key] === line.expense_account_id
          ) || '5000'; // Default to general expense
          
          return {
            account_code: accountCode,
            amount: line.line_total + line.tax_amount,
            description: line.description,
          };
        });

        const journalResult = await createBillJournalEntry(
          supabase,
          {
            id: bill.id,
            bill_number: bill.bill_number,
            bill_date: bill.bill_date,
            total: bill.total,
          },
          journalBillLines,
          user.id
        );

        if (!journalResult.success) {
          console.error('Failed to create journal entry for bill:', journalResult.error);
          // Don't fail the bill creation, just log the error
        }
      }
    }

    return NextResponse.json({ data: bill }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

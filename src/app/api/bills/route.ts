import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { createBillJournalEntry } from '@/lib/accounting/journal-entry-helpers';
import { increaseInventoryForBill } from '@/lib/accounting/inventory-server';

// GET /api/bills - List bills
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const vendorId = searchParams.get('vendor_id');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    if (status && status !== 'all') conditions.push(`b.status = '${status.replace(/'/g, "''")}'`);
    if (vendorId) conditions.push(`b.vendor_id = '${vendorId.replace(/'/g, "''")}'`);
    if (search) conditions.push(`b.bill_number ILIKE '%${search.replace(/'/g, "''").replace(/%/g, '\\%')}%'`);
    const where = conditions.join(' AND ');

    const countRows = await sql`
      SELECT COUNT(*) as count FROM bills b WHERE ${sql.unsafe(where)}
    `;
    const count = parseInt(countRows[0].count);

    const rows = await sql`
      SELECT
        b.*,
        json_build_object('id', v.id, 'name', v.name, 'company_name', v.company_name) AS vendors
      FROM bills b
      LEFT JOIN vendors v ON v.id = b.vendor_id
      WHERE ${sql.unsafe(where)}
      ORDER BY b.bill_date DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bills - Create bill
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.vendor_id || !body.bill_date || !body.due_date) {
      return NextResponse.json(
        { error: 'Missing required fields: vendor_id, bill_date, due_date' },
        { status: 400 }
      );
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate bill number
    const billNumberRows = await sql`SELECT generate_bill_number() AS bill_number`;
    const billNumber = billNumberRows[0]?.bill_number;
    if (!billNumber) {
      return NextResponse.json({ error: 'Failed to generate bill number' }, { status: 500 });
    }

    // Get AP account
    const apAccounts = await sql`SELECT id FROM accounts WHERE code = '2000'`;
    const apAccount = apAccounts[0];

    // Calculate totals
    const lines = body.line_items || body.lines || [];
    let subtotal = 0;
    let taxAmount = 0;

    // Get account IDs from codes if needed
    const accountCodes = lines.map((line: any) => line.account_code).filter((code: any) => code);
    let accountMap: Record<string, string> = {};
    if (accountCodes.length > 0) {
      const accounts = await sql`SELECT id, code FROM accounts WHERE code = ANY(${accountCodes})`;
      if (accounts) {
        accountMap = Object.fromEntries(accounts.map((acc: any) => [acc.code, acc.id]));
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

    const billRows = await sql`
      INSERT INTO bills (
        bill_number, vendor_id, bill_date, due_date, vendor_invoice_number,
        notes, subtotal, tax_amount, total, amount_paid, status, currency,
        exchange_rate, payment_terms, ap_account_id, created_by
      ) VALUES (
        ${billNumber},
        ${body.vendor_id},
        ${body.bill_date},
        ${body.due_date},
        ${body.vendor_invoice_number || null},
        ${body.notes || null},
        ${subtotal},
        ${taxAmount},
        ${total},
        0,
        ${body.status || 'draft'},
        ${body.currency || 'USD'},
        ${body.exchange_rate || 1},
        ${body.payment_terms || 30},
        ${apAccount?.id},
        ${user.id}
      )
      RETURNING *
    `;

    const bill = billRows[0];

    // Create bill lines
    if (lines.length > 0) {
      const billLines = lines
        .filter((line: any) => {
          const unitCost = parseFloat(line.unit_cost || line.unit_price || 0);
          const quantity = parseFloat(line.quantity || 0);
          const hasDescription = line.description && line.description.trim();
          return hasDescription && quantity * unitCost > 0;
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
            quantity,
            unit_cost: unitCost,
            tax_rate: taxRate,
            tax_amount: quantity * unitCost * taxRate,
            line_total: quantity * unitCost,
          };
        });

      try {
        for (const line of billLines) {
          await sql`
            INSERT INTO bill_lines (
              bill_id, line_number, expense_account_id, product_id, project_id,
              department, description, quantity, unit_cost, tax_rate, tax_amount, line_total
            ) VALUES (
              ${line.bill_id}, ${line.line_number}, ${line.expense_account_id},
              ${line.product_id}, ${line.project_id}, ${line.department},
              ${line.description}, ${line.quantity}, ${line.unit_cost},
              ${line.tax_rate}, ${line.tax_amount}, ${line.line_total}
            )
          `;
        }
      } catch (linesError: any) {
        await sql`DELETE FROM bills WHERE id = ${bill.id}`;
        return NextResponse.json({ error: linesError.message }, { status: 400 });
      }

      // Create journal entry and update inventory for the bill
      if (bill.status === 'posted' || bill.status === 'approved') {
        const inventoryResult = await increaseInventoryForBill(
          null as any, // inventory-server needs to be updated separately
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
        }

        const journalBillLines = billLines.map((line: any) => {
          const accountCode =
            Object.keys(accountMap).find((key) => accountMap[key] === line.expense_account_id) || '5000';
          return {
            account_code: accountCode,
            amount: line.line_total + line.tax_amount,
            description: line.description,
          };
        });

        const journalResult = await createBillJournalEntry(
          null as any,
          { id: bill.id, bill_number: bill.bill_number, bill_date: bill.bill_date, total: bill.total },
          journalBillLines,
          user.id
        );

        if (!journalResult.success) {
          console.error('Failed to create journal entry for bill:', journalResult.error);
        }
      }
    }

    return NextResponse.json({ data: bill }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

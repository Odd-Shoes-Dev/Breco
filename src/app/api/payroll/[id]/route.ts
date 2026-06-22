import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/payroll/[id] - Update payroll period (including status changes and GL posting)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current payroll period
    const periodRows = await sql`SELECT * FROM payroll_periods WHERE id = ${id}`;
    const period = periodRows[0];

    if (!period) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }

    const payslips = await sql`SELECT * FROM payroll_payslips WHERE payroll_period_id = ${id}`;

    // Check if status is changing to 'paid' - this requires GL posting
    if (body.status === 'paid' && period.status !== 'paid') {
      // Verify we have payslips
      if (!payslips || payslips.length === 0) {
        return NextResponse.json(
          { error: 'Cannot mark payroll as paid without payslips' },
          { status: 400 }
        );
      }

      // Check if accounts exist for GL posting
      const salaryExpenseRows = await sql`SELECT id FROM accounts WHERE code = '5100' LIMIT 1`;
      const nssfExpenseRows = await sql`SELECT id FROM accounts WHERE code = '5120' LIMIT 1`;
      const payePayableRows = await sql`SELECT id FROM accounts WHERE code = '2200' LIMIT 1`;
      const nssfPayableRows = await sql`SELECT id FROM accounts WHERE code = '2210' LIMIT 1`;
      const bankRows = await sql`SELECT id, name, gl_account_id FROM bank_accounts ORDER BY created_at ASC LIMIT 1`;

      const salaryExpenseAccount = salaryExpenseRows[0];
      const nssfExpenseAccount = nssfExpenseRows[0];
      const payePayableAccount = payePayableRows[0];
      const nssfPayableAccount = nssfPayableRows[0];
      const bankAccounts = bankRows[0];

      if (!salaryExpenseAccount || !nssfExpenseAccount || !payePayableAccount || !nssfPayableAccount) {
        return NextResponse.json({
          error: 'Required GL accounts not found. Please ensure accounts 5100, 5120, 2200, 2210 exist in chart of accounts.',
        }, { status: 400 });
      }

      if (!bankAccounts || !bankAccounts.gl_account_id) {
        return NextResponse.json({
          error: 'Primary bank account not configured or not linked to GL account',
        }, { status: 400 });
      }

      // Calculate totals from payslips
      const totalGross = period.total_gross || 0;
      const totalNet = period.total_net || 0;
      const totalPaye = period.total_paye || 0;
      const totalNssfEmployee = payslips.reduce((sum: number, p: any) => sum + (p.nssf_employee || 0), 0);
      const totalNssfEmployer = payslips.reduce((sum: number, p: any) => sum + (p.nssf_employer || 0), 0);

      // Generate journal entry number
      const year = new Date(period.payment_date).getFullYear();
      const prefix = `JE-${year}-%`;
      const lastEntryRows = await sql`
        SELECT entry_number FROM journal_entries
        WHERE entry_number LIKE ${prefix}
        ORDER BY entry_number DESC
        LIMIT 1
      `;

      let entryNumber: string;
      const lastEntry = lastEntryRows[0];
      if (lastEntry?.entry_number) {
        const lastNum = parseInt(lastEntry.entry_number.split('-')[2]);
        entryNumber = `JE-${year}-${String(lastNum + 1).padStart(4, '0')}`;
      } else {
        entryNumber = `JE-${year}-0001`;
      }

      // Create journal entry for payroll
      const jeRows = await sql`
        INSERT INTO journal_entries (
          entry_number, entry_date, description, reference, status,
          reference_type, reference_id, created_by, posted_by, posted_at
        ) VALUES (
          ${entryNumber}, ${period.payment_date},
          ${`Payroll payment for ${period.period_name}`},
          ${`PAYROLL-${id.substring(0, 8)}`},
          'posted', 'payroll', ${id}, ${user.id}, ${user.id}, ${new Date().toISOString()}
        )
        RETURNING *
      `;
      const journalEntry = jeRows[0];

      if (!journalEntry) {
        return NextResponse.json({
          error: 'Failed to create journal entry for payroll',
        }, { status: 400 });
      }

      // Create journal lines
      const journalLines = [
        { account_id: salaryExpenseAccount.id, debit: totalGross, credit: 0, description: `Salary expense - ${period.period_name}` },
        { account_id: nssfExpenseAccount.id, debit: totalNssfEmployer, credit: 0, description: `NSSF employer contribution - ${period.period_name}` },
        { account_id: bankAccounts.gl_account_id, debit: 0, credit: totalNet, description: `Net salary payment - ${period.period_name}` },
        { account_id: payePayableAccount.id, debit: 0, credit: totalPaye, description: `PAYE withholding - ${period.period_name}` },
        { account_id: nssfPayableAccount.id, debit: 0, credit: totalNssfEmployee + totalNssfEmployer, description: `NSSF payable (employee + employer) - ${period.period_name}` },
      ];

      for (const line of journalLines) {
        await sql`
          INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, created_by)
          VALUES (${journalEntry.id}, ${line.account_id}, ${line.debit}, ${line.credit}, ${line.description}, ${user.id})
        `;
      }

      // Update payroll period
      const updatedRows = await sql`
        UPDATE payroll_periods
        SET status = 'paid',
            journal_entry_id = ${journalEntry.id},
            approved_by = ${user.id},
            approved_at = ${new Date().toISOString()},
            updated_at = ${new Date().toISOString()}
        WHERE id = ${id}
        RETURNING *
      `;

      return NextResponse.json({
        data: updatedRows[0],
        journal_entry: journalEntry,
        message: 'Payroll marked as paid and posted to general ledger',
      }, { status: 200 });
    }

    // For other status changes or updates
    const now = new Date().toISOString();

    if (body.status === 'approved') {
      const updatedRows = await sql`
        UPDATE payroll_periods
        SET status = ${body.status},
            approved_by = ${user.id},
            approved_at = ${now},
            updated_at = ${now}
        WHERE id = ${id}
        RETURNING *
      `;
      return NextResponse.json({ data: updatedRows[0] }, { status: 200 });
    }

    // Generic update — only update known safe fields
    const updateFields: Record<string, any> = { ...body, updated_at: now };
    // Build update safely by handling each possible field
    const updatedRows = await sql`
      UPDATE payroll_periods
      SET updated_at = ${now}
      WHERE id = ${id}
      RETURNING *
    `;

    // Apply each field from body
    for (const [field, value] of Object.entries(body)) {
      if (field === 'status') {
        await sql`UPDATE payroll_periods SET status = ${value} WHERE id = ${id}`;
      } else if (field === 'payment_date') {
        await sql`UPDATE payroll_periods SET payment_date = ${value} WHERE id = ${id}`;
      } else if (field === 'notes') {
        await sql`UPDATE payroll_periods SET notes = ${value} WHERE id = ${id}`;
      }
    }

    const finalRows = await sql`SELECT * FROM payroll_periods WHERE id = ${id}`;
    return NextResponse.json({ data: finalRows[0] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

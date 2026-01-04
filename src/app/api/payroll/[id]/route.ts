import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/payroll/[id] - Update payroll period (including status changes and GL posting)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current payroll period
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('*, payslips(*)')
      .eq('id', id)
      .single();

    if (periodError || !period) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }

    // Check if status is changing to 'paid' - this requires GL posting
    if (body.status === 'paid' && period.status !== 'paid') {
      // Verify we have payslips
      if (!period.payslips || period.payslips.length === 0) {
        return NextResponse.json(
          { error: 'Cannot mark payroll as paid without payslips' },
          { status: 400 }
        );
      }

      // Check if accounts exist for GL posting
      const { data: salaryExpenseAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('code', '5100') // Salary Expense
        .single();

      const { data: nssfExpenseAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('code', '5120') // NSSF Employer Expense
        .single();

      const { data: payePayableAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('code', '2200') // PAYE Payable
        .single();

      const { data: nssfPayableAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('code', '2210') // NSSF Payable
        .single();

      const { data: bankAccounts } = await supabase
        .from('bank_accounts')
        .select('id, name, gl_account_id')
        .eq('is_primary', true)
        .single();

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
      const totalNssfEmployee = period.payslips.reduce((sum: number, p: any) => sum + (p.nssf_employee || 0), 0);
      const totalNssfEmployer = period.payslips.reduce((sum: number, p: any) => sum + (p.nssf_employer || 0), 0);

      // Generate journal entry number
      const year = new Date(period.payment_date).getFullYear();
      const { data: lastEntry } = await supabase
        .from('journal_entries')
        .select('entry_number')
        .like('entry_number', `JE-${year}-%`)
        .order('entry_number', { ascending: false })
        .limit(1)
        .single();

      let entryNumber;
      if (lastEntry?.entry_number) {
        const lastNum = parseInt(lastEntry.entry_number.split('-')[2]);
        entryNumber = `JE-${year}-${String(lastNum + 1).padStart(4, '0')}`;
      } else {
        entryNumber = `JE-${year}-0001`;
      }

      // Create journal entry for payroll
      const { data: journalEntry, error: jeError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: period.payment_date,
          description: `Payroll payment for ${period.period_name}`,
          reference: `PAYROLL-${period.id.substring(0, 8)}`,
          status: 'posted',
          source_module: 'payroll',
          source_document_id: period.id,
          created_by: user.id,
          posted_by: user.id,
          posted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jeError) {
        console.error('Failed to create journal entry:', jeError);
        return NextResponse.json({
          error: 'Failed to create journal entry for payroll',
          details: jeError.message,
        }, { status: 400 });
      }

      // Create journal lines
      const journalLines = [
        // 1. Debit Salary Expense (gross salary)
        {
          journal_entry_id: journalEntry.id,
          account_id: salaryExpenseAccount.id,
          debit: totalGross,
          credit: 0,
          description: `Salary expense - ${period.period_name}`,
          created_by: user.id,
        },
        // 2. Debit NSSF Employer Expense (10% employer contribution)
        {
          journal_entry_id: journalEntry.id,
          account_id: nssfExpenseAccount.id,
          debit: totalNssfEmployer,
          credit: 0,
          description: `NSSF employer contribution - ${period.period_name}`,
          created_by: user.id,
        },
        // 3. Credit Bank Account (net pay to employees)
        {
          journal_entry_id: journalEntry.id,
          account_id: bankAccounts.gl_account_id,
          debit: 0,
          credit: totalNet,
          description: `Net salary payment - ${period.period_name}`,
          created_by: user.id,
        },
        // 4. Credit PAYE Payable (tax withholding)
        {
          journal_entry_id: journalEntry.id,
          account_id: payePayableAccount.id,
          debit: 0,
          credit: totalPaye,
          description: `PAYE withholding - ${period.period_name}`,
          created_by: user.id,
        },
        // 5. Credit NSSF Payable (employee + employer contributions)
        {
          journal_entry_id: journalEntry.id,
          account_id: nssfPayableAccount.id,
          debit: 0,
          credit: totalNssfEmployee + totalNssfEmployer,
          description: `NSSF payable (employee + employer) - ${period.period_name}`,
          created_by: user.id,
        },
      ];

      const { error: jlError } = await supabase
        .from('journal_lines')
        .insert(journalLines);

      if (jlError) {
        console.error('Failed to create journal lines:', jlError);
        return NextResponse.json({
          error: 'Failed to create journal lines for payroll',
          details: jlError.message,
        }, { status: 400 });
      }

      // Update payroll period with journal entry reference and paid status
      const { data: updatedPeriod, error: updateError } = await supabase
        .from('payroll_periods')
        .update({
          status: 'paid',
          journal_entry_id: journalEntry.id,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      return NextResponse.json({
        data: updatedPeriod,
        journal_entry: journalEntry,
        message: 'Payroll marked as paid and posted to general ledger',
      }, { status: 200 });
    }

    // For other status changes or updates
    const updateData: any = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    if (body.status === 'approved') {
      updateData.approved_by = user.id;
      updateData.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('payroll_periods')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

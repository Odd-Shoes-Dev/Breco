import { createClient } from '@/lib/supabase/server';
import { createJournalEntry } from '@/lib/accounting/journal-entry-helpers';
import { NextResponse } from 'next/server';

// POST /api/payroll/periods/[id]/process - Process payroll (create journal entries)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: periodId } = await params;

    // Check period exists and is draft
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select(`
        *,
        payslips:payroll_payslips(*)
      `)
      .eq('id', periodId)
      .single();

    if (periodError) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }

    if (period.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only process draft payroll periods' },
        { status: 400 }
      );
    }

    if (!period.payslips || period.payslips.length === 0) {
      return NextResponse.json(
        { error: 'No payslips found. Generate payslips first.' },
        { status: 400 }
      );
    }

    // Calculate totals
    const totalGross = period.payslips.reduce((sum: number, p: any) => sum + (p.gross_salary || 0), 0);
    const totalTax = period.payslips.reduce((sum: number, p: any) => sum + (p.tax_deduction || 0), 0);
    const totalNHIF = period.payslips.reduce((sum: number, p: any) => sum + (p.nhif_deduction || 0), 0);
    const totalNSSF = period.payslips.reduce((sum: number, p: any) => sum + (p.nssf_deduction || 0), 0);
    const totalNet = period.payslips.reduce((sum: number, p: any) => sum + (p.net_salary || 0), 0);

    // Get account IDs for journal entry
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code')
      .in('code', ['6100', '2300', '2310', '2320', '2330']);

    const accountMap = new Map(accounts?.map((a: any) => [a.code, a.id]));

    const salaryExpenseId = accountMap.get('6100'); // Salary & Wages Expense
    const payrollPayableId = accountMap.get('2300'); // Payroll Payable
    const taxPayableId = accountMap.get('2310'); // Tax Payable
    const nhifPayableId = accountMap.get('2320'); // NHIF Payable
    const nssfPayableId = accountMap.get('2330'); // NSSF Payable

    if (!salaryExpenseId || !payrollPayableId || !taxPayableId || !nhifPayableId || !nssfPayableId) {
      return NextResponse.json(
        { error: 'Required payroll accounts not found. Please set up accounts with codes: 6100, 2300, 2310, 2320, 2330' },
        { status: 400 }
      );
    }

    // Create journal entry
    // Debit: Salary Expense (total gross)
    // Credit: Payroll Payable (net pay)
    // Credit: Tax Payable (tax deductions)
    // Credit: NHIF Payable (NHIF deductions)
    // Credit: NSSF Payable (NSSF deductions)

    const lines = [
      {
        account_id: salaryExpenseId,
        debit: totalGross,
        credit: 0,
        description: `Payroll expense for period ${period.period_start} to ${period.period_end}`,
      },
      {
        account_id: payrollPayableId,
        debit: 0,
        credit: totalNet,
        description: `Net payroll payable for period ${period.period_start} to ${period.period_end}`,
      },
    ];

    if (totalTax > 0) {
      lines.push({
        account_id: taxPayableId,
        debit: 0,
        credit: totalTax,
        description: `Tax payable for period ${period.period_start} to ${period.period_end}`,
      });
    }

    if (totalNHIF > 0) {
      lines.push({
        account_id: nhifPayableId,
        debit: 0,
        credit: totalNHIF,
        description: `NHIF payable for period ${period.period_start} to ${period.period_end}`,
      });
    }

    if (totalNSSF > 0) {
      lines.push({
        account_id: nssfPayableId,
        debit: 0,
        credit: totalNSSF,
        description: `NSSF payable for period ${period.period_start} to ${period.period_end}`,
      });
    }

    const journalResult = await createJournalEntry({
      supabase: supabase,
      entry_date: period.payment_date,
      description: `Payroll for period ${period.period_start} to ${period.period_end}`,
      source_module: 'payroll',
      lines,
      created_by: user.id,
    });

    if (!journalResult.success) {
      return NextResponse.json(
        { error: 'Failed to create journal entry', details: journalResult.error },
        { status: 400 }
      );
    }

    // Update period status and journal entry reference
    const { data: updatedPeriod, error: updateError } = await supabase
      .from('payroll_periods')
      .update({
        status: 'processed',
        journal_entry_id: journalResult.journalEntry.id,
        processed_by: user.id,
        processed_at: new Date().toISOString(),
        total_gross: totalGross,
        total_deductions: totalTax + totalNHIF + totalNSSF,
        total_net: totalNet,
      })
      .eq('id', periodId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Update all payslips to processed
    await supabase
      .from('payroll_payslips')
      .update({ status: 'processed' })
      .eq('payroll_period_id', periodId);

    return NextResponse.json({
      message: 'Payroll processed successfully',
      period: updatedPeriod,
      journal_entry_id: journalResult.journalEntry.id,
      totals: {
        gross: totalGross,
        tax: totalTax,
        nhif: totalNHIF,
        nssf: totalNSSF,
        net: totalNet,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

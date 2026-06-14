import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCompanySettings } from '@/lib/company-settings';

export async function GET() {
  try {
    const supabase = await createClient();
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;

    // Fetch all bills with their currencies
    const { data: bills, error } = await supabase
      .from('bills')
      .select('total, amount_paid, due_date, status, currency, bill_date');

    if (error) throw error;

    if (!bills || bills.length === 0) {
      return NextResponse.json({
        totalUnpaid: 0,
        dueThisWeek: 0,
        overdue: 0,
        paidThisMonth: 0,
        currency: baseCurrency,
      });
    }

    const now = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalUnpaid = 0;
    let dueThisWeek = 0;
    let overdue = 0;
    let paidThisMonth = 0;

    for (const bill of bills) {
      const remaining = bill.total - (bill.amount_paid || 0);
      const dueDate = new Date(bill.due_date);
      const billDate = new Date(bill.bill_date);

      let amountInBase = bill.total;
      let remainingInBase = remaining;

      if (bill.currency !== baseCurrency) {
        const { data: convertedTotal } = await supabase.rpc('convert_currency', {
          p_amount: bill.total,
          p_from_currency: bill.currency,
          p_to_currency: baseCurrency,
          p_date: bill.bill_date,
        });

        const { data: convertedRemaining } = await supabase.rpc('convert_currency', {
          p_amount: remaining,
          p_from_currency: bill.currency,
          p_to_currency: baseCurrency,
          p_date: bill.bill_date,
        });

        amountInBase = convertedTotal ?? 0;
        remainingInBase = convertedRemaining ?? 0;
      }

      if (bill.status !== 'paid' && bill.status !== 'void') {
        totalUnpaid += remainingInBase;

        if (dueDate >= now && dueDate <= weekFromNow) {
          dueThisWeek += remainingInBase;
        }

        if (dueDate < now) {
          overdue += remainingInBase;
        }
      }

      if (bill.status === 'paid' && billDate >= startOfMonth) {
        paidThisMonth += amountInBase;
      }
    }

    return NextResponse.json({
      totalUnpaid,
      dueThisWeek,
      overdue,
      paidThisMonth,
      currency: baseCurrency,
    });
  } catch (error: any) {
    console.error('Failed to calculate bill stats:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

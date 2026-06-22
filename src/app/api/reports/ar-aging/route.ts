import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { convertCurrency, SupportedCurrency } from '@/lib/currency';

// GET /api/reports/ar-aging - Accounts Receivable Aging
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const asOfDate = searchParams.get('as_of_date') || new Date().toISOString().split('T')[0];
    const customerId = searchParams.get('customer_id');

    let invoices: any[];

    if (customerId) {
      invoices = await sql`
        SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.total,
          i.amount_paid, i.currency, i.status,
          json_build_object('id', c.id, 'name', c.name, 'email', c.email) AS customers
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.status IN ('sent', 'partial', 'overdue')
          AND i.invoice_date <= ${asOfDate}
          AND i.customer_id = ${customerId}
        ORDER BY i.due_date
      `;
    } else {
      invoices = await sql`
        SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.total,
          i.amount_paid, i.currency, i.status,
          json_build_object('id', c.id, 'name', c.name, 'email', c.email) AS customers
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.status IN ('sent', 'partial', 'overdue')
          AND i.invoice_date <= ${asOfDate}
        ORDER BY i.due_date
      `;
    }

    const today = new Date(asOfDate);

    // Initialize aging buckets
    const aging = {
      current: { count: 0, total: 0, invoices: [] as any[] },
      days1to30: { count: 0, total: 0, invoices: [] as any[] },
      days31to60: { count: 0, total: 0, invoices: [] as any[] },
      days61to90: { count: 0, total: 0, invoices: [] as any[] },
      over90: { count: 0, total: 0, invoices: [] as any[] },
    };

    // Customer summaries
    const customerAging: Record<string, {
      customer: any;
      current: number;
      days1to30: number;
      days31to60: number;
      days61to90: number;
      over90: number;
      total: number;
    }> = {};

    // Process invoices with currency conversion
    for (const invoice of invoices) {
      const balance = invoice.total - invoice.amount_paid;
      if (balance <= 0) continue;

      // Convert balance to USD for reporting
      const balanceUSD = await convertCurrency(
        balance,
        (invoice.currency || 'USD') as SupportedCurrency,
        'USD' as SupportedCurrency
      ) || balance;

      const dueDate = new Date(invoice.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      const invoiceData = {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        total: invoice.total,
        balance: balanceUSD,
        originalBalance: balance,
        currency: invoice.currency || 'USD',
        days_overdue: Math.max(0, daysOverdue),
        customer: invoice.customers,
      };

      // Determine bucket
      let bucket: keyof typeof aging;
      if (daysOverdue <= 0) {
        bucket = 'current';
      } else if (daysOverdue <= 30) {
        bucket = 'days1to30';
      } else if (daysOverdue <= 60) {
        bucket = 'days31to60';
      } else if (daysOverdue <= 90) {
        bucket = 'days61to90';
      } else {
        bucket = 'over90';
      }

      aging[bucket].count++;
      aging[bucket].total += balanceUSD;
      aging[bucket].invoices.push(invoiceData);

      // Update customer summary
      const customer: any = invoice.customers;
      const custId = customer?.id;
      if (custId) {
        if (!customerAging[custId]) {
          customerAging[custId] = {
            customer: customer,
            current: 0,
            days1to30: 0,
            days31to60: 0,
            days61to90: 0,
            over90: 0,
            total: 0,
          };
        }
        customerAging[custId][bucket] += balanceUSD;
        customerAging[custId].total += balanceUSD;
      }
    }

    const totalOutstanding =
      aging.current.total +
      aging.days1to30.total +
      aging.days31to60.total +
      aging.days61to90.total +
      aging.over90.total;

    return NextResponse.json({
      data: {
        asOfDate,
        summary: {
          current: aging.current.total,
          days1to30: aging.days1to30.total,
          days31to60: aging.days31to60.total,
          days61to90: aging.days61to90.total,
          over90: aging.over90.total,
          total: totalOutstanding,
        },
        aging,
        byCustomer: Object.values(customerAging).sort((a, b) => b.total - a.total),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

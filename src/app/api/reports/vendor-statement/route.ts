import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface VendorTransaction {
  id: string;
  date: string;
  type: 'Bill' | 'Payment' | 'Credit' | 'Adjustment';
  reference: string;
  description: string;
  amount: number;
  balance: number;
}

interface VendorData {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
}

interface VendorStatementData {
  vendor: VendorData;
  statementPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    beginningBalance: number;
    totalBills: number;
    totalPayments: number;
    totalCredits: number;
    endingBalance: number;
  };
  transactions: VendorTransaction[];
  aging: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const vendorId = searchParams.get('vendorId');
    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 });
    }

    // Fetch vendor data
    const vendorRows = await sql`
      SELECT id, name, company_name, email, phone, address_line1, address_line2, city, state, zip_code
      FROM vendors WHERE id = ${vendorId}
    `;
    const vendor = vendorRows[0];

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const addressParts = [
      vendor.address_line1,
      vendor.address_line2,
      [vendor.city, vendor.state, vendor.zip_code].filter(Boolean).join(', ')
    ].filter(Boolean);

    const vendorData: VendorData = {
      id: vendor.id,
      name: vendor.company_name || vendor.name,
      address: addressParts.join(', '),
      phone: vendor.phone,
      email: vendor.email
    };

    // Calculate beginning balance
    const beforeBills = await sql`
      SELECT total, amount_paid FROM bills
      WHERE vendor_id = ${vendorId} AND bill_date < ${startDate}
    `;

    const beginningBalance = beforeBills.reduce((sum: number, bill: any) =>
      sum + (parseFloat(bill.total) - parseFloat(bill.amount_paid || '0')), 0
    );

    // Fetch bills in the period
    const bills = await sql`
      SELECT id, bill_number, bill_date, due_date, total, amount_paid, status, notes, vendor_invoice_number
      FROM bills
      WHERE vendor_id = ${vendorId}
        AND bill_date >= ${startDate}
        AND bill_date <= ${endDate}
      ORDER BY bill_date ASC
    `;

    // Build transactions list
    const transactions: VendorTransaction[] = [];

    if (beginningBalance !== 0) {
      transactions.push({
        id: 'beginning-balance',
        date: startDate,
        type: 'Adjustment',
        reference: 'OPENING',
        description: 'Beginning Balance',
        amount: beginningBalance,
        balance: beginningBalance
      });
    }

    bills.forEach((bill: any) => {
      transactions.push({
        id: bill.id,
        date: bill.bill_date,
        type: 'Bill',
        reference: bill.vendor_invoice_number || bill.bill_number,
        description: bill.notes || 'Bill',
        amount: parseFloat(bill.total),
        balance: 0
      });

      const paidAmount = parseFloat(bill.amount_paid || '0');
      if (paidAmount > 0) {
        transactions.push({
          id: `${bill.id}-payment`,
          date: bill.bill_date,
          type: 'Payment',
          reference: `Payment for ${bill.bill_number}`,
          description: 'Payment applied to bill',
          amount: -paidAmount,
          balance: 0
        });
      }
    });

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    transactions.forEach(txn => {
      runningBalance += txn.amount;
      txn.balance = runningBalance;
    });

    const totalBills = bills.reduce((sum: number, bill: any) => sum + parseFloat(bill.total), 0);
    const totalPayments = bills.reduce((sum: number, bill: any) => sum + parseFloat(bill.amount_paid || '0'), 0);
    const endingBalance = runningBalance;

    // Calculate aging
    const unpaidBills = await sql`
      SELECT bill_date, due_date, total, amount_paid FROM bills
      WHERE vendor_id = ${vendorId}
        AND bill_date <= ${endDate}
        AND status != 'paid'
    `;

    const endDateObj = new Date(endDate);
    const aging = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 0
    };

    unpaidBills.forEach((bill: any) => {
      const balance = parseFloat(bill.total) - parseFloat(bill.amount_paid || '0');
      if (balance <= 0) return;

      const dueDate = new Date(bill.due_date);
      const daysOverdue = Math.floor((endDateObj.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        aging.current += balance;
      } else if (daysOverdue <= 30) {
        aging.days1to30 += balance;
      } else if (daysOverdue <= 60) {
        aging.days31to60 += balance;
      } else if (daysOverdue <= 90) {
        aging.days61to90 += balance;
      } else {
        aging.over90 += balance;
      }
    });

    const response: VendorStatementData = {
      vendor: vendorData,
      statementPeriod: {
        startDate,
        endDate
      },
      summary: {
        beginningBalance,
        totalBills,
        totalPayments,
        totalCredits: 0,
        endingBalance
      },
      transactions,
      aging
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Vendor statement report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate vendor statement' },
      { status: 500 }
    );
  }
}

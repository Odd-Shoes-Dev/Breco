import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { convertCurrency, SupportedCurrency } from '@/lib/currency';

interface VendorAging {
  vendorId: string;
  vendorName: string;
  vendorType: 'Supplier' | 'Service Provider' | 'Contractor' | 'Utility';
  totalAmount: number;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  oldestInvoiceDate: string;
  invoiceCount: number;
  averagePaymentDays: number;
  creditLimit: number;
  lastPaymentDate: string;
  paymentTerms: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const reportDate = searchParams.get('reportDate') || new Date().toISOString().split('T')[0];
    const vendorType = searchParams.get('vendorType') || 'all';
    const sortBy = searchParams.get('sortBy') || 'totalAmount';
    const showCriticalOnly = searchParams.get('showCriticalOnly') === 'true';

    // Fetch bills from database
    const bills = await sql`
      SELECT
        b.id, b.bill_number, b.bill_date, b.due_date, b.total,
        b.amount_paid, b.currency, b.status, b.payment_terms,
        json_build_object('id', v.id, 'name', v.name, 'company_name', v.company_name) AS vendor
      FROM bills b
      LEFT JOIN vendors v ON v.id = b.vendor_id
      WHERE b.status IN ('pending_approval', 'approved', 'partial')
      ORDER BY b.vendor_id
    `;

    // Group bills by vendor and calculate aging
    const vendorMap = new Map<string, VendorAging>();
    const reportDateObj = new Date(reportDate);

    // Process bills with currency conversion
    for (const bill of bills) {
      if (!bill.vendor) continue;

      const vendor: any = bill.vendor;
      const vendorId = vendor.id;
      const balance = parseFloat(bill.total) - parseFloat(bill.amount_paid || 0);

      if (balance <= 0) continue; // Skip fully paid bills

      // Convert balance to USD for reporting
      const balanceUSD = await convertCurrency(
        balance,
        (bill.currency || 'USD') as SupportedCurrency,
        'USD' as SupportedCurrency
      ) || balance;

      const dueDate = new Date(bill.due_date);
      const daysOverdue = Math.floor((reportDateObj.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (!vendorMap.has(vendorId)) {
        vendorMap.set(vendorId, {
          vendorId: vendorId,
          vendorName: vendor.company_name || vendor.name,
          vendorType: 'Supplier',
          totalAmount: 0,
          current: 0,
          days1to30: 0,
          days31to60: 0,
          days61to90: 0,
          over90: 0,
          oldestInvoiceDate: bill.bill_date,
          invoiceCount: 0,
          averagePaymentDays: 0,
          creditLimit: 0,
          lastPaymentDate: '',
          paymentTerms: bill.payment_terms || 'Net 30'
        });
      }

      const vendorAging = vendorMap.get(vendorId)!;
      vendorAging.totalAmount += balanceUSD;
      vendorAging.invoiceCount++;

      // Categorize by aging bucket
      if (daysOverdue <= 0) {
        vendorAging.current += balanceUSD;
      } else if (daysOverdue <= 30) {
        vendorAging.days1to30 += balanceUSD;
      } else if (daysOverdue <= 60) {
        vendorAging.days31to60 += balanceUSD;
      } else if (daysOverdue <= 90) {
        vendorAging.days61to90 += balanceUSD;
      } else {
        vendorAging.over90 += balanceUSD;
      }

      // Track oldest invoice
      if (new Date(bill.bill_date) < new Date(vendorAging.oldestInvoiceDate)) {
        vendorAging.oldestInvoiceDate = bill.bill_date;
      }

      // Calculate average payment days (simplified)
      vendorAging.averagePaymentDays = Math.max(vendorAging.averagePaymentDays, daysOverdue);
    }

    let vendors = Array.from(vendorMap.values());

    // Apply vendor type filter
    if (vendorType !== 'all') {
      vendors = vendors.filter(v => v.vendorType === vendorType);
    }

    // Apply critical only filter
    if (showCriticalOnly) {
      vendors = vendors.filter(v => v.over90 > 0 || v.days61to90 > 0);
    }

    // Sort vendors
    vendors.sort((a, b) => {
      switch (sortBy) {
        case 'vendorName':
          return a.vendorName.localeCompare(b.vendorName);
        case 'totalAmount':
          return b.totalAmount - a.totalAmount;
        case 'over90':
          return b.over90 - a.over90;
        case 'daysOverdue':
          return b.averagePaymentDays - a.averagePaymentDays;
        default:
          return b.totalAmount - a.totalAmount;
      }
    });

    // Calculate summary
    const summary = {
      totalVendors: vendors.length,
      totalOutstanding: vendors.reduce((sum, v) => sum + v.totalAmount, 0),
      currentTotal: vendors.reduce((sum, v) => sum + v.current, 0),
      days1to30Total: vendors.reduce((sum, v) => sum + v.days1to30, 0),
      days31to60Total: vendors.reduce((sum, v) => sum + v.days31to60, 0),
      days61to90Total: vendors.reduce((sum, v) => sum + v.days61to90, 0),
      over90Total: vendors.reduce((sum, v) => sum + v.over90, 0),
      criticalVendors: vendors.filter(v => v.over90 > 0 || v.days61to90 > 0).length,
      averageDaysOverdue: vendors.length > 0
        ? vendors.reduce((sum, v) => sum + v.averagePaymentDays, 0) / vendors.length
        : 0,
    };

    // Calculate percentages
    const totalOutstanding = summary.totalOutstanding;
    const agingDistribution = {
      current: totalOutstanding > 0 ? (summary.currentTotal / totalOutstanding) * 100 : 0,
      days1to30: totalOutstanding > 0 ? (summary.days1to30Total / totalOutstanding) * 100 : 0,
      days31to60: totalOutstanding > 0 ? (summary.days31to60Total / totalOutstanding) * 100 : 0,
      days61to90: totalOutstanding > 0 ? (summary.days61to90Total / totalOutstanding) * 100 : 0,
      over90: totalOutstanding > 0 ? (summary.over90Total / totalOutstanding) * 100 : 0,
    };

    const response = {
      reportDate,
      summary,
      agingDistribution,
      vendors,
      vendorTypes: {
        supplier: vendors.filter(v => v.vendorType === 'Supplier').length,
        serviceProvider: vendors.filter(v => v.vendorType === 'Service Provider').length,
        contractor: vendors.filter(v => v.vendorType === 'Contractor').length,
        utility: vendors.filter(v => v.vendorType === 'Utility').length,
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('AP aging report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate AP aging report' },
      { status: 500 }
    );
  }
}

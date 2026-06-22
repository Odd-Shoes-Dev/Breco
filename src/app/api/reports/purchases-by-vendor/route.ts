import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface VendorPurchase {
  vendorId: string;
  vendorName: string;
  vendorType: string;
  totalPurchases: number;
  purchaseCount: number;
  averagePurchase: number;
  firstPurchaseDate: string;
  lastPurchaseDate: string;
  purchaseGrowth: number;
  paymentTerms: string;
  topCategories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

interface PurchasesByVendorData {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalVendors: number;
    totalPurchases: number;
    averagePurchasePerVendor: number;
    topVendorSpend: number;
    topVendorName: string;
    activeVendors: number;
  };
  vendors: VendorPurchase[];
  topVendors: VendorPurchase[];
  vendorTypes: Record<string, {
    count: number;
    spending: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const vendorType = searchParams.get('vendorType') || 'all';
    const sortBy = searchParams.get('sortBy') || 'totalPurchases';
    const minAmount = parseFloat(searchParams.get('minAmount') || '0');

    // Fetch bills with vendor data for the period
    const bills = await sql`
      SELECT b.id, b.vendor_id, b.bill_date, b.total, b.currency, b.payment_terms,
             v.id AS v_id, v.name AS v_name, v.company_name AS v_company_name
      FROM bills b
      LEFT JOIN vendors v ON v.id = b.vendor_id
      WHERE b.bill_date >= ${startDate}
        AND b.bill_date <= ${endDate}
        AND b.status != 'void'
      ORDER BY b.bill_date
    `;

    const billIds = bills.map((bill: any) => bill.id);
    let categoryData: any = {};

    if (billIds.length > 0) {
      const lines = await sql`
        SELECT bill_id, description, line_total
        FROM bill_lines
        WHERE bill_id = ANY(${billIds})
      `;

      lines.forEach((line: any) => {
        if (!categoryData[line.bill_id]) {
          categoryData[line.bill_id] = [];
        }
        categoryData[line.bill_id].push({
          name: line.description || 'Expense',
          amount: parseFloat(line.line_total) || 0
        });
      });
    }

    // Group bills by vendor
    const vendorMap = new Map<string, VendorPurchase>();

    for (const bill of bills) {
      if (!bill.vendor_id) continue;

      const vendorId = bill.vendor_id;
      const vendorName = bill.v_company_name || bill.v_name;
      if (!vendorName) continue;

      const vendorTypeRaw = 'Supplier';
      const paymentTerms = bill.payment_terms || 30;

      if (!vendorMap.has(vendorId)) {
        vendorMap.set(vendorId, {
          vendorId,
          vendorName,
          vendorType: vendorTypeRaw,
          totalPurchases: 0,
          purchaseCount: 0,
          averagePurchase: 0,
          firstPurchaseDate: bill.bill_date,
          lastPurchaseDate: bill.bill_date,
          purchaseGrowth: 0,
          paymentTerms: `Net ${paymentTerms}`,
          topCategories: []
        });
      }

      const vendor = vendorMap.get(vendorId)!;

      const total = parseFloat(bill.total);
      let totalUSD = total;
      const billCurrency = bill.currency || 'USD';
      if (billCurrency !== 'USD') {
        const res = await sql`SELECT convert_currency(${total}, ${billCurrency}, 'USD', ${bill.bill_date}) AS val`;
        totalUSD = res[0]?.val ?? total;
      }

      vendor.totalPurchases += totalUSD;
      vendor.purchaseCount += 1;
      vendor.lastPurchaseDate = bill.bill_date;

      if (new Date(bill.bill_date) < new Date(vendor.firstPurchaseDate)) {
        vendor.firstPurchaseDate = bill.bill_date;
      }

      const billCategories = categoryData[bill.id] || [];
      billCategories.forEach((category: any) => {
        const existingCategory = vendor.topCategories.find((c: any) => c.category === category.name);
        if (existingCategory) {
          existingCategory.amount += category.amount;
        } else {
          vendor.topCategories.push({
            category: category.name,
            amount: category.amount,
            percentage: 0
          });
        }
      });
    }

    let vendors = Array.from(vendorMap.values());
    vendors.forEach(vendor => {
      vendor.averagePurchase = vendor.purchaseCount > 0 ? vendor.totalPurchases / vendor.purchaseCount : 0;

      vendor.topCategories.forEach((cat: any) => {
        cat.percentage = vendor.totalPurchases > 0 ? (cat.amount / vendor.totalPurchases) * 100 : 0;
      });

      vendor.topCategories.sort((a: any, b: any) => b.amount - a.amount);
      vendor.topCategories = vendor.topCategories.slice(0, 5);
    });

    if (vendorType !== 'all') {
      vendors = vendors.filter(v => v.vendorType.toLowerCase() === vendorType.toLowerCase());
    }

    if (minAmount > 0) {
      vendors = vendors.filter(v => v.totalPurchases >= minAmount);
    }

    vendors.sort((a, b) => {
      switch (sortBy) {
        case 'vendorName':
          return a.vendorName.localeCompare(b.vendorName);
        case 'totalPurchases':
          return b.totalPurchases - a.totalPurchases;
        case 'purchaseCount':
          return b.purchaseCount - a.purchaseCount;
        default:
          return b.totalPurchases - a.totalPurchases;
      }
    });

    const totalPurchases = vendors.reduce((sum, v) => sum + v.totalPurchases, 0);
    const totalVendors = vendors.length;
    const averagePurchasePerVendor = totalVendors > 0 ? totalPurchases / totalVendors : 0;

    const topVendor = vendors.length > 0 ? vendors[0] : null;

    const vendorTypes: Record<string, { count: number; spending: number }> = {};
    vendors.forEach(vendor => {
      const type = vendor.vendorType || 'Other';
      if (!vendorTypes[type]) {
        vendorTypes[type] = { count: 0, spending: 0 };
      }
      vendorTypes[type].count += 1;
      vendorTypes[type].spending += vendor.totalPurchases;
    });

    const topVendors = vendors.slice(0, 10);

    const response: PurchasesByVendorData = {
      reportPeriod: {
        startDate,
        endDate
      },
      summary: {
        totalVendors,
        totalPurchases,
        averagePurchasePerVendor,
        topVendorSpend: topVendor ? topVendor.totalPurchases : 0,
        topVendorName: topVendor ? topVendor.vendorName : 'N/A',
        activeVendors: totalVendors
      },
      vendors,
      topVendors,
      vendorTypes
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Purchases by vendor report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate purchases by vendor report' },
      { status: 500 }
    );
  }
}

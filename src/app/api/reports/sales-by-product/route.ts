import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCompanySettings } from '@/lib/company-settings';

interface ProductSale {
  productId: string;
  productName: string;
  category: string;
  unitsSold: number;
  totalRevenue: number;
  averagePrice: number;
  grossMargin: number;
  marginPercentage: number;
  growthRate: number;
  topCustomers: Array<{
    customerName: string;
    quantity: number;
    revenue: number;
  }>;
  salesTrend: Array<{
    month: string;
    sales: number;
  }>;
}

interface CategoryData {
  category: string;
  productCount: number;
  revenue: number;
  unitsSold: number;
  averageMargin: number;
}

interface SalesByProductData {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalProducts: number;
    totalRevenue: number;
    totalUnitsSold: number;
    averageOrderValue: number;
    topProductRevenue: number;
    topProductName: string;
    totalCategories: number;
  };
  products: ProductSale[];
  categories: CategoryData[];
  topPerformers: ProductSale[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category') || 'all';
    const sortBy = searchParams.get('sortBy') || 'totalRevenue';
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Fetch invoice lines with product, category, customer, and invoice data
    const lines = await sql`
      SELECT
        il.product_id, il.description, il.quantity, il.line_total,
        i.invoice_date, i.currency,
        p.name AS product_name, p.purchase_price AS product_cost,
        pc.name AS category_name,
        c.name AS customer_name
      FROM invoice_lines il
      JOIN invoices i ON i.id = il.invoice_id
      LEFT JOIN products p ON p.id = il.product_id
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      LEFT JOIN customers c ON c.id = i.customer_id
      WHERE i.invoice_date >= ${startDate}
        AND i.invoice_date <= ${endDate}
        AND i.status != 'void'
    `;

    // Aggregate by product (fall back to line description when no product is linked)
    const productMap = new Map<string, ProductSale & {
      _cost: number;
      _customers: Map<string, { quantity: number; revenue: number }>;
      _months: Map<string, number>;
    }>();

    for (const line of lines) {
      const key = line.product_id || `desc:${line.description || 'Unspecified'}`;
      const name = line.product_name || line.description || 'Unspecified';
      const quantity = Number(line.quantity) || 0;

      let revenue = Number(line.line_total) || 0;
      const currency = line.currency || baseCurrency;
      if (currency !== baseCurrency && revenue !== 0) {
        try {
          const res = await sql`SELECT convert_currency(${revenue}, ${currency}, ${baseCurrency}, ${line.invoice_date}) AS val`;
          revenue = Number(res[0]?.val ?? revenue);
        } catch {
          // fall back to unconverted amount
        }
      }

      if (!productMap.has(key)) {
        productMap.set(key, {
          productId: line.product_id || key,
          productName: name,
          category: line.category_name || 'Uncategorized',
          unitsSold: 0,
          totalRevenue: 0,
          averagePrice: 0,
          grossMargin: 0,
          marginPercentage: 0,
          growthRate: 0,
          topCustomers: [],
          salesTrend: [],
          _cost: Number(line.product_cost) || 0,
          _customers: new Map(),
          _months: new Map(),
        });
      }

      const product = productMap.get(key)!;
      product.unitsSold += quantity;
      product.totalRevenue += revenue;

      const customerName = line.customer_name || 'Unknown Customer';
      const cust = product._customers.get(customerName) || { quantity: 0, revenue: 0 };
      cust.quantity += quantity;
      cust.revenue += revenue;
      product._customers.set(customerName, cust);

      const monthKey = String(line.invoice_date).substring(0, 7);
      product._months.set(monthKey, (product._months.get(monthKey) || 0) + revenue);
    }

    // Finalize per-product metrics
    let products: ProductSale[] = Array.from(productMap.values()).map(p => {
      const averagePrice = p.unitsSold > 0 ? p.totalRevenue / p.unitsSold : 0;
      const totalCost = p._cost * p.unitsSold;
      const grossMargin = p.totalRevenue - totalCost;
      const marginPercentage = p.totalRevenue > 0 ? (grossMargin / p.totalRevenue) * 100 : 0;

      const topCustomers = Array.from(p._customers.entries())
        .map(([customerName, v]) => ({ customerName, quantity: v.quantity, revenue: v.revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      const salesTrend = Array.from(p._months.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, sales]) => ({
          month: MONTH_NAMES[parseInt(monthKey.substring(5, 7), 10) - 1] || monthKey,
          sales,
        }));

      return {
        productId: p.productId,
        productName: p.productName,
        category: p.category,
        unitsSold: p.unitsSold,
        totalRevenue: p.totalRevenue,
        averagePrice,
        grossMargin,
        marginPercentage: Math.round(marginPercentage * 10) / 10,
        growthRate: 0,
        topCustomers,
        salesTrend,
      };
    });

    if (category !== 'all') {
      products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }

    products.sort((a, b) => {
      switch (sortBy) {
        case 'productName':
          return a.productName.localeCompare(b.productName);
        case 'unitsSold':
          return b.unitsSold - a.unitsSold;
        case 'averagePrice':
          return b.averagePrice - a.averagePrice;
        case 'marginPercentage':
          return b.marginPercentage - a.marginPercentage;
        case 'growthRate':
          return b.growthRate - a.growthRate;
        default:
          return b.totalRevenue - a.totalRevenue;
      }
    });

    // Category breakdown
    const categoryMap = new Map<string, { products: ProductSale[]; revenue: number; units: number }>();
    products.forEach(product => {
      if (!categoryMap.has(product.category)) {
        categoryMap.set(product.category, { products: [], revenue: 0, units: 0 });
      }
      const data = categoryMap.get(product.category)!;
      data.products.push(product);
      data.revenue += product.totalRevenue;
      data.units += product.unitsSold;
    });

    const categories: CategoryData[] = Array.from(categoryMap.entries()).map(([cat, data]) => ({
      category: cat,
      productCount: data.products.length,
      revenue: data.revenue,
      unitsSold: data.units,
      averageMargin: data.products.length > 0
        ? data.products.reduce((sum, p) => sum + p.marginPercentage, 0) / data.products.length
        : 0,
    }));

    const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0);
    const totalUnitsSold = products.reduce((sum, p) => sum + p.unitsSold, 0);
    const topProduct = products.length > 0 ? products[0] : null;

    const reportData: SalesByProductData & { currency: string } = {
      currency: baseCurrency,
      reportPeriod: {
        startDate,
        endDate,
      },
      summary: {
        totalProducts: products.length,
        totalRevenue: Math.round(totalRevenue),
        totalUnitsSold,
        averageOrderValue: totalUnitsSold > 0 ? Math.round(totalRevenue / totalUnitsSold) : 0,
        topProductRevenue: topProduct ? topProduct.totalRevenue : 0,
        topProductName: topProduct ? topProduct.productName : 'N/A',
        totalCategories: categories.length,
      },
      products,
      categories,
      topPerformers: products.slice(0, 5),
    };

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Error generating sales by product report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

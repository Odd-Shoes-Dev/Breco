import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface CustomerSale {
  customerId: string;
  customerName: string;
  customerType: 'Individual' | 'Business' | 'Government';
  totalSales: number;
  invoiceCount: number;
  averageSale: number;
  firstSaleDate: string;
  lastSaleDate: string;
  salesGrowth: number;
  topProducts: Array<{
    product: string;
    quantity: number;
    revenue: number;
  }>;
}

interface SalesByCustomerData {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalCustomers: number;
    totalSales: number;
    averageSalePerCustomer: number;
    topCustomerRevenue: number;
    topCustomerName: string;
    newCustomers: number;
    returningCustomers: number;
  };
  customers: CustomerSale[];
  topCustomers: CustomerSale[];
  customerTypes: {
    individual: { count: number; revenue: number };
    business: { count: number; revenue: number };
    government: { count: number; revenue: number };
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const customerType = searchParams.get('customerType') || 'all';
    const sortBy = searchParams.get('sortBy') || 'totalSales';

    // Fetch invoices with customer data for the period
    const invoices = await sql`
      SELECT i.id, i.customer_id, i.invoice_date, i.total, i.currency,
             c.id AS c_id, c.name AS c_name, c.company_name AS c_company_name, c.customer_type AS c_customer_type
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      WHERE i.invoice_date >= ${startDate}
        AND i.invoice_date <= ${endDate}
        AND i.status != 'void'
      ORDER BY i.invoice_date
    `;

    const invoiceIds = invoices.map((inv: any) => inv.id);
    let productData: any = {};

    if (invoiceIds.length > 0) {
      const lines = await sql`
        SELECT il.invoice_id, il.product_id, il.description, il.quantity, il.line_total,
               p.name AS product_name
        FROM invoice_lines il
        LEFT JOIN products p ON p.id = il.product_id
        WHERE il.invoice_id = ANY(${invoiceIds})
      `;

      lines.forEach((line: any) => {
        if (!productData[line.invoice_id]) {
          productData[line.invoice_id] = [];
        }
        productData[line.invoice_id].push({
          name: line.product_name || line.description || 'Product',
          quantity: parseFloat(line.quantity) || 0,
          revenue: parseFloat(line.line_total) || 0
        });
      });
    }

    // Group invoices by customer
    const customerMap = new Map<string, CustomerSale>();

    for (const invoice of invoices) {
      if (!invoice.customer_id) continue;

      const customerId = invoice.customer_id;
      const customerName = invoice.c_company_name || invoice.c_name;
      if (!customerName) continue;

      const customerTypeRaw = invoice.c_customer_type || 'Individual';

      let cType: 'Individual' | 'Business' | 'Government' = 'Individual';
      if (customerTypeRaw.toLowerCase().includes('business') || customerTypeRaw.toLowerCase().includes('company')) {
        cType = 'Business';
      } else if (customerTypeRaw.toLowerCase().includes('government') || customerTypeRaw.toLowerCase().includes('govt')) {
        cType = 'Government';
      }

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customerId,
          customerName,
          customerType: cType,
          totalSales: 0,
          invoiceCount: 0,
          averageSale: 0,
          firstSaleDate: invoice.invoice_date,
          lastSaleDate: invoice.invoice_date,
          salesGrowth: 0,
          topProducts: []
        });
      }

      const customer = customerMap.get(customerId)!;

      const total = parseFloat(invoice.total);
      let totalUSD = total;
      const invCurrency = invoice.currency || 'USD';
      if (invCurrency !== 'USD') {
        const res = await sql`SELECT convert_currency(${total}, ${invCurrency}, 'USD', ${invoice.invoice_date}) AS val`;
        totalUSD = res[0]?.val ?? total;
      }

      customer.totalSales += totalUSD;
      customer.invoiceCount += 1;
      customer.lastSaleDate = invoice.invoice_date;

      if (new Date(invoice.invoice_date) < new Date(customer.firstSaleDate)) {
        customer.firstSaleDate = invoice.invoice_date;
      }

      const invoiceProducts = productData[invoice.id] || [];
      invoiceProducts.forEach((product: any) => {
        const existingProduct = customer.topProducts.find((p: any) => p.product === product.name);
        if (existingProduct) {
          existingProduct.quantity += product.quantity;
          existingProduct.revenue += product.revenue;
        } else {
          customer.topProducts.push({
            product: product.name,
            quantity: product.quantity,
            revenue: product.revenue
          });
        }
      });
    }

    let customers = Array.from(customerMap.values());
    customers.forEach(customer => {
      customer.averageSale = customer.invoiceCount > 0 ? customer.totalSales / customer.invoiceCount : 0;
      customer.topProducts.sort((a: any, b: any) => b.revenue - a.revenue);
      customer.topProducts = customer.topProducts.slice(0, 5);
    });

    if (customerType !== 'all') {
      customers = customers.filter(c => c.customerType === customerType);
    }

    customers.sort((a, b) => {
      switch (sortBy) {
        case 'customerName':
          return a.customerName.localeCompare(b.customerName);
        case 'totalSales':
          return b.totalSales - a.totalSales;
        case 'invoiceCount':
          return b.invoiceCount - a.invoiceCount;
        default:
          return b.totalSales - a.totalSales;
      }
    });

    const totalSales = customers.reduce((sum, c) => sum + c.totalSales, 0);
    const totalCustomers = customers.length;
    const averageSalePerCustomer = totalCustomers > 0 ? totalSales / totalCustomers : 0;

    const topCustomer = customers.length > 0 ? customers[0] : null;

    const customerTypes = {
      individual: {
        count: customers.filter(c => c.customerType === 'Individual').length,
        revenue: customers.filter(c => c.customerType === 'Individual').reduce((sum, c) => sum + c.totalSales, 0)
      },
      business: {
        count: customers.filter(c => c.customerType === 'Business').length,
        revenue: customers.filter(c => c.customerType === 'Business').reduce((sum, c) => sum + c.totalSales, 0)
      },
      government: {
        count: customers.filter(c => c.customerType === 'Government').length,
        revenue: customers.filter(c => c.customerType === 'Government').reduce((sum, c) => sum + c.totalSales, 0)
      }
    };

    const topCustomers = customers.slice(0, 10);

    const response: SalesByCustomerData = {
      reportPeriod: {
        startDate,
        endDate
      },
      summary: {
        totalCustomers,
        totalSales,
        averageSalePerCustomer,
        topCustomerRevenue: topCustomer ? topCustomer.totalSales : 0,
        topCustomerName: topCustomer ? topCustomer.customerName : 'N/A',
        newCustomers: 0,
        returningCustomers: totalCustomers
      },
      customers,
      topCustomers,
      customerTypes
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Sales by customer report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate sales by customer report' },
      { status: 500 }
    );
  }
}

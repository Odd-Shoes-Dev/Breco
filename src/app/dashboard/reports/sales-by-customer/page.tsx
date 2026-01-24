'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChartBarIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface CustomerSale {
  customerId: string;
  customerName: string;
  customerType: 'Individual' | 'Business' | 'Government';
  totalSales: number;
  invoiceCount: number;
  averageSale: number;
  firstSaleDate: string;
  lastSaleDate: string;
  salesGrowth: number; // percentage
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

export default function SalesByCustomerPage() {
  const [data, setData] = useState<SalesByCustomerData | null>(null);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerType, setCustomerType] = useState('all');
  const [sortBy, setSortBy] = useState('totalSales');
  const [isLoading, setIsLoading] = useState(false);

  const fetchSalesByCustomer = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/sales-by-customer?startDate=${startDate}&endDate=${endDate}&customerType=${customerType}&sortBy=${sortBy}`
      );
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch sales by customer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesByCustomer();
  }, [startDate, endDate, customerType, sortBy]);

  const exportToPDF = () => {
    if (!data) return;

    const printHTML = `
      <html>
        <head>
          <title>Sales by Customer Report - ${formatDate(data.reportPeriod.startDate)} to ${formatDate(data.reportPeriod.endDate)} - Breco Safaris Ltd</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #111827;
              background: white;
              padding: 40px;
            }
            .header { 
              display: flex; 
              align-items: center; 
              margin-bottom: 30px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 20px;
            }
            .logo { 
              width: 200px; 
              height: 200px; 
              margin-right: 20px;
              border-radius: 8px;
              object-fit: contain;
            }
            .company-info h1 { 
              font-size: 28px; 
              font-weight: bold; 
              color: #1e3a5f;
              margin-bottom: 4px;
            }
            .company-info .address { 
              font-size: 14px; 
              color: #6b7280;
              margin-bottom: 2px;
            }
            .report-header { 
              text-align: center;
              margin: 30px 0;
            }
            .report-header h2 { 
              font-size: 24px; 
              font-weight: bold; 
              color: #111827;
              margin-bottom: 8px;
            }
            .report-header .period { 
              font-size: 16px; 
              color: #6b7280;
            }
            .summary {
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              margin: 25px 0;
            }
            .summary h3 {
              font-size: 18px;
              font-weight: bold;
              color: #1e3a5f;
              margin-bottom: 15px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 20px;
            }
            .summary-item {
              text-align: center;
              padding: 15px;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              background: white;
            }
            .summary-item h4 {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 5px;
              text-transform: uppercase;
            }
            .summary-item .value {
              font-size: 18px;
              font-weight: bold;
              color: #1f2937;
            }
            table { 
              width: 100%; 
              border-collapse: collapse;
              margin: 25px 0;
            }
            th { 
              background: #f9fafb; 
              padding: 12px; 
              border: 1px solid #e5e7eb;
              font-size: 12px;
              font-weight: bold;
              text-align: left;
            }
            th.number { text-align: right; }
            td { 
              padding: 10px 12px; 
              border: 1px solid #e5e7eb;
              font-size: 13px;
            }
            .customer-row:hover { background: #f9fafb; }
            .number { 
              text-align: right;
              font-family: 'SF Mono', Consolas, monospace;
            }
            .type-individual { color: #2563eb; }
            .type-business { color: #16a34a; }
            .type-government { color: #dc2626; }
            .growth-positive { color: #16a34a; }
            .growth-negative { color: #dc2626; }
            .growth-neutral { color: #6b7280; }
            @media print {
              body { padding: 20px; }
              .header { margin-bottom: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="/assets/logo.jpg" alt="Breco Safaris Logo" class="logo" />
            <div class="company-info">
              <h1>Breco Safaris Ltd</h1>
              <div class="address">Kampala Road Plot 14 Eagen House, Russel Street, P.O.Box 144011, Kampala, Uganda</div>
              <div class="address">Tel: +256 782 884 933, +256 772 891 729 • Email: brecosafaris@gmail.com</div>
              <div class="address">URA TIN: 1014756280 • URSB Reg. No: 80020001634842</div>
            </div>
          </div>
          
          <div class="report-header">
            <h2>Sales by Customer Report</h2>
            <div class="period">
              ${formatDate(data.reportPeriod.startDate)} to ${formatDate(data.reportPeriod.endDate)}
            </div>
          </div>

          <div class="summary">
            <h3>Summary</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <h4>Total Customers</h4>
                <div class="value">${data.summary.totalCustomers}</div>
              </div>
              <div class="summary-item">
                <h4>Total Sales</h4>
                <div class="value">${formatCurrency(data.summary.totalSales)}</div>
              </div>
              <div class="summary-item">
                <h4>Avg per Customer</h4>
                <div class="value">${formatCurrency(data.summary.averageSalePerCustomer)}</div>
              </div>
              <div class="summary-item">
                <h4>Top Customer</h4>
                <div class="value">${formatCurrency(data.summary.topCustomerRevenue)}</div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25%">Customer</th>
                <th style="width: 10%">Type</th>
                <th class="number" style="width: 15%">Total Sales</th>
                <th class="number" style="width: 10%">Invoices</th>
                <th class="number" style="width: 15%">Avg Sale</th>
                <th class="number" style="width: 10%">Growth</th>
                <th style="width: 15%">Last Sale</th>
              </tr>
            </thead>
            <tbody>
              ${data.customers.map(customer => `
                <tr class="customer-row">
                  <td><strong>${customer.customerName}</strong></td>
                  <td class="type-${customer.customerType.toLowerCase()}">${customer.customerType}</td>
                  <td class="number">${formatCurrency(customer.totalSales)}</td>
                  <td class="number">${customer.invoiceCount}</td>
                  <td class="number">${formatCurrency(customer.averageSale)}</td>
                  <td class="number growth-${customer.salesGrowth > 0 ? 'positive' : customer.salesGrowth < 0 ? 'negative' : 'neutral'}">
                    ${customer.salesGrowth > 0 ? '+' : ''}${customer.salesGrowth.toFixed(1)}%
                  </td>
                  <td>${formatDate(customer.lastSaleDate)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    // Open print dialog in new window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.focus();
      
      // Wait a moment for content to load, then show print dialog
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const getCustomerTypeColor = (type: string) => {
    switch (type) {
      case 'Individual':
        return 'text-blue-600 bg-blue-50';
      case 'Business':
        return 'text-green-600 bg-green-50';
      case 'Government':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return '↗';
    if (growth < 0) return '↘';
    return '→';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/dashboard/reports" className="btn-ghost p-1.5 sm:p-2">
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Sales by Customer</h1>
            <p className="text-sm sm:text-base text-gray-600">Customer sales performance and analysis</p>
          </div>
        </div>
        <button
          onClick={exportToPDF}
          disabled={!data}
          className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownTrayIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Export PDF</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Customer Type</label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="all">All Types</option>
              <option value="Individual">Individual</option>
              <option value="Business">Business</option>
              <option value="Government">Government</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="totalSales">Total Sales</option>
              <option value="customerName">Customer Name</option>
              <option value="invoiceCount">Invoice Count</option>
              <option value="averageSale">Average Sale</option>
              <option value="salesGrowth">Growth Rate</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchSalesByCustomer}
              disabled={isLoading}
              className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-breco-navy text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-breco-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Refresh Report'}
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-breco-navy mx-auto"></div>
          <p className="text-gray-500 mt-4 text-sm sm:text-base">Loading sales data...</p>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <UserGroupIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Customers</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{data?.summary?.totalCustomers || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CurrencyDollarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Sales</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.totalSales || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ChartBarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Avg per Customer</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.averageSalePerCustomer || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ArrowTrendingUpIcon className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Top Customer</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.topCustomerRevenue || 0)}</p>
                  <p className="text-xs text-gray-500 truncate">{data?.summary?.topCustomerName || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Type Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-4">Customer Type Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
                <BuildingOfficeIcon className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-blue-600">Individual</p>
                <p className="text-lg font-bold text-blue-700">{data?.customerTypes?.individual?.count || 0}</p>
                <p className="text-sm text-blue-600">{formatCurrency(data?.customerTypes?.individual?.revenue || 0)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
                <BuildingOfficeIcon className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-600">Business</p>
                <p className="text-lg font-bold text-green-700">{data?.customerTypes?.business?.count || 0}</p>
                <p className="text-sm text-green-600">{formatCurrency(data?.customerTypes?.business?.revenue || 0)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
                <BuildingOfficeIcon className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-red-600">Government</p>
                <p className="text-lg font-bold text-red-700">{data?.customerTypes?.government?.count || 0}</p>
                <p className="text-sm text-red-600">{formatCurrency(data?.customerTypes?.government?.revenue || 0)}</p>
              </div>
            </div>
          </div>

          {/* Top Customers Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <ChartBarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Customer Sales Performance</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Sales
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoices
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Sale
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Growth
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Sale
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.customers?.length || 0) === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">
                        No customer sales data found for the selected period
                      </td>
                    </tr>
                  ) : (
                    (data?.customers || []).map((customer) => (
                      <tr key={customer.customerId} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">{customer.customerName}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={cn(
                            'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                            getCustomerTypeColor(customer.customerType)
                          )}>
                            {customer.customerType}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-medium text-gray-900">
                          {formatCurrency(customer.totalSales)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                          {customer.invoiceCount}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                          {formatCurrency(customer.averageSale)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums">
                          <span className={cn('font-medium', getGrowthColor(customer.salesGrowth))}>
                            {getGrowthIcon(customer.salesGrowth)} {Math.abs(customer.salesGrowth).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700">
                          {formatDate(customer.lastSaleDate)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-sm sm:text-base">Loading customer sales data...</p>
        </div>
      )}
    </div>
  );
}

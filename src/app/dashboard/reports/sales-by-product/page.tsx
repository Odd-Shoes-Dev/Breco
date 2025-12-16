'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CubeIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon,
  TagIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

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
  categories: Array<{
    category: string;
    productCount: number;
    revenue: number;
    unitsSold: number;
    averageMargin: number;
  }>;
  topPerformers: ProductSale[];
}

export default function SalesByProductPage() {
  const [data, setData] = useState<SalesByProductData | null>(null);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('totalRevenue');
  const [isLoading, setIsLoading] = useState(false);

  const fetchSalesByProduct = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/sales-by-product?startDate=${startDate}&endDate=${endDate}&category=${category}&sortBy=${sortBy}`
      );
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch sales by product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesByProduct();
  }, [startDate, endDate, category, sortBy]);

  const exportToPDF = () => {
    if (!data) return;

    const printHTML = `
      <html>
        <head>
          <title>Sales by Product Report - ${formatDate(data.reportPeriod.startDate)} to ${formatDate(data.reportPeriod.endDate)} - Breco Safaris Ltd</title>
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
            .product-row:hover { background: #f9fafb; }
            .number { 
              text-align: right;
              font-family: 'SF Mono', Consolas, monospace;
            }
            .category-software { color: #2563eb; }
            .category-consulting { color: #16a34a; }
            .category-support { color: #dc2626; }
            .category-training { color: #7c2d12; }
            .category-hardware { color: #6366f1; }
            .growth-positive { color: #16a34a; }
            .growth-negative { color: #dc2626; }
            .growth-neutral { color: #6b7280; }
            .margin-high { color: #16a34a; }
            .margin-medium { color: #f59e0b; }
            .margin-low { color: #dc2626; }
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
              <div class="address">121 Bedford Street, Waltham, MA 02453</div>
              <div class="address">Phone: (857) 384-2899</div>
              <div class="address">Director: N.Maureen</div>
            </div>
          </div>
          
          <div class="report-header">
            <h2>Sales by Product Report</h2>
            <div class="period">
              ${formatDate(data.reportPeriod.startDate)} to ${formatDate(data.reportPeriod.endDate)}
            </div>
          </div>

          <div class="summary">
            <h3>Summary</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <h4>Total Products</h4>
                <div class="value">${data.summary.totalProducts}</div>
              </div>
              <div class="summary-item">
                <h4>Total Revenue</h4>
                <div class="value">${formatCurrency(data.summary.totalRevenue)}</div>
              </div>
              <div class="summary-item">
                <h4>Units Sold</h4>
                <div class="value">${data.summary.totalUnitsSold.toLocaleString()}</div>
              </div>
              <div class="summary-item">
                <h4>Avg Order Value</h4>
                <div class="value">${formatCurrency(data.summary.averageOrderValue)}</div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25%">Product</th>
                <th style="width: 12%">Category</th>
                <th class="number" style="width: 10%">Units</th>
                <th class="number" style="width: 15%">Revenue</th>
                <th class="number" style="width: 12%">Avg Price</th>
                <th class="number" style="width: 10%">Margin</th>
                <th class="number" style="width: 10%">Growth</th>
              </tr>
            </thead>
            <tbody>
              ${data.products.map(product => `
                <tr class="product-row">
                  <td><strong>${product.productName}</strong></td>
                  <td class="category-${product.category.toLowerCase().replace(/\s+/g, '')}">${product.category}</td>
                  <td class="number">${product.unitsSold.toLocaleString()}</td>
                  <td class="number">${formatCurrency(product.totalRevenue)}</td>
                  <td class="number">${formatCurrency(product.averagePrice)}</td>
                  <td class="number margin-${product.marginPercentage > 30 ? 'high' : product.marginPercentage > 15 ? 'medium' : 'low'}">
                    ${product.marginPercentage.toFixed(1)}%
                  </td>
                  <td class="number growth-${product.growthRate > 0 ? 'positive' : product.growthRate < 0 ? 'negative' : 'neutral'}">
                    ${product.growthRate > 0 ? '+' : ''}${product.growthRate.toFixed(1)}%
                  </td>
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

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'software':
        return 'text-blue-600 bg-blue-50';
      case 'consulting':
        return 'text-green-600 bg-green-50';
      case 'support':
        return 'text-red-600 bg-red-50';
      case 'training':
        return 'text-yellow-600 bg-yellow-50';
      case 'hardware':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getMarginColor = (margin: number) => {
    if (margin > 30) return 'text-green-600';
    if (margin > 15) return 'text-yellow-600';
    return 'text-red-600';
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
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Sales by Product</h1>
            <p className="text-sm sm:text-base text-gray-600">Product performance and revenue analysis</p>
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
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="all">All Categories</option>
              <option value="Software">Software</option>
              <option value="Consulting">Consulting</option>
              <option value="Support">Support</option>
              <option value="Training">Training</option>
              <option value="Hardware">Hardware</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="totalRevenue">Total Revenue</option>
              <option value="productName">Product Name</option>
              <option value="unitsSold">Units Sold</option>
              <option value="averagePrice">Average Price</option>
              <option value="marginPercentage">Margin %</option>
              <option value="growthRate">Growth Rate</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchSalesByProduct}
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
          <p className="text-gray-500 mt-4 text-sm sm:text-base">Loading product sales data...</p>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CubeIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{data?.summary?.totalProducts || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CurrencyDollarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.totalRevenue || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ChartBarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Units Sold</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{(data?.summary?.totalUnitsSold || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ArrowTrendingUpIcon className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Avg Order Value</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.averageOrderValue || 0)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          {data?.categories && data.categories.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-4">Category Performance</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.categories.map((cat, index) => (
                  <div key={index} className="text-center p-4 rounded-lg bg-gray-50 border border-gray-200">
                    <TagIcon className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">{cat.category}</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(cat.revenue)}</p>
                    <p className="text-xs text-gray-600">{cat.productCount} products • {cat.unitsSold.toLocaleString()} units</p>
                    <p className="text-xs text-gray-600">Avg margin: {cat.averageMargin.toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Performance Alert */}
          {data?.summary?.topProductName && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <ArrowTrendingUpIcon className="w-6 h-6 text-green-500 flex-shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-green-800">Top Performing Product</h3>
                  <p className="text-xs sm:text-sm text-green-600 mt-1">
                    <span className="font-bold">{data.summary.topProductName}</span> is your top performer with{' '}
                    <span className="font-bold">{formatCurrency(data.summary.topProductRevenue)}</span> in revenue
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Product Performance Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <CubeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Product Sales Performance</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Units Sold
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Price
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Margin %
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Growth
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.products?.length || 0) === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">
                        No product sales data found for the selected period
                      </td>
                    </tr>
                  ) : (
                    (data?.products || []).map((product) => (
                      <tr key={product.productId} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">{product.productName}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={cn(
                            'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                            getCategoryColor(product.category)
                          )}>
                            {product.category}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                          {product.unitsSold.toLocaleString()}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-medium text-gray-900">
                          {formatCurrency(product.totalRevenue)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                          {formatCurrency(product.averagePrice)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums">
                          <span className={cn('font-medium', getMarginColor(product.marginPercentage))}>
                            {product.marginPercentage.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums">
                          <span className={cn('font-medium', getGrowthColor(product.growthRate))}>
                            {getGrowthIcon(product.growthRate)} {Math.abs(product.growthRate).toFixed(1)}%
                          </span>
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
          <CubeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-sm sm:text-base">Loading product sales data...</p>
        </div>
      )}
    </div>
  );
}

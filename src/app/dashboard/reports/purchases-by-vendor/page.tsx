'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChartBarIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ShoppingCartIcon,
  TruckIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface VendorPurchase {
  vendorId: string;
  vendorName: string;
  vendorType: 'Supplier' | 'Service Provider' | 'Contractor' | 'Utility' | 'Manufacturing';
  totalPurchases: number;
  purchaseCount: number;
  averagePurchase: number;
  firstPurchaseDate: string;
  lastPurchaseDate: string;
  purchaseGrowth: number; // percentage
  paymentTerms: string;
  topCategories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  performanceScore: number; // 1-100
  onTimeDelivery: number; // percentage
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
    topVendorSpending: number;
    topVendorName: string;
    newVendors: number;
    recurringVendors: number;
    averageDeliveryDays: number;
  };
  vendors: VendorPurchase[];
  topVendors: VendorPurchase[];
  vendorTypes: {
    supplier: { count: number; spending: number };
    serviceProvider: { count: number; spending: number };
    contractor: { count: number; spending: number };
    utility: { count: number; spending: number };
    manufacturing: { count: number; spending: number };
  };
  categories: Array<{
    category: string;
    totalSpending: number;
    vendorCount: number;
    averagePerVendor: number;
  }>;
}

export default function PurchasesByVendorPage() {
  const [data, setData] = useState<PurchasesByVendorData | null>(null);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorType, setVendorType] = useState('all');
  const [sortBy, setSortBy] = useState('totalPurchases');
  const [minAmount, setMinAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchPurchasesByVendor = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/purchases-by-vendor?startDate=${startDate}&endDate=${endDate}&vendorType=${vendorType}&sortBy=${sortBy}&minAmount=${minAmount}`
      );
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch purchases by vendor:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchasesByVendor();
  }, [startDate, endDate, vendorType, sortBy, minAmount]);

  const exportToPDF = () => {
    if (!data) return;

    const printHTML = `
      <html>
        <head>
          <title>Purchases by Vendor Report - ${formatDate(data.reportPeriod.startDate)} to ${formatDate(data.reportPeriod.endDate)} - Breco Safaris Ltd</title>
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
            .vendor-row:hover { background: #f9fafb; }
            .number { 
              text-align: right;
              font-family: 'SF Mono', Consolas, monospace;
            }
            .type-supplier { color: #2563eb; }
            .type-serviceprovider { color: #16a34a; }
            .type-contractor { color: #dc2626; }
            .type-utility { color: #7c2d12; }
            .type-manufacturing { color: #9333ea; }
            .growth-positive { color: #16a34a; }
            .growth-negative { color: #dc2626; }
            .growth-neutral { color: #6b7280; }
            .performance-excellent { color: #16a34a; font-weight: bold; }
            .performance-good { color: #059669; }
            .performance-average { color: #d97706; }
            .performance-poor { color: #dc2626; }
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
            <h2>Purchases by Vendor Report</h2>
            <div class="period">
              ${formatDate(data.reportPeriod.startDate)} to ${formatDate(data.reportPeriod.endDate)}
            </div>
          </div>

          <div class="summary">
            <h3>Purchase Summary</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <h4>Total Vendors</h4>
                <div class="value">${data.summary.totalVendors}</div>
              </div>
              <div class="summary-item">
                <h4>Total Purchases</h4>
                <div class="value">${formatCurrency(data.summary.totalPurchases)}</div>
              </div>
              <div class="summary-item">
                <h4>Avg per Vendor</h4>
                <div class="value">${formatCurrency(data.summary.averagePurchasePerVendor)}</div>
              </div>
              <div class="summary-item">
                <h4>Top Vendor</h4>
                <div class="value">${formatCurrency(data.summary.topVendorSpending)}</div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25%">Vendor</th>
                <th style="width: 12%">Type</th>
                <th class="number" style="width: 15%">Total Purchases</th>
                <th class="number" style="width: 8%">Orders</th>
                <th class="number" style="width: 12%">Avg Purchase</th>
                <th class="number" style="width: 8%">Growth</th>
                <th class="number" style="width: 8%">Performance</th>
                <th style="width: 12%">Last Order</th>
              </tr>
            </thead>
            <tbody>
              ${data.vendors.map(vendor => `
                <tr class="vendor-row">
                  <td><strong>${vendor.vendorName}</strong></td>
                  <td class="type-${vendor.vendorType.toLowerCase().replace(/\s+/g, '')}">${vendor.vendorType}</td>
                  <td class="number">${formatCurrency(vendor.totalPurchases)}</td>
                  <td class="number">${vendor.purchaseCount}</td>
                  <td class="number">${formatCurrency(vendor.averagePurchase)}</td>
                  <td class="number growth-${vendor.purchaseGrowth > 0 ? 'positive' : vendor.purchaseGrowth < 0 ? 'negative' : 'neutral'}">
                    ${vendor.purchaseGrowth > 0 ? '+' : ''}${vendor.purchaseGrowth.toFixed(1)}%
                  </td>
                  <td class="number performance-${vendor.performanceScore >= 90 ? 'excellent' : vendor.performanceScore >= 75 ? 'good' : vendor.performanceScore >= 60 ? 'average' : 'poor'}">
                    ${vendor.performanceScore}/100
                  </td>
                  <td>${formatDate(vendor.lastPurchaseDate)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 30px; font-size: 12px; color: #6b7280;">
            <p><strong>Performance Score:</strong> Based on delivery time, quality, and reliability metrics.</p>
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          </div>
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

  const getVendorTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'supplier':
        return 'text-blue-600 bg-blue-50';
      case 'service provider':
        return 'text-green-600 bg-green-50';
      case 'contractor':
        return 'text-red-600 bg-red-50';
      case 'utility':
        return 'text-yellow-600 bg-yellow-50';
      case 'manufacturing':
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

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return '↗';
    if (growth < 0) return '↘';
    return '→';
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 75) return 'text-emerald-600 bg-emerald-50';
    if (score >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getPerformanceLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Average';
    return 'Poor';
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
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Purchases by Vendor</h1>
            <p className="text-sm sm:text-base text-gray-600">Vendor spending analysis and performance tracking</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
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
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Vendor Type</label>
            <select
              value={vendorType}
              onChange={(e) => setVendorType(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="all">All Types</option>
              <option value="Supplier">Supplier</option>
              <option value="Service Provider">Service Provider</option>
              <option value="Contractor">Contractor</option>
              <option value="Utility">Utility</option>
              <option value="Manufacturing">Manufacturing</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="totalPurchases">Total Purchases</option>
              <option value="vendorName">Vendor Name</option>
              <option value="purchaseCount">Order Count</option>
              <option value="averagePurchase">Average Purchase</option>
              <option value="purchaseGrowth">Growth Rate</option>
              <option value="performanceScore">Performance</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Min Amount</label>
            <input
              type="number"
              placeholder="$0"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchPurchasesByVendor}
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
          <p className="text-gray-500 mt-4 text-sm sm:text-base">Loading purchase data...</p>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <BuildingOfficeIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Vendors</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{data?.summary?.totalVendors || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CurrencyDollarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Purchases</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.totalPurchases || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ChartBarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Avg per Vendor</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.averagePurchasePerVendor || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ArrowTrendingUpIcon className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Top Vendor</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.topVendorSpending || 0)}</p>
                  <p className="text-xs text-gray-500 truncate">{data?.summary?.topVendorName || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Vendor Type Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-4">Vendor Type Analysis</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
                <TruckIcon className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-blue-600">Supplier</p>
                <p className="text-lg font-bold text-blue-700">{data?.vendorTypes?.supplier?.count || 0}</p>
                <p className="text-sm text-blue-600">{formatCurrency(data?.vendorTypes?.supplier?.spending || 0)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
                <ShoppingCartIcon className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-600">Service Provider</p>
                <p className="text-lg font-bold text-green-700">{data?.vendorTypes?.serviceProvider?.count || 0}</p>
                <p className="text-sm text-green-600">{formatCurrency(data?.vendorTypes?.serviceProvider?.spending || 0)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
                <BuildingOfficeIcon className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-red-600">Contractor</p>
                <p className="text-lg font-bold text-red-700">{data?.vendorTypes?.contractor?.count || 0}</p>
                <p className="text-sm text-red-600">{formatCurrency(data?.vendorTypes?.contractor?.spending || 0)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <ClockIcon className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-yellow-600">Utility</p>
                <p className="text-lg font-bold text-yellow-700">{data?.vendorTypes?.utility?.count || 0}</p>
                <p className="text-sm text-yellow-600">{formatCurrency(data?.vendorTypes?.utility?.spending || 0)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-purple-50 border border-purple-200">
                <ArrowTrendingUpIcon className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-purple-600">Manufacturing</p>
                <p className="text-lg font-bold text-purple-700">{data?.vendorTypes?.manufacturing?.count || 0}</p>
                <p className="text-sm text-purple-600">{formatCurrency(data?.vendorTypes?.manufacturing?.spending || 0)}</p>
              </div>
            </div>
          </div>

          {/* Vendor Purchase Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <ChartBarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Vendor Purchase Performance</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendor
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Purchases
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Orders
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Purchase
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Growth
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Order
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.vendors?.length || 0) === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">
                        No vendor purchase data found for the selected period
                      </td>
                    </tr>
                  ) : (
                    (data?.vendors || []).map((vendor) => (
                      <tr key={vendor.vendorId} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">{vendor.vendorName}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={cn(
                            'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                            getVendorTypeColor(vendor.vendorType)
                          )}>
                            {vendor.vendorType}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-medium text-gray-900">
                          {formatCurrency(vendor.totalPurchases)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                          {vendor.purchaseCount}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                          {formatCurrency(vendor.averagePurchase)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums">
                          <span className={cn('font-medium', getGrowthColor(vendor.purchaseGrowth))}>
                            {getGrowthIcon(vendor.purchaseGrowth)} {Math.abs(vendor.purchaseGrowth).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                          <span className={cn(
                            'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                            getPerformanceColor(vendor.performanceScore)
                          )}>
                            {vendor.performanceScore}/100
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700">
                          {formatDate(vendor.lastPurchaseDate)}
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
          <ShoppingCartIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-sm sm:text-base">Loading purchase data...</p>
        </div>
      )}
    </div>
  );
}

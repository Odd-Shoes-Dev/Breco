'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ClockIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

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

interface APAgingData {
  reportDate: string;
  summary: {
    totalVendors: number;
    totalPayables: number;
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
    averagePaymentDays: number;
    criticalVendors: number;
  };
  vendors: VendorAging[];
  agingBuckets: Array<{
    bucket: string;
    amount: number;
    percentage: number;
    vendorCount: number;
  }>;
  vendorTypes: Array<{
    type: string;
    vendorCount: number;
    totalAmount: number;
    averageAmount: number;
  }>;
}

export default function APAgingPage() {
  const [data, setData] = useState<APAgingData | null>(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorType, setVendorType] = useState('all');
  const [sortBy, setSortBy] = useState('totalAmount');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAPAging = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/ap-aging?reportDate=${reportDate}&vendorType=${vendorType}&sortBy=${sortBy}&showCriticalOnly=${showCriticalOnly}`
      );
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch AP aging:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAPAging();
  }, [reportDate, vendorType, sortBy, showCriticalOnly]);

  const exportToPDF = () => {
    if (!data) return;

    const printHTML = `
      <html>
        <head>
          <title>Accounts Payable Aging Report - ${formatDate(data.reportDate)} - Breco Safaris Ltd</title>
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
            .report-header .date { 
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
              grid-template-columns: repeat(5, 1fr);
              gap: 15px;
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
              font-size: 16px;
              font-weight: bold;
              color: #1f2937;
            }
            .aging-current { border-left: 4px solid #10b981; }
            .aging-1to30 { border-left: 4px solid #f59e0b; }
            .aging-31to60 { border-left: 4px solid #f97316; }
            .aging-61to90 { border-left: 4px solid #ef4444; }
            .aging-over90 { border-left: 4px solid #dc2626; }
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
            .type-service { color: #16a34a; }
            .type-contractor { color: #dc2626; }
            .type-utility { color: #7c2d12; }
            .critical-vendor { background: #fef2f2; }
            .overdue-high { color: #dc2626; font-weight: bold; }
            .overdue-medium { color: #f59e0b; }
            .overdue-low { color: #10b981; }
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
            <h2>Accounts Payable Aging Report</h2>
            <div class="date">As of ${formatDate(data.reportDate)}</div>
          </div>

          <div class="summary">
            <h3>Aging Summary</h3>
            <div class="summary-grid">
              <div class="summary-item aging-current">
                <h4>Current</h4>
                <div class="value">${formatCurrency(data.summary.current)}</div>
              </div>
              <div class="summary-item aging-1to30">
                <h4>1-30 Days</h4>
                <div class="value">${formatCurrency(data.summary.days1to30)}</div>
              </div>
              <div class="summary-item aging-31to60">
                <h4>31-60 Days</h4>
                <div class="value">${formatCurrency(data.summary.days31to60)}</div>
              </div>
              <div class="summary-item aging-61to90">
                <h4>61-90 Days</h4>
                <div class="value">${formatCurrency(data.summary.days61to90)}</div>
              </div>
              <div class="summary-item aging-over90">
                <h4>Over 90 Days</h4>
                <div class="value">${formatCurrency(data.summary.over90)}</div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 20%">Vendor</th>
                <th style="width: 10%">Type</th>
                <th class="number" style="width: 12%">Total</th>
                <th class="number" style="width: 10%">Current</th>
                <th class="number" style="width: 10%">1-30 Days</th>
                <th class="number" style="width: 10%">31-60 Days</th>
                <th class="number" style="width: 10%">61-90 Days</th>
                <th class="number" style="width: 10%">Over 90</th>
                <th style="width: 8%">Terms</th>
              </tr>
            </thead>
            <tbody>
              ${data.vendors.map(vendor => `
                <tr class="vendor-row ${vendor.over90 > 0 || vendor.days61to90 > 0 ? 'critical-vendor' : ''}">
                  <td><strong>${vendor.vendorName}</strong></td>
                  <td class="type-${vendor.vendorType.toLowerCase().replace(/\s+/g, '')}">${vendor.vendorType}</td>
                  <td class="number">${formatCurrency(vendor.totalAmount)}</td>
                  <td class="number overdue-low">${formatCurrency(vendor.current)}</td>
                  <td class="number ${vendor.days1to30 > 0 ? 'overdue-medium' : ''}">${formatCurrency(vendor.days1to30)}</td>
                  <td class="number ${vendor.days31to60 > 0 ? 'overdue-medium' : ''}">${formatCurrency(vendor.days31to60)}</td>
                  <td class="number ${vendor.days61to90 > 0 ? 'overdue-high' : ''}">${formatCurrency(vendor.days61to90)}</td>
                  <td class="number ${vendor.over90 > 0 ? 'overdue-high' : ''}">${formatCurrency(vendor.over90)}</td>
                  <td>${vendor.paymentTerms}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 30px; font-size: 12px; color: #6b7280;">
            <p><strong>Legend:</strong> Critical vendors highlighted in red background have overdue amounts beyond 60 days.</p>
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
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getOverdueColor = (amount: number, days: string) => {
    if (amount === 0) return 'text-gray-500';
    
    switch (days) {
      case 'current':
        return 'text-green-600';
      case '1to30':
        return 'text-yellow-600';
      case '31to60':
        return 'text-orange-600';
      case '61to90':
      case 'over90':
        return 'text-red-600 font-bold';
      default:
        return 'text-gray-900';
    }
  };

  const isCriticalVendor = (vendor: VendorAging) => {
    return vendor.over90 > 0 || vendor.days61to90 > 0;
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
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Accounts Payable Aging</h1>
            <p className="text-sm sm:text-base text-gray-600">Outstanding vendor payables by aging periods</p>
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
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Report Date</label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
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
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="totalAmount">Total Amount</option>
              <option value="vendorName">Vendor Name</option>
              <option value="over90">Over 90 Days</option>
              <option value="days61to90">61-90 Days</option>
              <option value="averagePaymentDays">Avg Payment Days</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Filter</label>
            <div className="flex items-center h-8 sm:h-10">
              <input
                type="checkbox"
                id="criticalOnly"
                checked={showCriticalOnly}
                onChange={(e) => setShowCriticalOnly(e.target.checked)}
                className="rounded border-gray-300 text-breco-navy focus:ring-breco-navy"
              />
              <label htmlFor="criticalOnly" className="ml-2 text-xs sm:text-sm text-gray-700">
                Critical only
              </label>
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchAPAging}
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
          <p className="text-gray-500 mt-4 text-sm sm:text-base">Loading AP aging data...</p>
        </div>
      ) : data ? (
        <>
          {/* Critical Vendors Alert */}
          {data?.summary?.criticalVendors > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-500 flex-shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-red-800">Critical Vendors Alert</h3>
                  <p className="text-xs sm:text-sm text-red-600 mt-1">
                    <span className="font-bold">{data.summary.criticalVendors}</span> vendor(s) have overdue amounts beyond 60 days requiring immediate attention
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Payables</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.totalPayables || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ClockIcon className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Avg Payment Days</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{Math.round(data?.summary?.averagePaymentDays || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ExclamationTriangleIcon className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Critical Vendors</p>
                  <p className="text-lg sm:text-xl font-bold text-red-600">{data?.summary?.criticalVendors || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Aging Buckets */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-4">Aging Analysis</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
              <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200 border-l-4 border-l-green-500">
                <p className="text-xs text-green-600 font-medium">Current</p>
                <p className="text-sm sm:text-base font-bold text-green-700 mt-1">{formatCurrency(data?.summary?.current || 0)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200 border-l-4 border-l-yellow-500">
                <p className="text-xs text-yellow-600 font-medium">1-30 Days</p>
                <p className="text-sm sm:text-base font-bold text-yellow-700 mt-1">{formatCurrency(data?.summary?.days1to30 || 0)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-orange-50 border border-orange-200 border-l-4 border-l-orange-500">
                <p className="text-xs text-orange-600 font-medium">31-60 Days</p>
                <p className="text-sm sm:text-base font-bold text-orange-700 mt-1">{formatCurrency(data?.summary?.days31to60 || 0)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200 border-l-4 border-l-red-500">
                <p className="text-xs text-red-600 font-medium">61-90 Days</p>
                <p className="text-sm sm:text-base font-bold text-red-700 mt-1">{formatCurrency(data?.summary?.days61to90 || 0)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-100 border border-red-300 border-l-4 border-l-red-600">
                <p className="text-xs text-red-700 font-medium">Over 90 Days</p>
                <p className="text-sm sm:text-base font-bold text-red-800 mt-1">{formatCurrency(data?.summary?.over90 || 0)}</p>
              </div>
            </div>
          </div>

          {/* Vendor Aging Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <ChartBarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Vendor Aging Details</h3>
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
                      Total
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      1-30 Days
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      31-60 Days
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      61-90 Days
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Over 90
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Terms
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.vendors?.length || 0) === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">
                        No vendor aging data found
                      </td>
                    </tr>
                  ) : (
                    (data?.vendors || []).map((vendor) => (
                      <tr key={vendor.vendorId} className={cn(
                        "hover:bg-gray-50",
                        isCriticalVendor(vendor) && "bg-red-50 border-l-4 border-l-red-500"
                      )}>
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
                          {formatCurrency(vendor.totalAmount)}
                        </td>
                        <td className={cn(
                          "px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums",
                          getOverdueColor(vendor.current, 'current')
                        )}>
                          {formatCurrency(vendor.current)}
                        </td>
                        <td className={cn(
                          "px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums",
                          getOverdueColor(vendor.days1to30, '1to30')
                        )}>
                          {formatCurrency(vendor.days1to30)}
                        </td>
                        <td className={cn(
                          "px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums",
                          getOverdueColor(vendor.days31to60, '31to60')
                        )}>
                          {formatCurrency(vendor.days31to60)}
                        </td>
                        <td className={cn(
                          "px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums",
                          getOverdueColor(vendor.days61to90, '61to90')
                        )}>
                          {formatCurrency(vendor.days61to90)}
                        </td>
                        <td className={cn(
                          "px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums",
                          getOverdueColor(vendor.over90, 'over90')
                        )}>
                          {formatCurrency(vendor.over90)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700">
                          {vendor.paymentTerms}
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
          <ClockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-sm sm:text-base">Loading AP aging data...</p>
        </div>
      )}
    </div>
  );
}

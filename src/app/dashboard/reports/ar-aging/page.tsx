'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ClockIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface AgingBucket {
  label: string;
  amount: number;
  count: number;
}

interface CustomerAging {
  customerId: string;
  customerName: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
}

interface ARAgingData {
  asOfDate: string;
  summary: {
    totalReceivables: number;
    buckets: AgingBucket[];
  };
  customers: CustomerAging[];
}

export default function ARAgingPage() {
  const [data, setData] = useState<ARAgingData | null>(null);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [asOfDate]);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reports/ar-aging?asOfDate=${asOfDate}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch AR aging:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!data) return;

    const printHTML = `
      <html>
        <head>
          <title>Accounts Receivable Aging - Breco Safaris Ltd</title>
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
            .report-title { 
              text-align: center; 
              margin: 30px 0;
            }
            .report-title h2 { 
              font-size: 24px; 
              font-weight: bold; 
              color: #111827;
              margin-bottom: 8px;
            }
            .report-title .date { 
              font-size: 16px; 
              color: #6b7280;
            }
            .summary {
              margin: 25px 0;
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
              gap: 15px;
            }
            .summary-card {
              border: 1px solid #e5e7eb;
              padding: 15px;
              border-radius: 8px;
              text-align: center;
            }
            .summary-card h3 {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 5px;
              text-transform: uppercase;
            }
            .summary-card .value {
              font-size: 16px;
              font-weight: bold;
              color: #1f2937;
            }
            .summary-card .count {
              font-size: 11px;
              color: #9ca3af;
              margin-top: 2px;
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
            th.amount { text-align: right; }
            td { 
              padding: 10px 12px; 
              border: 1px solid #e5e7eb;
              font-size: 13px;
            }
            .customer-row:hover { background: #f9fafb; }
            .amount { 
              text-align: right;
              font-family: 'SF Mono', Consolas, monospace;
            }
            .totals-row {
              background: #e5e7eb;
              font-weight: bold;
            }
            .aging-current { color: #22c55e; }
            .aging-30 { color: #3b82f6; }
            .aging-60 { color: #f59e0b; }
            .aging-90 { color: #f97316; }
            .aging-over90 { color: #ef4444; }
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
          
          <div class="report-title">
            <h2>Accounts Receivable Aging Report</h2>
            <div class="date">As of ${new Date(data.asOfDate).toLocaleDateString()}</div>
          </div>

          <div class="summary">
            <div class="summary-card">
              <h3>Total Receivables</h3>
              <div class="value">${formatCurrency(data?.summary?.totalReceivables || 0)}</div>
            </div>
            ${(data?.summary?.buckets || []).map(bucket => `
              <div class="summary-card">
                <h3>${bucket.label}</h3>
                <div class="value">${formatCurrency(bucket.amount)}</div>
                <div class="count">${bucket.count} invoices</div>
              </div>
            `).join('')}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25%">Customer</th>
                <th class="amount" style="width: 15%">Current</th>
                <th class="amount" style="width: 15%">1-30 Days</th>
                <th class="amount" style="width: 15%">31-60 Days</th>
                <th class="amount" style="width: 15%">61-90 Days</th>
                <th class="amount" style="width: 15%">Over 90 Days</th>
                <th class="amount" style="width: 15%">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(data?.customers || []).map(customer => `
                <tr class="customer-row">
                  <td>${customer.customerName}</td>
                  <td class="amount aging-current">${customer.current > 0 ? formatCurrency(customer.current) : '-'}</td>
                  <td class="amount aging-30">${customer.days1to30 > 0 ? formatCurrency(customer.days1to30) : '-'}</td>
                  <td class="amount aging-60">${customer.days31to60 > 0 ? formatCurrency(customer.days31to60) : '-'}</td>
                  <td class="amount aging-90">${customer.days61to90 > 0 ? formatCurrency(customer.days61to90) : '-'}</td>
                  <td class="amount aging-over90">${customer.over90 > 0 ? formatCurrency(customer.over90) : '-'}</td>
                  <td class="amount" style="font-weight: bold">${formatCurrency(customer.total)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="totals-row">
                <td>TOTAL</td>
                <td class="amount">${formatCurrency((data?.customers || []).reduce((sum, c) => sum + c.current, 0))}</td>
                <td class="amount">${formatCurrency((data?.customers || []).reduce((sum, c) => sum + c.days1to30, 0))}</td>
                <td class="amount">${formatCurrency((data?.customers || []).reduce((sum, c) => sum + c.days31to60, 0))}</td>
                <td class="amount">${formatCurrency((data?.customers || []).reduce((sum, c) => sum + c.days61to90, 0))}</td>
                <td class="amount">${formatCurrency((data?.customers || []).reduce((sum, c) => sum + c.over90, 0))}</td>
                <td class="amount">${formatCurrency(data?.summary?.totalReceivables || 0)}</td>
              </tr>
            </tfoot>
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

  const getAgingColor = (bucket: string) => {
    switch (bucket) {
      case 'Current':
        return 'bg-green-100 text-green-800';
      case '1-30 Days':
        return 'bg-blue-100 text-blue-800';
      case '31-60 Days':
        return 'bg-yellow-100 text-yellow-800';
      case '61-90 Days':
        return 'bg-orange-100 text-orange-800';
      case 'Over 90 Days':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Accounts Receivable Aging</h1>
            <p className="text-sm sm:text-base text-gray-600">Outstanding customer invoices by age</p>
          </div>
        </div>
        <button
          onClick={exportToPDF}
          className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowDownTrayIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Export PDF</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>

      {/* Date Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <label className="text-xs sm:text-sm font-medium text-gray-700">As of Date:</label>
          </div>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f] mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading AR aging report...</p>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-gray-500">Total Receivables</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">
                {formatCurrency(data?.summary?.totalReceivables || 0)}
              </p>
            </div>
            {(data?.summary?.buckets || []).map((bucket, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500">{bucket.label}</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">
                  {formatCurrency(bucket.amount)}
                </p>
                <p className="text-xs text-gray-400 mt-1">{bucket.count} invoices</p>
              </div>
            ))}
          </div>

          {/* Aging Visualization */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-3 sm:mb-4">Aging Distribution</h3>
            <div className="h-6 sm:h-8 rounded-lg overflow-hidden flex">
              {(data?.summary?.buckets || []).map((bucket, index) => {
                const totalReceivables = data?.summary?.totalReceivables || 0;
                const percentage = totalReceivables > 0 ? (bucket.amount / totalReceivables) * 100 : 0;
                if (percentage === 0) return null;
                return (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center justify-center text-xs font-medium transition-all',
                      getAgingColor(bucket.label)
                    )}
                    style={{ width: `${percentage}%` }}
                    title={`${bucket.label}: ${formatCurrency(bucket.amount)} (${percentage.toFixed(1)}%)`}
                  >
                    {percentage >= 10 && `${percentage.toFixed(0)}%`}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4 mt-4">
              {(data?.summary?.buckets || []).map((bucket, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className={cn('w-3 h-3 rounded-sm', getAgingColor(bucket.label))} />
                  <span className="text-xs text-gray-600">{bucket.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Detail Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Customer Aging Detail</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      1-30 Days
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      31-60 Days
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      61-90 Days
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Over 90
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.customers || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">
                        No outstanding receivables
                      </td>
                    </tr>
                  ) : (
                    (data?.customers || []).map((customer) => (
                      <tr key={customer.customerId} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <span className="text-xs sm:text-sm font-medium text-gray-900">
                              {customer.customerName}
                            </span>
                            {customer.over90 > 0 && (
                              <ExclamationTriangleIcon className="w-3 h-3 sm:w-4 sm:h-4 text-red-500 flex-shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-right tabular-nums text-xs sm:text-sm">
                          {customer.current > 0 ? formatCurrency(customer.current) : '-'}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-right tabular-nums text-xs sm:text-sm">
                          {customer.days1to30 > 0 ? formatCurrency(customer.days1to30) : '-'}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-right tabular-nums text-xs sm:text-sm">
                          {customer.days31to60 > 0 ? (
                            <span className="text-yellow-600 font-medium">
                              {formatCurrency(customer.days31to60)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-right tabular-nums text-xs sm:text-sm">
                          {customer.days61to90 > 0 ? (
                            <span className="text-orange-600 font-medium">
                              {formatCurrency(customer.days61to90)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-right tabular-nums text-xs sm:text-sm">
                          {customer.over90 > 0 ? (
                            <span className="text-red-600 font-medium">
                              {formatCurrency(customer.over90)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-right tabular-nums text-xs sm:text-sm font-semibold text-gray-900">
                          {formatCurrency(customer.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {(data?.customers || []).length > 0 && (
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-900 text-xs sm:text-sm">Total</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right tabular-nums text-xs sm:text-sm">
                        {formatCurrency(
                          (data?.customers || []).reduce((sum, c) => sum + c.current, 0)
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right tabular-nums text-xs sm:text-sm">
                        {formatCurrency(
                          (data?.customers || []).reduce((sum, c) => sum + c.days1to30, 0)
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right tabular-nums text-xs sm:text-sm">
                        {formatCurrency(
                          (data?.customers || []).reduce((sum, c) => sum + c.days31to60, 0)
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right tabular-nums text-xs sm:text-sm">
                        {formatCurrency(
                          (data?.customers || []).reduce((sum, c) => sum + c.days61to90, 0)
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right tabular-nums text-xs sm:text-sm">
                        {formatCurrency(
                          (data?.customers || []).reduce((sum, c) => sum + c.over90, 0)
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right tabular-nums text-xs sm:text-sm">
                        {formatCurrency(data?.summary?.totalReceivables || 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-gray-500">No data available</p>
        </div>
      )}
    </div>
  );
}


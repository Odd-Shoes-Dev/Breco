'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon,
  UserIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface VendorTransaction {
  id: string;
  date: string;
  type: 'Bill' | 'Payment' | 'Credit' | 'Adjustment';
  reference: string;
  description: string;
  amount: number;
  balance: number;
}

interface VendorStatementData {
  vendor: {
    id: string;
    name: string;
    address: string;
    phone?: string;
    email?: string;
  };
  statementPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    beginningBalance: number;
    totalPurchases: number;
    totalPayments: number;
    totalAdjustments: number;
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

export default function VendorStatementPage() {
  const [data, setData] = useState<VendorStatementData | null>(null);
  const [vendors, setVendors] = useState<Array<{id: string; name: string}>>([]);
  const [vendorId, setVendorId] = useState('');
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadVendors = async () => {
      try {
        const response = await fetch('/api/vendors?active=true');
        const result = await response.json();
        if (result.data && Array.isArray(result.data)) {
          const vendorList = result.data.map((v: any) => ({
            id: v.id,
            name: v.company_name || v.name
          }));
          setVendors(vendorList);
        }
      } catch (error) {
        console.error('Failed to load vendors:', error);
      }
    };
    loadVendors();
  }, []);

  const fetchStatement = async () => {
    if (!vendorId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/vendor-statement?vendorId=${vendorId}&startDate=${startDate}&endDate=${endDate}`
      );
      const result = await response.json();
      
      if (result.error) {
        console.error('API Error:', result.error);
        setData(null);
      } else {
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch vendor statement:', error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!data) return;

    const printHTML = `
      <html>
        <head>
          <title>Vendor Statement - ${data.vendor.name} - Breco Safaris Ltd</title>
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
            .statement-header { 
              display: flex; 
              justify-content: space-between;
              margin: 30px 0;
              align-items: flex-start;
            }
            .statement-title h2 { 
              font-size: 24px; 
              font-weight: bold; 
              color: #111827;
              margin-bottom: 8px;
            }
            .statement-title .period { 
              font-size: 16px; 
              color: #6b7280;
            }
            .vendor-info {
              text-align: right;
            }
            .vendor-info h3 {
              font-size: 16px;
              font-weight: bold;
              color: #111827;
              margin-bottom: 5px;
            }
            .vendor-info .detail {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 2px;
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
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            .summary-item {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .summary-item:last-child {
              border-bottom: none;
              font-weight: bold;
              font-size: 16px;
              color: #1e3a5f;
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
            .transaction-row:hover { background: #f9fafb; }
            .amount { 
              text-align: right;
              font-family: 'SF Mono', Consolas, monospace;
            }
            .type-bill { color: #dc2626; }
            .type-payment { color: #16a34a; }
            .type-credit { color: #2563eb; }
            .type-adjustment { color: #7c2d12; }
            .aging {
              margin-top: 30px;
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 15px;
            }
            .aging-card {
              border: 1px solid #e5e7eb;
              padding: 15px;
              border-radius: 8px;
              text-align: center;
            }
            .aging-card h4 {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 5px;
              text-transform: uppercase;
            }
            .aging-card .value {
              font-size: 16px;
              font-weight: bold;
              color: #1f2937;
            }
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
          
          <div class="statement-header">
            <div class="statement-title">
              <h2>Vendor Statement</h2>
              <div class="period">
                ${new Date(data.statementPeriod.startDate).toLocaleDateString()} to ${new Date(data.statementPeriod.endDate).toLocaleDateString()}
              </div>
            </div>
            <div class="vendor-info">
              <h3>${data.vendor.name}</h3>
              ${data.vendor.address ? `<div class="detail">${data.vendor.address}</div>` : ''}
              ${data.vendor.phone ? `<div class="detail">${data.vendor.phone}</div>` : ''}
              ${data.vendor.email ? `<div class="detail">${data.vendor.email}</div>` : ''}
            </div>
          </div>

          <div class="summary">
            <h3>Account Summary</h3>
            <div class="summary-grid">
              <div>
                <div class="summary-item">
                  <span>Beginning Balance</span>
                  <span>${formatCurrency(data.summary.beginningBalance)}</span>
                </div>
                <div class="summary-item">
                  <span>Total Purchases</span>
                  <span>${formatCurrency(data.summary.totalPurchases)}</span>
                </div>
                <div class="summary-item">
                  <span>Ending Balance</span>
                  <span>${formatCurrency(data.summary.endingBalance)}</span>
                </div>
              </div>
              <div>
                <div class="summary-item">
                  <span>Total Payments</span>
                  <span>${formatCurrency(data.summary.totalPayments)}</span>
                </div>
                <div class="summary-item">
                  <span>Adjustments</span>
                  <span>${formatCurrency(data.summary.totalAdjustments)}</span>
                </div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 12%">Date</th>
                <th style="width: 12%">Type</th>
                <th style="width: 15%">Reference</th>
                <th style="width: 35%">Description</th>
                <th class="amount" style="width: 13%">Amount</th>
                <th class="amount" style="width: 13%">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${data.transactions.map(transaction => `
                <tr class="transaction-row">
                  <td>${new Date(transaction.date).toLocaleDateString()}</td>
                  <td class="type-${transaction.type.toLowerCase()}">${transaction.type}</td>
                  <td>${transaction.reference}</td>
                  <td>${transaction.description}</td>
                  <td class="amount">${formatCurrency(transaction.amount)}</td>
                  <td class="amount">${formatCurrency(transaction.balance)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="aging">
            <div class="aging-card">
              <h4>Current</h4>
              <div class="value">${formatCurrency(data.aging.current)}</div>
            </div>
            <div class="aging-card">
              <h4>1-30 Days</h4>
              <div class="value">${formatCurrency(data.aging.days1to30)}</div>
            </div>
            <div class="aging-card">
              <h4>31-60 Days</h4>
              <div class="value">${formatCurrency(data.aging.days31to60)}</div>
            </div>
            <div class="aging-card">
              <h4>61-90 Days</h4>
              <div class="value">${formatCurrency(data.aging.days61to90)}</div>
            </div>
            <div class="aging-card">
              <h4>Over 90 Days</h4>
              <div class="value">${formatCurrency(data.aging.over90)}</div>
            </div>
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

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'Bill':
        return 'text-red-600 bg-red-50';
      case 'Payment':
        return 'text-green-600 bg-green-50';
      case 'Credit':
        return 'text-blue-600 bg-blue-50';
      case 'Adjustment':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
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
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Vendor Statement</h1>
            <p className="text-sm sm:text-base text-gray-600">Transaction history and balance for a vendor</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Vendor</label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="">Select Vendor</option>
              {vendors.map(vendor => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>
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
          <div className="flex items-end">
            <button
              onClick={fetchStatement}
              disabled={!vendorId || isLoading}
              className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-breco-navy text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-breco-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Generate Statement'}
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-breco-navy mx-auto"></div>
          <p className="text-gray-500 mt-4 text-sm sm:text-base">Loading vendor statement...</p>
        </div>
      ) : data ? (
        <>
          {/* Vendor Info & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <UserIcon className="w-5 h-5 sm:w-6 sm:h-6 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Vendor Information</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-900">{data.vendor.name}</p>
                  {data.vendor.address && (
                    <p className="text-xs text-gray-600">{data.vendor.address}</p>
                  )}
                  {data.vendor.phone && (
                    <p className="text-xs text-gray-600">{data.vendor.phone}</p>
                  )}
                  {data.vendor.email && (
                    <p className="text-xs text-gray-600">{data.vendor.email}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <CurrencyDollarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Account Summary</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">Beginning Balance</span>
                  <span className="tabular-nums">{formatCurrency(data.summary.beginningBalance)}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">Total Purchases</span>
                  <span className="tabular-nums">{formatCurrency(data.summary.totalPurchases)}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">Total Payments</span>
                  <span className="tabular-nums text-green-600">{formatCurrency(data.summary.totalPayments)}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm pt-2 border-t border-gray-200 font-semibold">
                  <span className="text-gray-900">Ending Balance</span>
                  <span className="tabular-nums text-breco-navy">{formatCurrency(data.summary.endingBalance)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Statement Period</h3>
              </div>
              <div className="space-y-2">
                <div className="text-xs sm:text-sm">
                  <span className="text-gray-600">From: </span>
                  <span>{formatDate(data.statementPeriod.startDate)}</span>
                </div>
                <div className="text-xs sm:text-sm">
                  <span className="text-gray-600">To: </span>
                  <span>{formatDate(data.statementPeriod.endDate)}</span>
                </div>
                <div className="text-xs sm:text-sm">
                  <span className="text-gray-600">Transactions: </span>
                  <span>{data.transactions.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Aging Analysis */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-4">Aging Analysis</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
              <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
                <p className="text-xs text-green-600 font-medium">Current</p>
                <p className="text-sm sm:text-base font-bold text-green-700 mt-1">{formatCurrency(data.aging.current)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-600 font-medium">1-30 Days</p>
                <p className="text-sm sm:text-base font-bold text-blue-700 mt-1">{formatCurrency(data.aging.days1to30)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <p className="text-xs text-yellow-600 font-medium">31-60 Days</p>
                <p className="text-sm sm:text-base font-bold text-yellow-700 mt-1">{formatCurrency(data.aging.days31to60)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-orange-50 border border-orange-200">
                <p className="text-xs text-orange-600 font-medium">61-90 Days</p>
                <p className="text-sm sm:text-base font-bold text-orange-700 mt-1">{formatCurrency(data.aging.days61to90)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-xs text-red-600 font-medium">Over 90 Days</p>
                <p className="text-sm sm:text-base font-bold text-red-700 mt-1">{formatCurrency(data.aging.over90)}</p>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Transaction History</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">
                        No transactions found for the selected period
                      </td>
                    </tr>
                  ) : (
                    data.transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900">
                          {formatDate(transaction.date)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={cn(
                            'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                            getTransactionTypeColor(transaction.type)
                          )}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900">
                          {transaction.reference}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900">
                          {transaction.description}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums">
                          <span className={cn(
                            'font-medium',
                            transaction.amount > 0 ? 'text-red-600' : 'text-green-600'
                          )}>
                            {formatCurrency(transaction.amount)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-medium text-gray-900">
                          {formatCurrency(transaction.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : vendorId ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-500 text-sm sm:text-base">No statement data available for the selected vendor and period</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-sm sm:text-base">Select a vendor to generate a statement</p>
        </div>
      )}
    </div>
  );
}

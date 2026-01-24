'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface GeneralLedgerEntry {
  entryId: string;
  date: string;
  accountCode: string;
  accountName: string;
  accountType: 'Assets' | 'Liabilities' | 'Equity' | 'Revenue' | 'Expenses';
  description: string;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
  journalType: 'General Journal' | 'Sales Journal' | 'Purchase Journal' | 'Cash Receipts' | 'Cash Disbursements' | 'Payroll Journal';
}

interface AccountSummary {
  accountCode: string;
  accountName: string;
  accountType: 'Assets' | 'Liabilities' | 'Equity' | 'Revenue' | 'Expenses';
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  entryCount: number;
}

interface GeneralLedgerData {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalAccounts: number;
    totalDebits: number;
    totalCredits: number;
    totalEntries: number;
    balanceDifference: number;
    inBalance: boolean;
  };
  entries: GeneralLedgerEntry[];
  accountSummaries: AccountSummary[];
  accountTypes: {
    assets: { accounts: number; balance: number };
    liabilities: { accounts: number; balance: number };
    equity: { accounts: number; balance: number };
    revenue: { accounts: number; balance: number };
    expenses: { accounts: number; balance: number };
  };
}

export default function GeneralLedgerPage() {
  const [data, setData] = useState<GeneralLedgerData | null>(null);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountFilter, setAccountFilter] = useState('all');
  const [journalType, setJournalType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAccountSummary, setShowAccountSummary] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const fetchGeneralLedger = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/general-ledger?startDate=${startDate}&endDate=${endDate}&accountFilter=${accountFilter}&journalType=${journalType}&searchTerm=${encodeURIComponent(searchTerm)}`
      );
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch general ledger:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGeneralLedger();
  }, [startDate, endDate, accountFilter, journalType, searchTerm]);

  const exportToPDF = () => {
    if (!data) return;

    const printHTML = `
      <html>
        <head>
          <title>General Ledger Report - ${formatDate(data.reportPeriod.startDate)} to ${formatDate(data.reportPeriod.endDate)} - Breco Safaris Ltd</title>
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
            .balance-indicator {
              text-align: center;
              margin: 20px 0;
              padding: 15px;
              border-radius: 8px;
            }
            .balance-indicator.in-balance {
              background: #d1fae5;
              color: #065f46;
              border: 1px solid #10b981;
            }
            .balance-indicator.out-of-balance {
              background: #fee2e2;
              color: #991b1b;
              border: 1px solid #ef4444;
            }
            table { 
              width: 100%; 
              border-collapse: collapse;
              margin: 25px 0;
              font-size: 12px;
            }
            th { 
              background: #f9fafb; 
              padding: 8px; 
              border: 1px solid #e5e7eb;
              font-size: 11px;
              font-weight: bold;
              text-align: left;
            }
            th.number { text-align: right; }
            td { 
              padding: 6px 8px; 
              border: 1px solid #e5e7eb;
              font-size: 11px;
            }
            .ledger-row:hover { background: #f9fafb; }
            .number { 
              text-align: right;
              font-family: 'SF Mono', Consolas, monospace;
            }
            .account-group {
              background: #f3f4f6;
              font-weight: bold;
            }
            .type-assets { border-left: 4px solid #2563eb; }
            .type-liabilities { border-left: 4px solid #dc2626; }
            .type-equity { border-left: 4px solid #16a34a; }
            .type-revenue { border-left: 4px solid #059669; }
            .type-expenses { border-left: 4px solid #d97706; }
            @media print {
              body { padding: 20px; }
              .header { margin-bottom: 20px; }
              table { font-size: 10px; }
              th, td { padding: 4px 6px; }
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
            <h2>General Ledger Report</h2>
            <div class="period">
              ${formatDate(data.reportPeriod.startDate)} to ${formatDate(data.reportPeriod.endDate)}
            </div>
          </div>

          <div class="summary">
            <h3>Ledger Summary</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <h4>Total Accounts</h4>
                <div class="value">${data.summary.totalAccounts}</div>
              </div>
              <div class="summary-item">
                <h4>Total Debits</h4>
                <div class="value">${formatCurrency(data.summary.totalDebits)}</div>
              </div>
              <div class="summary-item">
                <h4>Total Credits</h4>
                <div class="value">${formatCurrency(data.summary.totalCredits)}</div>
              </div>
              <div class="summary-item">
                <h4>Total Entries</h4>
                <div class="value">${data.summary.totalEntries}</div>
              </div>
            </div>
          </div>

          <div class="balance-indicator ${data.summary.inBalance ? 'in-balance' : 'out-of-balance'}">
            <strong>${data.summary.inBalance ? '✓ Ledger is in Balance' : '⚠ Ledger is Out of Balance'}</strong>
            ${data.summary.balanceDifference !== 0 ? `<br>Difference: ${formatCurrency(Math.abs(data.summary.balanceDifference))}` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 8%">Date</th>
                <th style="width: 8%">Account</th>
                <th style="width: 20%">Account Name</th>
                <th style="width: 25%">Description</th>
                <th style="width: 8%">Reference</th>
                <th class="number" style="width: 10%">Debit</th>
                <th class="number" style="width: 10%">Credit</th>
                <th class="number" style="width: 11%">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${data.entries.map(entry => `
                <tr class="ledger-row type-${entry.accountType.toLowerCase()}">
                  <td>${formatDate(entry.date)}</td>
                  <td>${entry.accountCode}</td>
                  <td>${entry.accountName}</td>
                  <td>${entry.description}</td>
                  <td>${entry.reference}</td>
                  <td class="number">${entry.debit > 0 ? formatCurrency(entry.debit) : ''}</td>
                  <td class="number">${entry.credit > 0 ? formatCurrency(entry.credit) : ''}</td>
                  <td class="number">${formatCurrency(entry.runningBalance)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 30px; font-size: 12px; color: #6b7280;">
            <p><strong>Note:</strong> This report shows all journal entries for the selected period.</p>
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

  const getAccountTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'assets':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'liabilities':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'equity':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'revenue':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'expenses':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getJournalTypeColor = (type: string) => {
    switch (type.toLowerCase().replace(/\s+/g, '')) {
      case 'generaljournal':
        return 'text-purple-600 bg-purple-50';
      case 'salesjournal':
        return 'text-green-600 bg-green-50';
      case 'purchasejournal':
        return 'text-red-600 bg-red-50';
      case 'cashreceipts':
        return 'text-blue-600 bg-blue-50';
      case 'cashdisbursements':
        return 'text-orange-600 bg-orange-50';
      case 'payrolljournal':
        return 'text-indigo-600 bg-indigo-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const toggleAccountExpansion = (accountCode: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountCode)) {
      newExpanded.delete(accountCode);
    } else {
      newExpanded.add(accountCode);
    }
    setExpandedAccounts(newExpanded);
  };

  const groupedEntries = data?.entries.reduce((groups, entry) => {
    const key = `${entry.accountCode}-${entry.accountName}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
    return groups;
  }, {} as Record<string, GeneralLedgerEntry[]>) || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/dashboard/reports" className="btn-ghost p-1.5 sm:p-2">
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">General Ledger</h1>
            <p className="text-sm sm:text-base text-gray-600">Complete journal entry record and account activity</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAccountSummary(!showAccountSummary)}
            className={cn(
              "inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm font-medium",
              showAccountSummary
                ? "bg-breco-navy text-white border-breco-navy"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            )}
          >
            <EyeIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{showAccountSummary ? 'Hide Summary' : 'Show Summary'}</span>
            <span className="sm:hidden">Summary</span>
          </button>
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
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Account Type</label>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="all">All Accounts</option>
              <option value="Assets">Assets</option>
              <option value="Liabilities">Liabilities</option>
              <option value="Equity">Equity</option>
              <option value="Revenue">Revenue</option>
              <option value="Expenses">Expenses</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Journal Type</label>
            <select
              value={journalType}
              onChange={(e) => setJournalType(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="all">All Journals</option>
              <option value="General Journal">General Journal</option>
              <option value="Sales Journal">Sales Journal</option>
              <option value="Purchase Journal">Purchase Journal</option>
              <option value="Cash Receipts">Cash Receipts</option>
              <option value="Cash Disbursements">Cash Disbursements</option>
              <option value="Payroll Journal">Payroll Journal</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Account, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 pl-8 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
              />
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 transform -translate-y-1/2" />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchGeneralLedger}
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
          <p className="text-gray-500 mt-4 text-sm sm:text-base">Loading general ledger...</p>
        </div>
      ) : data ? (
        <>
          {/* Balance Status */}
          <div className={cn(
            "rounded-xl p-4 sm:p-6 border-2",
            data.summary.inBalance 
              ? "bg-green-50 border-green-200" 
              : "bg-red-50 border-red-200"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                data.summary.inBalance 
                  ? "bg-green-100 text-green-600" 
                  : "bg-red-100 text-red-600"
              )}>
                {data.summary.inBalance ? '✓' : '⚠'}
              </div>
              <div>
                <h3 className={cn(
                  "text-sm sm:text-base font-semibold",
                  data.summary.inBalance ? "text-green-800" : "text-red-800"
                )}>
                  {data.summary.inBalance ? 'Ledger is in Balance' : 'Ledger is Out of Balance'}
                </h3>
                <p className={cn(
                  "text-xs sm:text-sm mt-1",
                  data.summary.inBalance ? "text-green-600" : "text-red-600"
                )}>
                  Total Debits: {formatCurrency(data.summary.totalDebits)} | 
                  Total Credits: {formatCurrency(data.summary.totalCredits)}
                  {data.summary.balanceDifference !== 0 && 
                    ` | Difference: ${formatCurrency(Math.abs(data.summary.balanceDifference))}`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <DocumentTextIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Entries</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{data?.summary?.totalEntries || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <FunnelIcon className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Accounts</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{data?.summary?.totalAccounts || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-xs sm:text-sm font-bold text-green-600">Dr</span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Debits</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.totalDebits || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-xs sm:text-sm font-bold text-red-600">Cr</span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Credits</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.totalCredits || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CalendarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Period</p>
                  <p className="text-xs sm:text-sm font-bold text-gray-900">
                    {new Date(startDate).getDate()} - {new Date(endDate).getDate()} 
                    {' '}{new Date(endDate).toLocaleDateString('en-US', { month: 'short' })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Account Summary (Toggle View) */}
          {showAccountSummary && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
                <div className="flex items-center gap-2 sm:gap-3">
                  <FunnelIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900">Account Summary</h3>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Opening Balance
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Debits
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credits
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Closing Balance
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entries
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data?.accountSummaries || []).map((account) => (
                      <tr key={account.accountCode} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">
                            {account.accountCode} - {account.accountName}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={cn(
                            'inline-flex px-2 py-1 text-xs font-medium rounded-full border',
                            getAccountTypeColor(account.accountType)
                          )}>
                            {account.accountType}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                          {formatCurrency(account.openingBalance)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-green-600">
                          {formatCurrency(account.totalDebits)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-red-600">
                          {formatCurrency(account.totalCredits)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-medium text-gray-900">
                          {formatCurrency(account.closingBalance)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-600">
                          {account.entryCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* General Ledger Entries */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Ledger Entries</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Journal
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Debit
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credit
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.entries?.length || 0) === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">
                        No ledger entries found for the selected criteria
                      </td>
                    </tr>
                  ) : (
                    (data?.entries || []).map((entry) => (
                      <tr key={entry.entryId} className={cn(
                        "hover:bg-gray-50",
                        `border-l-2 border-l-${entry.accountType === 'Assets' ? 'blue' : 
                                                    entry.accountType === 'Liabilities' ? 'red' :
                                                    entry.accountType === 'Equity' ? 'green' :
                                                    entry.accountType === 'Revenue' ? 'emerald' : 'orange'}-200`
                      )}>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700">
                          {formatDate(entry.date)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">{entry.accountCode}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[150px]">{entry.accountName}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700 max-w-[200px] truncate">
                          {entry.description}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600">
                          {entry.reference}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={cn(
                            'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                            getJournalTypeColor(entry.journalType)
                          )}>
                            {entry.journalType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-green-600 font-medium">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : ''}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-red-600 font-medium">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : ''}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-medium text-gray-900">
                          {formatCurrency(entry.runningBalance)}
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
          <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-sm sm:text-base">Loading general ledger...</p>
        </div>
      )}
    </div>
  );
}

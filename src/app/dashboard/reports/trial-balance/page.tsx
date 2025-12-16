'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalculatorIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, cn } from '@/lib/utils';

interface TrialBalanceAccount {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}

interface TrialBalanceData {
  asOfDate: string;
  accounts: TrialBalanceAccount[];
  totals: {
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  };
}

export default function TrialBalancePage() {
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [showZeroBalances, setShowZeroBalances] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [asOfDate]);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reports/trial-balance?asOfDate=${asOfDate}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch trial balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!data) return;

    const printHTML = `
      <html>
        <head>
          <title>Trial Balance - Breco Safaris Ltd</title>
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
            .balance-status {
              text-align: center;
              padding: 15px;
              margin: 20px 0;
              border-radius: 8px;
              font-weight: bold;
            }
            .balanced { background: #f0fdf4; color: #166534; border: 2px solid #22c55e; }
            .unbalanced { background: #fef2f2; color: #dc2626; border: 2px solid #ef4444; }
            table { 
              width: 100%; 
              border-collapse: collapse;
              margin: 20px 0;
            }
            th { 
              background: #f9fafb; 
              padding: 12px; 
              border: 1px solid #e5e7eb;
              font-size: 14px;
              font-weight: bold;
              text-align: left;
            }
            th.amount { text-align: right; }
            td { 
              padding: 8px 12px; 
              border: 1px solid #e5e7eb;
              font-size: 13px;
            }
            .account-type {
              background: #f3f4f6;
              font-weight: bold;
              color: #1f2937;
            }
            .account-row:hover { background: #f9fafb; }
            .amount { 
              text-align: right;
              font-family: 'SF Mono', Consolas, monospace;
            }
            .totals-row {
              background: #e5e7eb;
              font-weight: bold;
            }
            .summary {
              margin-top: 30px;
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 20px;
            }
            .summary-card {
              border: 1px solid #e5e7eb;
              padding: 15px;
              border-radius: 8px;
            }
            .summary-card h3 {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 5px;
            }
            .summary-card .value {
              font-size: 18px;
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
          
          <div class="report-title">
            <h2>Trial Balance</h2>
            <div class="date">As of ${new Date(data.asOfDate).toLocaleDateString()}</div>
          </div>

          <div class="balance-status ${data?.totals?.isBalanced ? 'balanced' : 'unbalanced'}">
            ${data?.totals?.isBalanced 
              ? `✓ Trial Balance is in Balance - Total Debits and Credits: ${formatCurrency(data?.totals?.totalDebits || 0)}`
              : `⚠ Trial Balance is Out of Balance - Difference: ${formatCurrency(Math.abs((data?.totals?.totalDebits || 0) - (data?.totals?.totalCredits || 0)))}`
            }
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 15%">Account Code</th>
                <th style="width: 45%">Account Name</th>
                <th class="amount" style="width: 20%">Debit</th>
                <th class="amount" style="width: 20%">Credit</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(filteredAccounts.reduce((groups, account) => {
                const type = account.accountType;
                if (!groups[type]) groups[type] = [];
                groups[type].push(account);
                return groups;
              }, {} as Record<string, typeof filteredAccounts>))
                .sort(([a], [b]) => {
                  const order = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
                  return order.indexOf(a) - order.indexOf(b);
                })
                .map(([accountType, accounts]) => `
                  <tr>
                    <td colspan="4" class="account-type">${accountType}s</td>
                  </tr>
                  ${accounts.map(account => `
                    <tr class="account-row">
                      <td>${account.accountCode}</td>
                      <td>${account.accountName}</td>
                      <td class="amount">${account.debit > 0 ? formatCurrency(account.debit) : ''}</td>
                      <td class="amount">${account.credit > 0 ? formatCurrency(account.credit) : ''}</td>
                    </tr>
                  `).join('')}
                `).join('')}
            </tbody>
            <tfoot>
              <tr class="totals-row">
                <td colspan="2">TOTAL</td>
                <td class="amount">${formatCurrency(data?.totals?.totalDebits || 0)}</td>
                <td class="amount">${formatCurrency(data?.totals?.totalCredits || 0)}</td>
              </tr>
            </tfoot>
          </table>

          <div class="summary">
            <div class="summary-card">
              <h3>Total Debit Balances</h3>
              <div class="value">${formatCurrency(data?.totals?.totalDebits || 0)}</div>
            </div>
            <div class="summary-card">
              <h3>Total Credit Balances</h3>
              <div class="value">${formatCurrency(data?.totals?.totalCredits || 0)}</div>
            </div>
            <div class="summary-card">
              <h3>Difference</h3>
              <div class="value" style="color: ${data?.totals?.isBalanced ? '#22c55e' : '#ef4444'}">
                ${formatCurrency(Math.abs((data?.totals?.totalDebits || 0) - (data?.totals?.totalCredits || 0)))}
              </div>
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

  const filteredAccounts =
    data?.accounts?.filter(
      (account) => showZeroBalances || account.debit !== 0 || account.credit !== 0
    ) || [];

  const groupedAccounts = filteredAccounts.reduce((groups, account) => {
    const type = account.accountType;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(account);
    return groups;
  }, {} as Record<string, TrialBalanceAccount[]>);

  const accountTypeOrder = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/dashboard/reports" className="btn-ghost p-1.5 sm:p-2">
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Trial Balance</h1>
            <p className="text-sm sm:text-base text-gray-600">Verify that debits equal credits</p>
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

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <label className="text-xs sm:text-sm font-medium text-gray-700">As of Date:</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showZeroBalances}
              onChange={(e) => setShowZeroBalances(e.target.checked)}
              className="rounded border-gray-300 text-breco-navy focus:ring-breco-navy"
            />
            <span className="text-xs sm:text-sm text-gray-700">Show zero balances</span>
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f] mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading trial balance...</p>
        </div>
      ) : data ? (
        <>
          {/* Balance Status */}
          <div
            className={cn(
              'rounded-xl shadow-sm border p-3 sm:p-4 flex items-center gap-2 sm:gap-3',
              data?.totals?.isBalanced
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            )}
          >
            {data?.totals?.isBalanced ? (
              <>
                <CheckCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm sm:text-base font-medium text-green-800">Trial Balance is in Balance</p>
                  <p className="text-xs sm:text-sm text-green-600">
                    Total Debits and Credits both equal {formatCurrency(data?.totals?.totalDebits || 0)}
                  </p>
                </div>
              </>
            ) : (
              <>
                <ExclamationCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm sm:text-base font-medium text-red-800">Trial Balance is Out of Balance</p>
                  <p className="text-xs sm:text-sm text-red-600">
                    Difference:{' '}
                    {formatCurrency(Math.abs((data?.totals?.totalDebits || 0) - (data?.totals?.totalCredits || 0)))}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Trial Balance Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <CalculatorIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900">Breco Safaris Ltd</h3>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Trial Balance as of {new Date(data.asOfDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account Code
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account Name
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Debit
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {accountTypeOrder.map((accountType) => {
                    const accounts = groupedAccounts[accountType];
                    if (!accounts || accounts.length === 0) return null;

                    return (
                      <tr key={accountType}>
                        <td colSpan={4} className="p-0">
                          <table className="w-full">
                            <tbody>
                              {/* Account Type Header */}
                              <tr className="bg-gray-50/50">
                                <td
                                  colSpan={4}
                                  className="px-3 sm:px-6 py-2 text-xs sm:text-sm font-semibold text-gray-700"
                                >
                                  {accountType}s
                                </td>
                              </tr>
                              {/* Accounts */}
                              {accounts.map((account) => (
                                <tr key={account.accountCode} className="hover:bg-gray-50">
                                  <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-500 w-20 sm:w-32">
                                    {account.accountCode}
                                  </td>
                                  <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                                    {account.accountName}
                                  </td>
                                  <td className="px-3 sm:px-6 py-2 sm:py-3 text-right tabular-nums text-xs sm:text-sm w-24 sm:w-40">
                                    {account.debit > 0 ? formatCurrency(account.debit) : ''}
                                  </td>
                                  <td className="px-3 sm:px-6 py-2 sm:py-3 text-right tabular-nums text-xs sm:text-sm w-24 sm:w-40">
                                    {account.credit > 0 ? formatCurrency(account.credit) : ''}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr className="font-bold">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm" colSpan={2}>
                      TOTAL
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-right tabular-nums text-xs sm:text-sm">
                      {formatCurrency(data?.totals?.totalDebits || 0)}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-right tabular-nums text-xs sm:text-sm">
                      {formatCurrency(data?.totals?.totalCredits || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-gray-500">Total Debit Balances</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">
                {formatCurrency(data?.totals?.totalDebits || 0)}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-gray-500">Total Credit Balances</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">
                {formatCurrency(data?.totals?.totalCredits || 0)}
              </p>
            </div>
            <div
              className={cn(
                'rounded-xl shadow-sm border p-3 sm:p-4',
                data?.totals?.isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              )}
            >
              <p className="text-xs sm:text-sm text-gray-500">Difference</p>
              <p
                className={cn(
                  'text-lg sm:text-xl font-bold mt-1',
                  data?.totals?.isBalanced ? 'text-green-600' : 'text-red-600'
                )}
              >
                {formatCurrency(Math.abs((data?.totals?.totalDebits || 0) - (data?.totals?.totalCredits || 0)))}
              </p>
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


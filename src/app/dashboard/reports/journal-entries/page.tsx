'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  reference: string;
  description: string;
  type: 'Manual' | 'System' | 'Adjustment' | 'Closing';
  status: 'Draft' | 'Posted' | 'Reversed';
  createdBy: string;
  totalDebit: number;
  totalCredit: number;
  lineItems: Array<{
    id: string;
    accountCode: string;
    accountName: string;
    description: string;
    debit: number;
    credit: number;
  }>;
}

interface JournalEntriesData {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalEntries: number;
    totalDebits: number;
    totalCredits: number;
    draftEntries: number;
    postedEntries: number;
    reversedEntries: number;
  };
  entries: JournalEntry[];
  entryTypes: {
    manual: { count: number; amount: number };
    system: { count: number; amount: number };
    adjustment: { count: number; amount: number };
    closing: { count: number; amount: number };
  };
}

export default function JournalEntriesPage() {
  const [data, setData] = useState<JournalEntriesData | null>(null);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryType, setEntryType] = useState('all');
  const [status, setStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const fetchJournalEntries = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/journal-entries?startDate=${startDate}&endDate=${endDate}&entryType=${entryType}&status=${status}&search=${searchTerm}`
      );
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch journal entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJournalEntries();
  }, [startDate, endDate, entryType, status, searchTerm]);

  const exportToPDF = () => {
    if (!data) return;

    const printHTML = `
      <html>
        <head>
          <title>Journal Entries Report - ${formatDate(data.reportPeriod.startDate)} to ${formatDate(data.reportPeriod.endDate)} - Breco Safaris Ltd</title>
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
              grid-template-columns: repeat(3, 1fr);
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
            .entry-section {
              margin: 30px 0;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              overflow: hidden;
            }
            .entry-header {
              background: #f9fafb;
              padding: 15px;
              border-bottom: 1px solid #e5e7eb;
              display: grid;
              grid-template-columns: 1fr 1fr 1fr 1fr;
              gap: 15px;
            }
            .entry-header-item h5 {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 3px;
              text-transform: uppercase;
            }
            .entry-header-item .value {
              font-size: 14px;
              font-weight: 600;
              color: #1f2937;
            }
            .line-items {
              background: white;
            }
            .line-item {
              display: grid;
              grid-template-columns: 1fr 3fr 1fr 1fr;
              gap: 15px;
              padding: 12px 15px;
              border-bottom: 1px solid #f3f4f6;
            }
            .line-item:last-child {
              border-bottom: none;
            }
            .line-item .account {
              font-size: 13px;
              font-weight: 600;
              color: #1f2937;
            }
            .line-item .description {
              font-size: 13px;
              color: #6b7280;
            }
            .line-item .amount {
              font-size: 13px;
              font-weight: 600;
              text-align: right;
              font-family: 'SF Mono', Consolas, monospace;
            }
            .debit { color: #dc2626; }
            .credit { color: #16a34a; }
            .status-posted { color: #16a34a; }
            .status-draft { color: #d97706; }
            .status-reversed { color: #dc2626; }
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
            <h2>Journal Entries Report</h2>
            <div class="period">
              ${formatDate(data.reportPeriod.startDate)} to ${formatDate(data.reportPeriod.endDate)}
            </div>
          </div>

          <div class="summary">
            <h3>Summary</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <h4>Total Entries</h4>
                <div class="value">${data.summary.totalEntries}</div>
              </div>
              <div class="summary-item">
                <h4>Total Debits</h4>
                <div class="value">${formatCurrency(data.summary.totalDebits)}</div>
              </div>
              <div class="summary-item">
                <h4>Total Credits</h4>
                <div class="value">${formatCurrency(data.summary.totalCredits)}</div>
              </div>
            </div>
          </div>

          ${data.entries.map(entry => `
            <div class="entry-section">
              <div class="entry-header">
                <div class="entry-header-item">
                  <h5>Entry #</h5>
                  <div class="value">${entry.entryNumber}</div>
                </div>
                <div class="entry-header-item">
                  <h5>Date</h5>
                  <div class="value">${formatDate(entry.date)}</div>
                </div>
                <div class="entry-header-item">
                  <h5>Type</h5>
                  <div class="value">${entry.type}</div>
                </div>
                <div class="entry-header-item">
                  <h5>Status</h5>
                  <div class="value status-${entry.status.toLowerCase()}">${entry.status}</div>
                </div>
              </div>
              <div class="line-items">
                <div style="padding: 10px 15px; background: #f9fafb; font-size: 14px; font-weight: 600; color: #1f2937;">
                  ${entry.description}
                </div>
                ${entry.lineItems.map(line => `
                  <div class="line-item">
                    <div class="account">${line.accountCode}</div>
                    <div class="description">${line.accountName} - ${line.description}</div>
                    <div class="amount debit">${line.debit > 0 ? formatCurrency(line.debit) : ''}</div>
                    <div class="amount credit">${line.credit > 0 ? formatCurrency(line.credit) : ''}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Posted':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'Draft':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Reversed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Posted':
        return <CheckCircleIcon className="w-4 h-4" />;
      case 'Draft':
        return <ClockIcon className="w-4 h-4" />;
      case 'Reversed':
        return <XCircleIcon className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Manual':
        return 'text-blue-600 bg-blue-50';
      case 'System':
        return 'text-green-600 bg-green-50';
      case 'Adjustment':
        return 'text-orange-600 bg-orange-50';
      case 'Closing':
        return 'text-purple-600 bg-purple-50';
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
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Journal Entries</h1>
            <p className="text-sm sm:text-base text-gray-600">Complete record of all accounting transactions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToPDF}
            disabled={!data}
            className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowDownTrayIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Export PDF</span>
            <span className="sm:hidden">Export</span>
          </button>
          <Link
            href="/dashboard/journal-entries/new"
            className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-breco-navy text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-breco-navy/90"
          >
            <PlusIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">New Entry</span>
            <span className="sm:hidden">New</span>
          </Link>
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
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Entry Type</label>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="all">All Types</option>
              <option value="Manual">Manual</option>
              <option value="System">System</option>
              <option value="Adjustment">Adjustment</option>
              <option value="Closing">Closing</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="all">All Status</option>
              <option value="Posted">Posted</option>
              <option value="Draft">Draft</option>
              <option value="Reversed">Reversed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Entry #, reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 pl-8 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
              />
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-2 top-2" />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchJournalEntries}
              disabled={isLoading}
              className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-breco-navy text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-breco-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-breco-navy mx-auto"></div>
          <p className="text-gray-500 mt-4 text-sm sm:text-base">Loading journal entries...</p>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
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
                <ArrowDownTrayIcon className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Debits</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.totalDebits || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ArrowDownTrayIcon className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 rotate-180" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Credits</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.totalCredits || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CheckCircleIcon className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Posted</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{data?.summary?.postedEntries || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ClockIcon className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Draft</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{data?.summary?.draftEntries || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <XCircleIcon className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Reversed</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{data?.summary?.reversedEntries || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Journal Entries List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Journal Entries</h3>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {(data?.entries?.length || 0) === 0 ? (
                <div className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">
                  No journal entries found for the selected period
                </div>
              ) : (
                (data?.entries || []).map((entry) => (
                  <div key={entry.id} className="p-3 sm:p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{entry.entryNumber}</span>
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border',
                            getStatusColor(entry.status)
                          )}>
                            {getStatusIcon(entry.status)}
                            {entry.status}
                          </span>
                        </div>
                        <span className={cn(
                          'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                          getTypeColor(entry.type)
                        )}>
                          {entry.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                        <span>{formatDate(entry.date)}</span>
                        <button
                          onClick={() => setShowDetails(showDetails === entry.id ? null : entry.id)}
                          className="text-breco-navy hover:text-breco-navy/80"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-500">Description</p>
                        <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Reference</p>
                        <p className="text-sm text-gray-700">{entry.reference}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Created By</p>
                        <p className="text-sm text-gray-700">{entry.createdBy}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex gap-4">
                        <span className="text-red-600 font-medium">
                          Debit: {formatCurrency(entry.totalDebit)}
                        </span>
                        <span className="text-green-600 font-medium">
                          Credit: {formatCurrency(entry.totalCredit)}
                        </span>
                      </div>
                      <span className="text-gray-500">{entry.lineItems.length} line items</span>
                    </div>

                    {/* Entry Details */}
                    {showDetails === entry.id && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <div className="space-y-2">
                          {entry.lineItems.map((line) => (
                            <div key={line.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 py-2 px-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="text-xs text-gray-500">Account</p>
                                <p className="text-sm font-medium text-gray-900">{line.accountCode}</p>
                                <p className="text-xs text-gray-600">{line.accountName}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Description</p>
                                <p className="text-sm text-gray-700">{line.description}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Debit</p>
                                <p className="text-sm font-medium text-red-600 tabular-nums">
                                  {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Credit</p>
                                <p className="text-sm font-medium text-green-600 tabular-nums">
                                  {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-sm sm:text-base">Loading journal entries...</p>
        </div>
      )}
    </div>
  );
}

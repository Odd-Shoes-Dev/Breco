'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BanknotesIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, cn } from '@/lib/utils';

interface CashFlowData {
  period: {
    startDate: string;
    endDate: string;
  };
  operatingActivities: {
    netIncome: number;
    adjustments: Array<{ label: string; amount: number }>;
    changesInWorkingCapital: Array<{ label: string; amount: number }>;
    netCashFromOperating: number;
  };
  investingActivities: {
    items: Array<{ label: string; amount: number }>;
    netCashFromInvesting: number;
  };
  financingActivities: {
    items: Array<{ label: string; amount: number }>;
    netCashFromFinancing: number;
  };
  netChangeInCash: number;
  beginningCash: number;
  endingCash: number;
}

export default function CashFlowPage() {
  const [data, setData] = useState<CashFlowData | null>(null);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/cash-flow?startDate=${startDate}&endDate=${endDate}`
      );
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch cash flow:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!data) return;

    const printHTML = `
      <html>
        <head>
          <title>Cash Flow Statement - Breco Safaris Ltd</title>
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
            .report-title .period { 
              font-size: 16px; 
              color: #6b7280;
            }
            .section { 
              margin: 25px 0;
            }
            .section-title { 
              font-size: 18px; 
              font-weight: bold; 
              color: #1e3a5f;
              margin-bottom: 15px;
              padding-bottom: 8px;
              border-bottom: 1px solid #e5e7eb;
            }
            .line-item { 
              display: flex; 
              justify-content: space-between; 
              padding: 6px 0;
              font-size: 14px;
            }
            .line-item.indent { 
              padding-left: 20px;
              color: #6b7280;
            }
            .line-item.total { 
              font-weight: bold; 
              border-top: 2px solid #374151;
              margin-top: 8px;
              padding-top: 8px;
            }
            .line-item.final-total { 
              font-size: 16px;
              background: #f9fafb;
              padding: 12px 8px;
              margin-top: 20px;
              border: 2px solid #1e3a5f;
              color: #1e3a5f;
            }
            .amount { 
              font-family: 'SF Mono', Consolas, monospace;
              min-width: 120px;
              text-align: right;
            }
            .negative { 
              color: #dc2626;
            }
            .summary-section {
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              margin-top: 25px;
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
              <div class="address">Kampala Road Plot 14 Eagen House, Russel Street, P.O.Box 144011, Kampala, Uganda</div>
              <div class="address">Tel: +256 782 884 933, +256 772 891 729 • Email: brecosafaris@gmail.com</div>
              <div class="address">URA TIN: 1014756280 • URSB Reg. No: 80020001634842</div>
            </div>
          </div>
          
          <div class="report-title">
            <h2>Statement of Cash Flow</h2>
            <div class="period">
              For the Period ${new Date(data.period.startDate).toLocaleDateString()} to ${new Date(data.period.endDate).toLocaleDateString()}
            </div>
          </div>

          <div class="section">
            <div class="section-title">CASH FLOW FROM OPERATING ACTIVITIES</div>
            <div class="line-item">
              <span>Net Income</span>
              <span class="amount">${data.operatingActivities.netIncome >= 0 ? formatCurrency(data.operatingActivities.netIncome) : `(${formatCurrency(Math.abs(data.operatingActivities.netIncome))})`}</span>
            </div>
            ${data.operatingActivities.adjustments.map(item => `
              <div class="line-item indent">
                <span>${item.label}</span>
                <span class="amount">${item.amount >= 0 ? formatCurrency(item.amount) : `(${formatCurrency(Math.abs(item.amount))})`}</span>
              </div>
            `).join('')}
            ${data.operatingActivities.changesInWorkingCapital.map(item => `
              <div class="line-item indent">
                <span>${item.label}</span>
                <span class="amount">${item.amount >= 0 ? formatCurrency(item.amount) : `(${formatCurrency(Math.abs(item.amount))})`}</span>
              </div>
            `).join('')}
            <div class="line-item total">
              <span>Net Cash from Operating Activities</span>
              <span class="amount">${data.operatingActivities.netCashFromOperating >= 0 ? formatCurrency(data.operatingActivities.netCashFromOperating) : `(${formatCurrency(Math.abs(data.operatingActivities.netCashFromOperating))})`}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">CASH FLOW FROM INVESTING ACTIVITIES</div>
            ${data.investingActivities.items.map(item => `
              <div class="line-item">
                <span>${item.label}</span>
                <span class="amount">${item.amount >= 0 ? formatCurrency(item.amount) : `(${formatCurrency(Math.abs(item.amount))})`}</span>
              </div>
            `).join('')}
            <div class="line-item total">
              <span>Net Cash from Investing Activities</span>
              <span class="amount">${data.investingActivities.netCashFromInvesting >= 0 ? formatCurrency(data.investingActivities.netCashFromInvesting) : `(${formatCurrency(Math.abs(data.investingActivities.netCashFromInvesting))})`}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">CASH FLOW FROM FINANCING ACTIVITIES</div>
            ${data.financingActivities.items.map(item => `
              <div class="line-item">
                <span>${item.label}</span>
                <span class="amount">${item.amount >= 0 ? formatCurrency(item.amount) : `(${formatCurrency(Math.abs(item.amount))})`}</span>
              </div>
            `).join('')}
            <div class="line-item total">
              <span>Net Cash from Financing Activities</span>
              <span class="amount">${data.financingActivities.netCashFromFinancing >= 0 ? formatCurrency(data.financingActivities.netCashFromFinancing) : `(${formatCurrency(Math.abs(data.financingActivities.netCashFromFinancing))})`}</span>
            </div>
          </div>

          <div class="summary-section">
            <div class="line-item">
              <span>Net Change in Cash</span>
              <span class="amount">${data.netChangeInCash >= 0 ? formatCurrency(data.netChangeInCash) : `(${formatCurrency(Math.abs(data.netChangeInCash))})`}</span>
            </div>
            <div class="line-item">
              <span>Beginning Cash Balance</span>
              <span class="amount">${formatCurrency(data.beginningCash)}</span>
            </div>
            <div class="line-item final-total">
              <span>Ending Cash Balance</span>
              <span class="amount">${formatCurrency(data.endingCash)}</span>
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

  const renderAmount = (amount: number) => (
    <span className={cn('tabular-nums', amount < 0 ? 'text-red-600' : 'text-gray-900')}>
      {amount < 0 ? `(${formatCurrency(Math.abs(amount))})` : formatCurrency(amount)}
    </span>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/dashboard/reports" className="btn-ghost p-1.5 sm:p-2">
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Cash Flow Statement</h1>
            <p className="text-sm sm:text-base text-gray-600">Track cash inflows and outflows</p>
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

      {/* Date Range */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <label className="text-xs sm:text-sm font-medium text-gray-700">Date Range:</label>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-1">
            <div className="flex-1 min-w-0">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full px-2 sm:px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full px-2 sm:px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
              />
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f] mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading cash flow statement...</p>
        </div>
      ) : data ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Report Header */}
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2 sm:gap-3">
              <BanknotesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-breco-navy" />
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-gray-900">Breco Safaris Ltd</h2>
                <p className="text-xs sm:text-sm text-gray-600">
                  Statement of Cash Flow for the period{' '}
                  {new Date(data.period.startDate).toLocaleDateString()} to{' '}
                  {new Date(data.period.endDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-6 space-y-6 sm:space-y-8">
            {/* Operating Activities */}
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-200 flex items-center gap-1 sm:gap-2">
                <ArrowTrendingUpIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                <span className="text-xs sm:text-sm lg:text-base">CASH FLOW FROM OPERATING ACTIVITIES</span>
              </h3>

              <div className="space-y-1 sm:space-y-2">
                <div className="flex justify-between items-center py-1 text-xs sm:text-sm">
                  <span className="text-gray-700 pr-2">Net Income</span>
                  <span className="font-medium tabular-nums text-right">
                    {formatCurrency(data.operatingActivities.netIncome)}
                  </span>
                </div>

                <div className="mt-2 sm:mt-3 mb-1 sm:mb-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    Adjustments for non-cash items:
                  </p>
                </div>
                {data.operatingActivities.adjustments.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-1 text-xs sm:text-sm pl-3 sm:pl-4">
                    <span className="text-gray-600 pr-2">{item.label}</span>
                    <span className="tabular-nums text-right">{renderAmount(item.amount)}</span>
                  </div>
                ))}

                <div className="mt-2 sm:mt-3 mb-1 sm:mb-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    Changes in working capital:
                  </p>
                </div>
                {data.operatingActivities.changesInWorkingCapital.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-1 text-xs sm:text-sm pl-3 sm:pl-4">
                    <span className="text-gray-600 pr-2">{item.label}</span>
                    <span className="tabular-nums text-right">{renderAmount(item.amount)}</span>
                  </div>
                ))}

                <div className="flex justify-between items-center py-2 sm:py-3 mt-2 sm:mt-3 border-t-2 border-gray-300 font-semibold text-xs sm:text-sm">
                  <span className="text-gray-900 pr-2">Net Cash from Operating Activities</span>
                  <span className="tabular-nums text-right">{renderAmount(data.operatingActivities.netCashFromOperating)}</span>
                </div>
              </div>
            </div>

            {/* Investing Activities */}
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-200 flex items-center gap-1 sm:gap-2">
                <ArrowTrendingDownIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                <span className="text-xs sm:text-sm lg:text-base">CASH FLOW FROM INVESTING ACTIVITIES</span>
              </h3>

              <div className="space-y-1 sm:space-y-2">
                {data.investingActivities.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-1 text-xs sm:text-sm">
                    <span className="text-gray-600 pr-2">{item.label}</span>
                    <span className="tabular-nums text-right">{renderAmount(item.amount)}</span>
                  </div>
                ))}

                <div className="flex justify-between items-center py-2 sm:py-3 mt-2 sm:mt-3 border-t-2 border-gray-300 font-semibold text-xs sm:text-sm">
                  <span className="text-gray-900 pr-2">Net Cash from Investing Activities</span>
                  <span className="tabular-nums text-right">{renderAmount(data.investingActivities.netCashFromInvesting)}</span>
                </div>
              </div>
            </div>

            {/* Financing Activities */}
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-200 flex items-center gap-1 sm:gap-2">
                <BanknotesIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                <span className="text-xs sm:text-sm lg:text-base">CASH FLOW FROM FINANCING ACTIVITIES</span>
              </h3>

              <div className="space-y-1 sm:space-y-2">
                {data.financingActivities.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-1 text-xs sm:text-sm">
                    <span className="text-gray-600 pr-2">{item.label}</span>
                    <span className="tabular-nums text-right">{renderAmount(item.amount)}</span>
                  </div>
                ))}

                <div className="flex justify-between items-center py-2 sm:py-3 mt-2 sm:mt-3 border-t-2 border-gray-300 font-semibold text-xs sm:text-sm">
                  <span className="text-gray-900 pr-2">Net Cash from Financing Activities</span>
                  <span className="tabular-nums text-right">{renderAmount(data.financingActivities.netCashFromFinancing)}</span>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3">
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-gray-700 pr-2">Net Change in Cash</span>
                <span className="font-semibold tabular-nums text-right">
                  {renderAmount(data.netChangeInCash)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-gray-700 pr-2">Beginning Cash Balance</span>
                <span className="tabular-nums text-right">{formatCurrency(data.beginningCash)}</span>
              </div>
              <div className="flex justify-between items-center text-sm sm:text-lg font-bold pt-2 sm:pt-3 border-t border-gray-200">
                <span className="text-breco-navy pr-2">Ending Cash Balance</span>
                <span className="text-breco-navy tabular-nums text-right">
                  {formatCurrency(data.endingCash)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-gray-500">No data available</p>
        </div>
      )}
    </div>
  );
}


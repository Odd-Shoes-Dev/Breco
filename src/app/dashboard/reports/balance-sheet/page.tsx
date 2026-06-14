'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ScaleIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency as fmtCurrency, formatDate } from '@/lib/utils';

interface BalanceSheetData {
  asOfDate: string;
  currency: string;
  assets: {
    current: Array<{ account: string; balance: number }>;
    fixed: Array<{ account: string; balance: number }>;
    totalCurrent: number;
    totalFixed: number;
    totalAssets: number;
  };
  liabilities: {
    current: Array<{ account: string; balance: number }>;
    longTerm: Array<{ account: string; balance: number }>;
    totalCurrent: number;
    totalLongTerm: number;
    totalLiabilities: number;
  };
  equity: {
    items: Array<{ account: string; balance: number }>;
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
}

export default function BalanceSheetPage() {
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [asOfDate]);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reports/balance-sheet?asOfDate=${asOfDate}`);
      const result = await response.json();
      setData(result.data);
    } catch (error) {
      console.error('Failed to fetch balance sheet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => fmtCurrency(amount, data?.currency || 'UGX');

  const exportToPDF = () => {
    if (!data) return;

    // Generate clean HTML for printing
    const printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Balance Sheet - ${formatDate(asOfDate)}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 40px;
            color: #000;
            background: white;
            line-height: 1.4;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            margin-bottom: 40px; 
            padding-bottom: 20px;
            border-bottom: 2px solid #1e3a5f;
          }
          .logo-section { 
            display: flex; 
            align-items: center; 
            gap: 15px; 
          }
          .logo { 
            width: 150px; 
            height: auto; 
            object-fit: contain;
          }
          .company-info { 
            display: flex; 
            flex-direction: column; 
          }
          .company-name { 
            font-size: 24px; 
            font-weight: bold; 
            color: #1e3a5f; 
            margin-bottom: 4px; 
          }
          .company-address { 
            font-size: 12px; 
            color: #666; 
            margin-bottom: 2px; 
          }
          .company-contact { 
            font-size: 12px; 
            color: #666; 
          }
          .report-info { 
            text-align: right; 
          }
          .report-title { 
            font-size: 28px; 
            font-weight: bold; 
            color: #1e3a5f; 
            margin-bottom: 8px; 
          }
          .report-date { 
            font-size: 14px; 
            color: #666; 
          }
          .section { margin-bottom: 25px; }
          .section-title { 
            font-size: 16px; 
            font-weight: bold; 
            margin-bottom: 15px; 
            border-bottom: 2px solid #000;
            padding-bottom: 5px;
          }
          .subsection-title { 
            font-size: 14px; 
            font-weight: 600; 
            margin: 15px 0 8px 0; 
          }
          .line-item { 
            display: flex; 
            justify-content: space-between; 
            padding: 2px 0; 
            margin-left: 20px;
          }
          .total-line { 
            display: flex; 
            justify-content: space-between; 
            padding: 5px 0; 
            margin-left: 20px;
            border-top: 1px solid #ccc;
            font-weight: 600;
          }
          .section-total { 
            display: flex; 
            justify-content: space-between; 
            padding: 8px 15px; 
            background: #f5f5f5;
            font-weight: bold;
            margin: 10px 0;
          }
          .final-total { 
            display: flex; 
            justify-content: space-between; 
            padding: 12px 15px; 
            background: #e3f2fd;
            font-weight: bold;
            font-size: 16px;
            border: 2px solid #1976d2;
            margin: 15px 0;
          }
          .no-items { 
            margin-left: 20px; 
            font-style: italic; 
            color: #666; 
          }
          @media print {
            body { margin: 20px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .header { border-bottom-color: #1e3a5f !important; }
            .company-name { color: #1e3a5f !important; }
            .report-title { color: #1e3a5f !important; }
            .logo { width: 150px; height: auto; object-fit: contain; }
            .section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-section">
            <img src="/assets/logo.jpg" alt="Breco Safaris Ltd" class="logo">
            <div class="company-info">
              <div class="company-name">Breco Safaris Ltd</div>
              <div class="company-address">Kampala Road Plot 14 Eagen House, Russel Street, P.O.Box 144011, Kampala, Uganda</div>
              <div class="company-contact">Tel: +256 782 884 933, +256 772 891 729 • Email: brecosafaris@gmail.com</div>
              <div class="company-contact">URA TIN: 1014756280 • URSB Reg. No: 80020001634842</div>
            </div>
          </div>
          <div class="report-info">
            <div class="report-title">Balance Sheet</div>
            <div class="report-date">As of ${formatDate(asOfDate)}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">ASSETS</div>
          
          <div class="subsection-title">Current Assets</div>
          ${data.assets?.current?.length ? 
            data.assets.current.map(item => 
              `<div class="line-item">
                <span>${item.account}</span>
                <span>${formatCurrency(item.balance)}</span>
              </div>`
            ).join('') : 
            '<div class="no-items">No current assets</div>'
          }
          <div class="total-line">
            <span>Total Current Assets</span>
            <span>${formatCurrency(data.assets?.totalCurrent || 0)}</span>
          </div>

          <div class="subsection-title">Fixed Assets</div>
          ${data.assets?.fixed?.length ? 
            data.assets.fixed.map(item => 
              `<div class="line-item">
                <span>${item.account}</span>
                <span>${formatCurrency(item.balance)}</span>
              </div>`
            ).join('') : 
            '<div class="no-items">No fixed assets</div>'
          }
          <div class="total-line">
            <span>Total Fixed Assets</span>
            <span>${formatCurrency(data.assets?.totalFixed || 0)}</span>
          </div>

          <div class="section-total">
            <span>TOTAL ASSETS</span>
            <span>${formatCurrency(data.assets?.totalAssets || 0)}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">LIABILITIES</div>
          
          <div class="subsection-title">Current Liabilities</div>
          ${data.liabilities?.current?.length ? 
            data.liabilities.current.map(item => 
              `<div class="line-item">
                <span>${item.account}</span>
                <span>${formatCurrency(item.balance)}</span>
              </div>`
            ).join('') : 
            '<div class="no-items">No current liabilities</div>'
          }
          <div class="total-line">
            <span>Total Current Liabilities</span>
            <span>${formatCurrency(data.liabilities?.totalCurrent || 0)}</span>
          </div>

          <div class="subsection-title">Long-Term Liabilities</div>
          ${data.liabilities?.longTerm?.length ? 
            data.liabilities.longTerm.map(item => 
              `<div class="line-item">
                <span>${item.account}</span>
                <span>${formatCurrency(item.balance)}</span>
              </div>`
            ).join('') : 
            '<div class="no-items">No long-term liabilities</div>'
          }
          <div class="total-line">
            <span>Total Long-Term Liabilities</span>
            <span>${formatCurrency(data.liabilities?.totalLongTerm || 0)}</span>
          </div>

          <div class="section-total">
            <span>TOTAL LIABILITIES</span>
            <span>${formatCurrency(data.liabilities?.totalLiabilities || 0)}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">EQUITY</div>
          
          ${data.equity?.items?.length ? 
            data.equity.items.map(item => 
              `<div class="line-item">
                <span>${item.account}</span>
                <span>${formatCurrency(item.balance)}</span>
              </div>`
            ).join('') : 
            '<div class="no-items">No equity items</div>'
          }

          <div class="section-total">
            <span>TOTAL EQUITY</span>
            <span>${formatCurrency(data.equity?.totalEquity || 0)}</span>
          </div>
        </div>

        <div class="final-total">
          <span>TOTAL LIABILITIES & EQUITY</span>
          <span>${formatCurrency(data.totalLiabilitiesAndEquity || 0)}</span>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/dashboard/reports" className="btn-ghost p-1.5 sm:p-2">
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Balance Sheet</h1>
            <p className="text-sm sm:text-base text-gray-600">Financial position as of a specific date</p>
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
            className="flex-1 sm:flex-initial rounded-lg border border-gray-300 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f] mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading balance sheet...</p>
        </div>
      ) : data ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Report Header */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-3">
              <ScaleIcon className="w-6 h-6 text-[#52b53b]" />
              <div>
                <h2 className="font-semibold text-gray-900">Breco Safaris Ltd</h2>
                <p className="text-sm text-gray-600">Balance Sheet as of {formatDate(data.asOfDate)}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* Assets Section */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-200">
                ASSETS
              </h3>

              {/* Current Assets */}
              <div className="mb-3 sm:mb-4">
                <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Current Assets</h4>
                <div className="space-y-1">
                  {data.assets?.current?.map((item, index) => (
                    <div key={index} className="flex justify-between py-1 text-xs sm:text-sm">
                      <span className="text-gray-600 pl-3 sm:pl-4 min-w-0 flex-1 mr-2">{item.account}</span>
                      <span className="text-gray-900 font-medium tabular-nums flex-shrink-0">
                        {formatCurrency(item.balance)}
                      </span>
                    </div>
                  )) || (
                    <div className="text-xs sm:text-sm text-gray-500 italic pl-3 sm:pl-4">No current assets</div>
                  )}
                </div>
                <div className="flex justify-between py-2 mt-2 border-t border-gray-100">
                  <span className="text-xs sm:text-sm font-medium text-gray-700 pl-3 sm:pl-4">Total Current Assets</span>
                  <span className="text-xs sm:text-sm font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(data.assets?.totalCurrent || 0)}
                  </span>
                </div>
              </div>

              {/* Fixed Assets */}
              <div className="mb-3 sm:mb-4">
                <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Fixed Assets</h4>
                <div className="space-y-1">
                  {data.assets?.fixed?.map((item, index) => (
                    <div key={index} className="flex justify-between py-1 text-xs sm:text-sm">
                      <span className="text-gray-600 pl-3 sm:pl-4 min-w-0 flex-1 mr-2">{item.account}</span>
                      <span className="text-gray-900 font-medium tabular-nums flex-shrink-0">
                        {formatCurrency(item.balance)}
                      </span>
                    </div>
                  )) || (
                    <div className="text-xs sm:text-sm text-gray-500 italic pl-3 sm:pl-4">No fixed assets</div>
                  )}
                </div>
                <div className="flex justify-between py-2 mt-2 border-t border-gray-100">
                  <span className="text-xs sm:text-sm font-medium text-gray-700 pl-3 sm:pl-4">Total Fixed Assets</span>
                  <span className="text-xs sm:text-sm font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(data.assets?.totalFixed || 0)}
                  </span>
                </div>
              </div>

              {/* Total Assets */}
              <div className="flex justify-between py-2.5 sm:py-3 border-t-2 border-gray-300 bg-gray-50 px-3 sm:px-4 -mx-3 sm:-mx-4 mt-3 sm:mt-4">
                <span className="text-sm sm:text-base font-bold text-gray-900">TOTAL ASSETS</span>
                <span className="text-sm sm:text-base font-bold text-gray-900 tabular-nums">
                  {formatCurrency(data.assets?.totalAssets || 0)}
                </span>
              </div>
            </div>

            {/* Liabilities Section */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-200">
                LIABILITIES
              </h3>

              {/* Current Liabilities */}
              <div className="mb-3 sm:mb-4">
                <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Current Liabilities</h4>
                <div className="space-y-1">
                  {data.liabilities?.current?.map((item, index) => (
                    <div key={index} className="flex justify-between py-1 text-xs sm:text-sm">
                      <span className="text-gray-600 pl-3 sm:pl-4 min-w-0 flex-1 mr-2">{item.account}</span>
                      <span className="text-gray-900 font-medium tabular-nums flex-shrink-0">
                        {formatCurrency(item.balance)}
                      </span>
                    </div>
                  )) || (
                    <div className="text-xs sm:text-sm text-gray-500 italic pl-3 sm:pl-4">No current liabilities</div>
                  )}
                </div>
                <div className="flex justify-between py-2 mt-2 border-t border-gray-100">
                  <span className="text-xs sm:text-sm font-medium text-gray-700 pl-3 sm:pl-4">Total Current Liabilities</span>
                  <span className="text-xs sm:text-sm font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(data.liabilities?.totalCurrent || 0)}
                  </span>
                </div>
              </div>

              {/* Long-Term Liabilities */}
              <div className="mb-3 sm:mb-4">
                <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Long-Term Liabilities</h4>
                <div className="space-y-1">
                  {data.liabilities?.longTerm?.map((item, index) => (
                    <div key={index} className="flex justify-between py-1 text-xs sm:text-sm">
                      <span className="text-gray-600 pl-3 sm:pl-4 min-w-0 flex-1 mr-2">{item.account}</span>
                      <span className="text-gray-900 font-medium tabular-nums flex-shrink-0">
                        {formatCurrency(item.balance)}
                      </span>
                    </div>
                  )) || (
                    <div className="text-xs sm:text-sm text-gray-500 italic pl-3 sm:pl-4">No long-term liabilities</div>
                  )}
                </div>
                <div className="flex justify-between py-2 mt-2 border-t border-gray-100">
                  <span className="text-xs sm:text-sm font-medium text-gray-700 pl-3 sm:pl-4">Total Long-Term Liabilities</span>
                  <span className="text-xs sm:text-sm font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(data.liabilities?.totalLongTerm || 0)}
                  </span>
                </div>
              </div>

              {/* Total Liabilities */}
              <div className="flex justify-between py-2.5 sm:py-3 border-t-2 border-gray-300 bg-gray-50 px-3 sm:px-4 -mx-3 sm:-mx-4 mt-3 sm:mt-4">
                <span className="text-sm sm:text-base font-bold text-gray-900">TOTAL LIABILITIES</span>
                <span className="text-sm sm:text-base font-bold text-gray-900 tabular-nums">
                  {formatCurrency(data.liabilities?.totalLiabilities || 0)}
                </span>
              </div>
            </div>

            {/* Equity Section */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-200">
                EQUITY
              </h3>

              <div className="space-y-1">
                {data.equity?.items?.map((item, index) => (
                  <div key={index} className="flex justify-between py-1 text-xs sm:text-sm">
                    <span className="text-gray-600 pl-3 sm:pl-4 min-w-0 flex-1 mr-2">{item.account}</span>
                    <span className="text-gray-900 font-medium tabular-nums flex-shrink-0">
                      {formatCurrency(item.balance)}
                    </span>
                  </div>
                )) || (
                  <div className="text-xs sm:text-sm text-gray-500 italic pl-3 sm:pl-4">No equity items</div>
                )}
              </div>

              {/* Total Equity */}
              <div className="flex justify-between py-2.5 sm:py-3 border-t-2 border-gray-300 bg-gray-50 px-3 sm:px-4 -mx-3 sm:-mx-4 mt-3 sm:mt-4">
                <span className="text-sm sm:text-base font-bold text-gray-900">TOTAL EQUITY</span>
                <span className="text-sm sm:text-base font-bold text-gray-900 tabular-nums">
                  {formatCurrency(data.equity?.totalEquity || 0)}
                </span>
              </div>
            </div>

            {/* Total Liabilities and Equity */}
            <div className="flex justify-between py-3 sm:py-4 border-t-4 border-double border-[#52b53b] bg-[#52b53b]/5 px-3 sm:px-4 -mx-3 sm:-mx-4 rounded-lg">
              <span className="text-base sm:text-lg font-bold text-[#52b53b]">TOTAL LIABILITIES & EQUITY</span>
              <span className="text-base sm:text-lg font-bold text-[#52b53b] tabular-nums">
                {formatCurrency(data.totalLiabilitiesAndEquity || 0)}
              </span>
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


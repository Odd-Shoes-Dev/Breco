'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

interface ReportLine {
  code: string;
  name: string;
  amount: number;
}

interface ProfitLossData {
  period: { startDate: string; endDate: string };
  revenue: { items: ReportLine[]; total: number };
  costOfSales: { items: ReportLine[]; total: number };
  grossProfit: number;
  operatingExpenses: { items: ReportLine[]; total: number };
  operatingIncome: number;
  otherExpenses: { items: ReportLine[]; total: number };
  netIncome: number;
}

export default function ProfitLossReportPage() {
  const [data, setData] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    loadReport();
  }, [startDate, endDate]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports/profit-loss?start_date=${startDate}&end_date=${endDate}`);
      const json = await res.json();
      if (json.data) {
        setData(json.data);
      }
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, 'USD');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const setPresetPeriod = (preset: string) => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (preset) {
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisQuarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'lastYear':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        return;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handlePrint = () => {
    if (!data) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(generatePrintHTML());
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleExport = () => {
    if (!data) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(generatePrintHTML());
    printWindow.document.close();
  };

  const generatePrintHTML = () => {
    if (!data) return '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Profit & Loss - ${formatDate(startDate)} to ${formatDate(endDate)}</title>
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
            height: 30px; 
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
          .line-item { 
            display: flex; 
            justify-content: space-between; 
            padding: 2px 0; 
            margin-left: 20px;
          }
          .section-total { 
            display: flex; 
            justify-content: space-between; 
            padding: 8px 15px; 
            background: #f5f5f5;
            font-weight: bold;
            margin: 10px 0;
          }
          .gross-profit { 
            display: flex; 
            justify-content: space-between; 
            padding: 12px 15px; 
            background: #e8f5e9;
            font-weight: bold;
            font-size: 16px;
            border: 2px solid #4caf50;
            margin: 15px 0;
          }
          .net-income { 
            display: flex; 
            justify-content: space-between; 
            padding: 12px 15px; 
            background: #e3f2fd;
            font-weight: bold;
            font-size: 18px;
            border: 2px solid #1976d2;
            margin: 15px 0;
          }
          .negative { color: #d32f2f; }
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
            .logo { width: 150px; height: 30px; }
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
              <div class="company-address">121 Bedford Street, Waltham, MA 02453</div>
              <div class="company-contact">Phone: 857-384-2899</div>
              <div class="company-contact">Director: N.Maureen</div>
            </div>
          </div>
          <div class="report-info">
            <div class="report-title">Profit & Loss Statement</div>
            <div class="report-date">${formatDate(startDate)} - ${formatDate(endDate)}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">REVENUE</div>
          ${data.revenue?.items?.length ? 
            data.revenue.items.map(item => 
              `<div class="line-item">
                <span>${item.name}</span>
                <span>${formatCurrency(item.amount)}</span>
              </div>`
            ).join('') : 
            '<div class="no-items">No revenue recorded</div>'
          }
          <div class="section-total">
            <span>Total Revenue</span>
            <span>${formatCurrency(data.revenue?.total || 0)}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">COST OF SALES</div>
          ${data.costOfSales?.items?.length ? 
            data.costOfSales.items.map(item => 
              `<div class="line-item">
                <span>${item.name}</span>
                <span>${formatCurrency(item.amount)}</span>
              </div>`
            ).join('') : 
            '<div class="no-items">No cost of sales recorded</div>'
          }
          <div class="section-total">
            <span>Total Cost of Sales</span>
            <span>${formatCurrency(data.costOfSales?.total || 0)}</span>
          </div>
        </div>

        <div class="gross-profit">
          <span>GROSS PROFIT</span>
          <span class="${data.grossProfit < 0 ? 'negative' : ''}">${formatCurrency(data.grossProfit || 0)}</span>
        </div>

        <div class="section">
          <div class="section-title">OPERATING EXPENSES</div>
          ${data.operatingExpenses?.items?.length ? 
            data.operatingExpenses.items.map(item => 
              `<div class="line-item">
                <span>${item.name}</span>
                <span>${formatCurrency(item.amount)}</span>
              </div>`
            ).join('') : 
            '<div class="no-items">No operating expenses</div>'
          }
          <div class="section-total">
            <span>Total Operating Expenses</span>
            <span>${formatCurrency(data.operatingExpenses?.total || 0)}</span>
          </div>
        </div>

        <div class="section-total">
          <span>OPERATING INCOME</span>
          <span class="${data.operatingIncome < 0 ? 'negative' : ''}">${formatCurrency(data.operatingIncome || 0)}</span>
        </div>

        <div class="section">
          <div class="section-title">OTHER EXPENSES</div>
          ${data.otherExpenses?.items?.length ? 
            data.otherExpenses.items.map(item => 
              `<div class="line-item">
                <span>${item.name}</span>
                <span>${formatCurrency(item.amount)}</span>
              </div>`
            ).join('') : 
            '<div class="no-items">No other expenses</div>'
          }
          <div class="section-total">
            <span>Total Other Expenses</span>
            <span>${formatCurrency(data.otherExpenses?.total || 0)}</span>
          </div>
        </div>

        <div class="net-income">
          <span>NET INCOME</span>
          <span class="${data.netIncome < 0 ? 'negative' : ''}">${formatCurrency(data.netIncome || 0)}</span>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/dashboard/reports" className="btn-ghost p-1.5 sm:p-2">
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Profit & Loss Statement</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Income statement for the period</p>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button onClick={handlePrint} className="btn-secondary text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
            <PrinterIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button onClick={handleExport} className="btn-secondary text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
            <ArrowDownTrayIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Date Range */}
      <div className="card">
        <div className="p-3 sm:p-4 lg:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setPresetPeriod('thisMonth')} className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-breco-navy hover:bg-gray-100 rounded-md font-medium transition-colors">
                This Month
              </button>
              <button onClick={() => setPresetPeriod('lastMonth')} className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-breco-navy hover:bg-gray-100 rounded-md font-medium transition-colors">
                Last Month
              </button>
              <button onClick={() => setPresetPeriod('thisQuarter')} className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-breco-navy hover:bg-gray-100 rounded-md font-medium transition-colors">
                This Quarter
              </button>
              <button onClick={() => setPresetPeriod('thisYear')} className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-breco-navy hover:bg-gray-100 rounded-md font-medium transition-colors">
                This Year
              </button>
              <button onClick={() => setPresetPeriod('lastYear')} className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-breco-navy hover:bg-gray-100 rounded-md font-medium transition-colors">
                Last Year
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600" />
        </div>
      ) : data ? (
        <div className="card">
          <div className="p-4 sm:p-6">
            {/* Report Header */}
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Breco Safaris Ltd</h2>
              <p className="text-sm sm:text-base text-gray-600">Profit & Loss Statement</p>
              <p className="text-xs sm:text-sm text-gray-500">
                {formatDate(data.period.startDate)} - {formatDate(data.period.endDate)}
              </p>
            </div>

            {/* Revenue */}
            <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b pb-2 mb-2 sm:mb-3">Revenue</h3>
              {data.revenue.items.length === 0 ? (
                <p className="text-sm text-gray-500 italic pl-3 sm:pl-4">No revenue recorded</p>
              ) : (
                <div className="space-y-1">
                  {data.revenue.items.map((item) => (
                    <div key={item.code} className="flex justify-between pl-3 sm:pl-4">
                      <span className="text-sm sm:text-base text-gray-700 min-w-0 flex-1 mr-2">
                        <span className="text-gray-400 font-mono text-xs sm:text-sm mr-1 sm:mr-2 block sm:inline">{item.code}</span>
                        <span>{item.name}</span>
                      </span>
                      <span className="text-sm sm:text-base font-medium flex-shrink-0">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between mt-2 sm:mt-3 pt-2 border-t text-sm sm:text-base font-semibold">
                <span>Total Revenue</span>
                <span>{formatCurrency(data.revenue.total)}</span>
              </div>
            </div>

            {/* Cost of Sales */}
            <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b pb-2 mb-2 sm:mb-3">Cost of Sales</h3>
              {data.costOfSales.items.length === 0 ? (
                <p className="text-sm text-gray-500 italic pl-3 sm:pl-4">No cost of sales recorded</p>
              ) : (
                <div className="space-y-1">
                  {data.costOfSales.items.map((item) => (
                    <div key={item.code} className="flex justify-between pl-3 sm:pl-4">
                      <span className="text-sm sm:text-base text-gray-700 min-w-0 flex-1 mr-2">
                        <span className="text-gray-400 font-mono text-xs sm:text-sm mr-1 sm:mr-2 block sm:inline">{item.code}</span>
                        <span>{item.name}</span>
                      </span>
                      <span className="text-sm sm:text-base font-medium flex-shrink-0">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between mt-2 sm:mt-3 pt-2 border-t text-sm sm:text-base font-semibold">
                <span>Total Cost of Sales</span>
                <span>{formatCurrency(data.costOfSales.total)}</span>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="flex justify-between py-2.5 sm:py-3 bg-gray-100 rounded-lg px-3 sm:px-4 mb-4 sm:mb-6">
              <span className="text-base sm:text-lg font-bold text-gray-900">Gross Profit</span>
              <span className={`text-base sm:text-lg font-bold ${data.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.grossProfit)}
              </span>
            </div>

            {/* Operating Expenses */}
            <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b pb-2 mb-2 sm:mb-3">Operating Expenses</h3>
              {data.operatingExpenses.items.length === 0 ? (
                <p className="text-sm text-gray-500 italic pl-3 sm:pl-4">No operating expenses recorded</p>
              ) : (
                <div className="space-y-1">
                  {data.operatingExpenses.items.map((item) => (
                    <div key={item.code} className="flex justify-between pl-3 sm:pl-4">
                      <span className="text-sm sm:text-base text-gray-700 min-w-0 flex-1 mr-2">
                        <span className="text-gray-400 font-mono text-xs sm:text-sm mr-1 sm:mr-2 block sm:inline">{item.code}</span>
                        <span>{item.name}</span>
                      </span>
                      <span className="text-sm sm:text-base font-medium flex-shrink-0">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between mt-2 sm:mt-3 pt-2 border-t text-sm sm:text-base font-semibold">
                <span>Total Operating Expenses</span>
                <span>{formatCurrency(data.operatingExpenses.total)}</span>
              </div>
            </div>

            {/* Operating Income */}
            <div className="flex justify-between py-2.5 sm:py-3 bg-gray-100 rounded-lg px-3 sm:px-4 mb-4 sm:mb-6">
              <span className="text-base sm:text-lg font-bold text-gray-900">Operating Income</span>
              <span className={`text-base sm:text-lg font-bold ${data.operatingIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.operatingIncome)}
              </span>
            </div>

            {/* Other Expenses */}
            {data.otherExpenses.items.length > 0 && (
              <div className="mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b pb-2 mb-2 sm:mb-3">Other Expenses</h3>
                <div className="space-y-1">
                  {data.otherExpenses.items.map((item) => (
                    <div key={item.code} className="flex justify-between pl-3 sm:pl-4">
                      <span className="text-sm sm:text-base text-gray-700 min-w-0 flex-1 mr-2">
                        <span className="text-gray-400 font-mono text-xs sm:text-sm mr-1 sm:mr-2 block sm:inline">{item.code}</span>
                        <span>{item.name}</span>
                      </span>
                      <span className="text-sm sm:text-base font-medium flex-shrink-0">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 sm:mt-3 pt-2 border-t text-sm sm:text-base font-semibold">
                  <span>Total Other Expenses</span>
                  <span>{formatCurrency(data.otherExpenses.total)}</span>
                </div>
              </div>
            )}

            {/* Net Income */}
            <div className={`flex justify-between py-3 sm:py-4 rounded-lg px-3 sm:px-4 ${data.netIncome >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <span className="text-lg sm:text-xl font-bold text-gray-900">Net Income</span>
              <span className={`text-lg sm:text-xl font-bold ${data.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(data.netIncome)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body text-center py-12">
            <p className="text-gray-500">No data available for the selected period.</p>
          </div>
        </div>
      )}
    </div>
  );
}


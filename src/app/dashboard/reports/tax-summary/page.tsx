'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalculatorIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ReceiptPercentIcon,
  ChartPieIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface TaxDeduction {
  category: string;
  description: string;
  amount: number;
  deductible: boolean;
}

interface QuarterlyTax {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  period: string;
  estimatedPayment: number;
  actualPayment: number;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'Overdue';
}

interface TaxSummaryData {
  reportPeriod: {
    taxYear: number;
    startDate: string;
    endDate: string;
  };
  income: {
    grossRevenue: number;
    netIncome: number;
    operatingIncome: number;
    otherIncome: number;
    totalTaxableIncome: number;
  };
  deductions: {
    totalDeductions: number;
    businessExpenses: number;
    depreciation: number;
    interestExpenses: number;
    otherDeductions: number;
    itemizedDeductions: TaxDeduction[];
  };
  taxCalculations: {
    taxableIncome: number;
    federalTaxRate: number;
    federalTaxLiability: number;
    stateTaxRate: number;
    stateTaxLiability: number;
    selfEmploymentTax: number;
    totalTaxLiability: number;
    effectiveTaxRate: number;
  };
  payments: {
    quarterlyPayments: QuarterlyTax[];
    totalPaid: number;
    withheld: number;
    refundDue: number;
    balanceDue: number;
  };
  compliance: {
    filingStatus: 'Corporation' | 'Partnership' | 'LLC' | 'Sole Proprietorship';
    ein: string;
    filingDeadline: string;
    extensionFiled: boolean;
    extensionDeadline?: string;
    estimatedPenalty: number;
  };
}

export default function TaxSummaryPage() {
  const [data, setData] = useState<TaxSummaryData | null>(null);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(false);
  const [showDeductionDetails, setShowDeductionDetails] = useState(false);

  const fetchTaxSummary = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reports/tax-summary?taxYear=${taxYear}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch tax summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxSummary();
  }, [taxYear]);

  const exportToPDF = () => {
    if (!data) return;

    const printHTML = `
      <html>
        <head>
          <title>Tax Summary Report - ${data.reportPeriod.taxYear} - Breco Safaris Ltd</title>
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
            .section {
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              margin: 25px 0;
            }
            .section h3 {
              font-size: 18px;
              font-weight: bold;
              color: #1e3a5f;
              margin-bottom: 15px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin-bottom: 20px;
            }
            .summary-item {
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
              margin: 15px 0;
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
            .number { 
              text-align: right;
              font-family: 'SF Mono', Consolas, monospace;
            }
            .status-paid { color: #16a34a; }
            .status-pending { color: #d97706; }
            .status-overdue { color: #dc2626; }
            .total-row { 
              font-weight: bold;
              background: #f3f4f6;
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
              <div class="address">Phone: (857) 384-2899 | EIN: ${data.compliance.ein}</div>
              <div class="address">Director: N.Maureen</div>
            </div>
          </div>
          
          <div class="report-header">
            <h2>Tax Summary Report</h2>
            <div class="period">Tax Year ${data.reportPeriod.taxYear}</div>
          </div>

          <div class="section">
            <h3>Income Summary</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <h4>Gross Revenue</h4>
                <div class="value">${formatCurrency(data.income.grossRevenue)}</div>
              </div>
              <div class="summary-item">
                <h4>Net Income</h4>
                <div class="value">${formatCurrency(data.income.netIncome)}</div>
              </div>
              <div class="summary-item">
                <h4>Operating Income</h4>
                <div class="value">${formatCurrency(data.income.operatingIncome)}</div>
              </div>
              <div class="summary-item">
                <h4>Total Taxable Income</h4>
                <div class="value">${formatCurrency(data.income.totalTaxableIncome)}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Tax Calculations</h3>
            <table>
              <thead>
                <tr>
                  <th>Tax Type</th>
                  <th class="number">Rate</th>
                  <th class="number">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Federal Tax</td>
                  <td class="number">${(data.taxCalculations.federalTaxRate * 100).toFixed(1)}%</td>
                  <td class="number">${formatCurrency(data.taxCalculations.federalTaxLiability)}</td>
                </tr>
                <tr>
                  <td>State Tax</td>
                  <td class="number">${(data.taxCalculations.stateTaxRate * 100).toFixed(1)}%</td>
                  <td class="number">${formatCurrency(data.taxCalculations.stateTaxLiability)}</td>
                </tr>
                <tr>
                  <td>Self-Employment Tax</td>
                  <td class="number">15.3%</td>
                  <td class="number">${formatCurrency(data.taxCalculations.selfEmploymentTax)}</td>
                </tr>
                <tr class="total-row">
                  <td><strong>Total Tax Liability</strong></td>
                  <td class="number"><strong>${(data.taxCalculations.effectiveTaxRate * 100).toFixed(1)}%</strong></td>
                  <td class="number"><strong>${formatCurrency(data.taxCalculations.totalTaxLiability)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <h3>Quarterly Payments</h3>
            <table>
              <thead>
                <tr>
                  <th>Quarter</th>
                  <th>Period</th>
                  <th class="number">Estimated</th>
                  <th class="number">Actual</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${data.payments.quarterlyPayments.map(quarter => `
                  <tr>
                    <td>${quarter.quarter}</td>
                    <td>${quarter.period}</td>
                    <td class="number">${formatCurrency(quarter.estimatedPayment)}</td>
                    <td class="number">${formatCurrency(quarter.actualPayment)}</td>
                    <td>${formatDate(quarter.dueDate)}</td>
                    <td class="status-${quarter.status.toLowerCase()}">${quarter.status}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="3"><strong>Total Paid</strong></td>
                  <td class="number"><strong>${formatCurrency(data.payments.totalPaid)}</strong></td>
                  <td colspan="2"></td>
                </tr>
              </tbody>
            </table>
          </div>
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
      case 'Paid':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'Pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Overdue':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Paid':
        return '✓';
      case 'Pending':
        return '⏳';
      case 'Overdue':
        return '⚠';
      default:
        return '';
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
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Tax Summary</h1>
            <p className="text-sm sm:text-base text-gray-600">Comprehensive tax analysis and compliance overview</p>
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

      {/* Tax Year Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
          <div className="flex-1">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Tax Year</label>
            <select
              value={taxYear}
              onChange={(e) => setTaxYear(parseInt(e.target.value))}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchTaxSummary}
            disabled={isLoading}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-breco-navy text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-breco-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading...' : 'Refresh Report'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-breco-navy mx-auto"></div>
          <p className="text-gray-500 mt-4 text-sm sm:text-base">Loading tax data...</p>
        </div>
      ) : data ? (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CurrencyDollarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Taxable Income</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.income?.totalTaxableIncome || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ReceiptPercentIcon className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Tax Liability</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.taxCalculations?.totalTaxLiability || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ChartPieIcon className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Effective Rate</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{((data?.taxCalculations?.effectiveTaxRate || 0) * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CalculatorIcon className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    {(data?.payments?.balanceDue || 0) > 0 ? 'Balance Due' : 'Refund Due'}
                  </p>
                  <p className={cn(
                    "text-lg sm:text-xl font-bold",
                    (data?.payments?.balanceDue || 0) > 0 ? 'text-red-600' : 'text-green-600'
                  )}>
                    {formatCurrency(Math.abs(data?.payments?.balanceDue || data?.payments?.refundDue || 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Income & Deductions Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Income Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-4">
                <CurrencyDollarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Income Summary</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-xs sm:text-sm text-gray-600">Gross Revenue</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-900">{formatCurrency(data?.income?.grossRevenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-xs sm:text-sm text-gray-600">Operating Income</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-900">{formatCurrency(data?.income?.operatingIncome || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-xs sm:text-sm text-gray-600">Other Income</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-900">{formatCurrency(data?.income?.otherIncome || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-blue-50 px-3 rounded-lg">
                  <span className="text-xs sm:text-sm font-medium text-blue-700">Total Taxable Income</span>
                  <span className="text-xs sm:text-sm font-bold text-blue-700">{formatCurrency(data?.income?.totalTaxableIncome || 0)}</span>
                </div>
              </div>
            </div>

            {/* Deductions Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <ReceiptPercentIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900">Deductions Summary</h3>
                </div>
                <button
                  onClick={() => setShowDeductionDetails(!showDeductionDetails)}
                  className="text-xs text-breco-navy hover:text-breco-navy/80 font-medium"
                >
                  {showDeductionDetails ? 'Hide Details' : 'View Details'}
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-xs sm:text-sm text-gray-600">Business Expenses</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-900">{formatCurrency(data?.deductions?.businessExpenses || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-xs sm:text-sm text-gray-600">Depreciation</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-900">{formatCurrency(data?.deductions?.depreciation || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-xs sm:text-sm text-gray-600">Interest Expenses</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-900">{formatCurrency(data?.deductions?.interestExpenses || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-green-50 px-3 rounded-lg">
                  <span className="text-xs sm:text-sm font-medium text-green-700">Total Deductions</span>
                  <span className="text-xs sm:text-sm font-bold text-green-700">{formatCurrency(data?.deductions?.totalDeductions || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tax Calculations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <CalculatorIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Tax Calculations</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tax Type
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Taxable Base
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tax Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900">
                      Federal Income Tax
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                      {((data?.taxCalculations?.federalTaxRate || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                      {formatCurrency(data?.taxCalculations?.taxableIncome || 0)}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-medium text-gray-900">
                      {formatCurrency(data?.taxCalculations?.federalTaxLiability || 0)}
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900">
                      State Income Tax
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                      {((data?.taxCalculations?.stateTaxRate || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                      {formatCurrency(data?.taxCalculations?.taxableIncome || 0)}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-medium text-gray-900">
                      {formatCurrency(data?.taxCalculations?.stateTaxLiability || 0)}
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900">
                      Self-Employment Tax
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                      15.3%
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                      {formatCurrency(data?.income?.netIncome || 0)}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-medium text-gray-900">
                      {formatCurrency(data?.taxCalculations?.selfEmploymentTax || 0)}
                    </td>
                  </tr>
                  <tr className="bg-red-50 border-t-2 border-red-200">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-bold text-red-700">
                      Total Tax Liability
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-bold text-red-700">
                      {((data?.taxCalculations?.effectiveTaxRate || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4"></td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-bold text-red-700">
                      {formatCurrency(data?.taxCalculations?.totalTaxLiability || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Quarterly Payments */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Quarterly Tax Payments</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quarter
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estimated Payment
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actual Payment
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.payments?.quarterlyPayments || []).map((quarter) => (
                    <tr key={quarter.quarter} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900">
                        {quarter.quarter}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700">
                        {quarter.period}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                        {formatCurrency(quarter.estimatedPayment)}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-medium text-gray-900">
                        {formatCurrency(quarter.actualPayment)}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700">
                        {formatDate(quarter.dueDate)}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border',
                          getStatusColor(quarter.status)
                        )}>
                          {getStatusIcon(quarter.status)} {quarter.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Compliance Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-4">
              <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
              <h3 className="text-sm sm:text-base font-semibold text-gray-900">Compliance Information</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Filing Status</p>
                <p className="text-sm font-semibold text-gray-900">{data?.compliance?.filingStatus}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">EIN</p>
                <p className="text-sm font-semibold text-gray-900">{data?.compliance?.ein}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Filing Deadline</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(data?.compliance?.filingDeadline || '')}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Est. Penalty</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(data?.compliance?.estimatedPenalty || 0)}</p>
              </div>
            </div>

            {data?.compliance?.extensionFiled && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700">
                    Extension filed - New deadline: {formatDate(data?.compliance?.extensionDeadline || '')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Deduction Details Modal */}
          {showDeductionDetails && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">Detailed Deductions</h3>
                    <button
                      onClick={() => setShowDeductionDetails(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Deductible</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(data?.deductions?.itemizedDeductions || []).map((deduction, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900">{deduction.category}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{deduction.description}</td>
                            <td className="px-4 py-2 text-sm text-right tabular-nums text-gray-900">{formatCurrency(deduction.amount)}</td>
                            <td className="px-4 py-2 text-center">
                              {deduction.deductible ? (
                                <span className="text-green-600">✓</span>
                              ) : (
                                <span className="text-red-600">✗</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <CalculatorIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-sm sm:text-base">Loading tax data...</p>
        </div>
      )}
    </div>
  );
}

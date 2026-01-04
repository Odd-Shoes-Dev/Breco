'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';import { formatCurrency as currencyFormatter, type SupportedCurrency } from '@/lib/currency';import { ArrowLeftIcon, PrinterIcon, CheckCircleIcon, EnvelopeIcon, EyeIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface PayrollPeriod {
  id: string;
  period_name: string;
  period_type: string;
  start_date: string;
  end_date: string;
  payment_date: string;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
}

interface Payslip {
  id: string;
  employee_id: string;
  gross_salary: number;
  paye: number;
  nssf_employee: number;
  total_deductions: number;
  net_salary: number;
  employee: {
    first_name: string;
    last_name: string;
    employee_number: string;
    job_title: string;
  };
}

export default function PayrollPeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodId, setPeriodId] = useState<string>('');
  const [emailingSlugs, setEmailingSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    params.then(({ id }) => {
      setPeriodId(id);
      fetchPeriodDetails(id);
    });
  }, []);

  const fetchPeriodDetails = async (id: string) => {
    try {
      // Fetch payroll period
      const { data: periodData, error: periodError } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('id', id)
        .single();

      if (periodError) throw periodError;
      setPeriod(periodData);

      // Fetch payslips with employee details
      const { data: payslipsData, error: payslipsError } = await supabase
        .from('payslips')
        .select(`
          *,
          employee:employees(first_name, last_name, employee_number, job_title)
        `)
        .eq('payroll_period_id', id);

      if (payslipsError) throw payslipsError;
      setPayslips(payslipsData || []);
    } catch (error) {
      console.error('Error fetching payroll details:', error);
      toast.error('Failed to load payroll details');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, 'UGX');
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      draft: 'bg-gray-100 text-gray-700',
      processing: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      paid: 'bg-emerald-100 text-emerald-700',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusStyles[status as keyof typeof statusStyles]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handlePrint = () => {
    if (!period) return;

    const printHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payroll Summary - ${period.period_name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 40px; color: #111827; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; }
            .header h1 { font-size: 24px; color: #1e3a8a; margin-bottom: 8px; }
            .header p { font-size: 14px; color: #6b7280; }
            .summary { display: flex; justify-content: space-between; margin: 30px 0; padding: 20px; background: #f9fafb; border-radius: 8px; }
            .summary-item { text-align: center; flex: 1; }
            .summary-item h3 { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
            .summary-item p { font-size: 20px; font-weight: bold; }
            .summary-item.gross p { color: #111827; }
            .summary-item.deductions p { color: #dc2626; }
            .summary-item.net p { color: #16a34a; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f3f4f6; padding: 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb; }
            td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
            .text-right { text-align: right; }
            .employee-name { font-weight: 600; color: #111827; }
            .employee-number { color: #6b7280; font-size: 11px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #6b7280; }
            @media print {
              body { padding: 20px; }
              @page { margin: 0.5in; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="/assets/logo_bg.png" alt="Breco Safaris Logo" style="width: 120px; margin-bottom: 15px;" />
            <h1>Breco Safaris Ltd</h1>
            <h2>Payroll Summary</h2>
            <p>${period.period_name}</p>
            <p>${formatDate(period.start_date)} - ${formatDate(period.end_date)}</p>
            <p>Payment Date: ${formatDate(period.payment_date)}</p>
          </div>

          <div class="summary">
            <div class="summary-item gross">
              <h3>Total Gross Salary</h3>
              <p>${formatCurrency(period.total_gross || 0)}</p>
            </div>
            <div class="summary-item deductions">
              <h3>Total Deductions</h3>
              <p>${formatCurrency(period.total_deductions || 0)}</p>
            </div>
            <div class="summary-item net">
              <h3>Total Net Salary</h3>
              <p>${formatCurrency(period.total_net || 0)}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Job Title</th>
                <th class="text-right">Gross Salary</th>
                <th class="text-right">PAYE</th>
                <th class="text-right">NSSF</th>
                <th class="text-right">Total Deductions</th>
                <th class="text-right">Net Salary</th>
              </tr>
            </thead>
            <tbody>
              ${payslips.map(payslip => `
                <tr>
                  <td>
                    <div class="employee-name">${payslip.employee.first_name} ${payslip.employee.last_name}</div>
                    <div class="employee-number">${payslip.employee.employee_number}</div>
                  </td>
                  <td>${payslip.employee.job_title}</td>
                  <td class="text-right">${formatCurrency(payslip.gross_salary)}</td>
                  <td class="text-right">${formatCurrency(payslip.paye)}</td>
                  <td class="text-right">${formatCurrency(payslip.nssf_employee)}</td>
                  <td class="text-right">${formatCurrency(payslip.total_deductions)}</td>
                  <td class="text-right" style="font-weight: bold;">${formatCurrency(payslip.net_salary)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>This is a computer-generated document. No signature required.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
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
      }, 250);
    }
  };

  const handleEmailPayslip = async (payslipId: string, employeeName: string) => {
    setEmailingSlugs(prev => new Set(prev).add(payslipId));
    
    try {
      const response = await fetch(`/api/payslips/${payslipId}/email`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send email');
      }

      toast.success(`Payslip emailed to ${employeeName}!`);
    } catch (error: any) {
      console.error('Error emailing payslip:', error);
      toast.error(error.message || 'Failed to send payslip email');
    } finally {
      setEmailingSlugs(prev => {
        const newSet = new Set(prev);
        newSet.delete(payslipId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-breco-navy"></div>
      </div>
    );
  }

  if (!period) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payroll Period Not Found</h2>
        <Link href="/dashboard/payroll" className="text-breco-navy hover:underline">
          Back to Payroll
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/payroll"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{period.period_name}</h1>
            <p className="text-gray-500">
              {formatDate(period.start_date)} - {formatDate(period.end_date)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(period.status)}
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <PrinterIcon className="w-5 h-5" />
            Print All
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <p className="text-sm text-gray-500 mb-1">Total Gross Salary</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(period.total_gross || 0)}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500 mb-1">Total Deductions</p>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(period.total_deductions || 0)}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500 mb-1">Total Net Salary</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(period.total_net || 0)}
          </p>
        </div>
      </div>

      {/* Payslips Table */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Payslips ({payslips.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job Title
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gross Salary
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PAYE
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  NSSF
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Deductions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net Salary
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payslips.map((payslip) => (
                <tr key={payslip.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="font-medium text-gray-900">
                        {payslip.employee.first_name} {payslip.employee.last_name}
                      </p>
                      <p className="text-sm text-gray-500">{payslip.employee.employee_number}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {payslip.employee.job_title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                    {formatCurrency(payslip.gross_salary)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-red-600">
                    {formatCurrency(payslip.paye)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-red-600">
                    {formatCurrency(payslip.nssf_employee)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-red-600 font-medium">
                    {formatCurrency(payslip.total_deductions)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-green-600 font-bold">
                    {formatCurrency(payslip.net_salary)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-gray-400">-</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/dashboard/payroll/${periodId}/payslips/${payslip.id}`}
                        className="text-breco-navy hover:text-breco-navy/80 text-sm font-medium inline-flex items-center gap-1"
                      >
                        <EyeIcon className="w-4 h-4" />
                        View
                      </Link>
                      <button
                        onClick={() => handleEmailPayslip(payslip.id, `${payslip.employee.first_name} ${payslip.employee.last_name}`)}
                        disabled={emailingSlugs.has(payslip.id) || !payslip.employee.first_name}
                        className="text-gray-600 hover:text-gray-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!payslip.employee.first_name ? 'No email on file' : 'Email payslip'}
                      >
                        <EnvelopeIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {payslips.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No payslips found for this period</p>
          </div>
        )}
      </div>
    </div>
  );
}

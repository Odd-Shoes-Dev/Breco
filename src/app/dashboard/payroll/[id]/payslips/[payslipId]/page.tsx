'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';import { formatCurrency as currencyFormatter, type SupportedCurrency } from '@/lib/currency';import { ArrowLeftIcon, PrinterIcon, EnvelopeIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Employee {
  first_name: string;
  last_name: string;
  employee_number: string;
  job_title: string;
  department: string;
  email: string;
  phone: string;
  hire_date: string;
}

interface PayrollPeriod {
  period_name: string;
  start_date: string;
  end_date: string;
  payment_date: string;
  status: string;
}

interface Payslip {
  id: string;
  payslip_number: string;
  payroll_period_id: string;
  employee_id: string;
  basic_salary: number;
  total_allowances: number;
  overtime_hours: number;
  overtime_amount: number;
  bonus: number;
  commission: number;
  reimbursements: number;
  gross_salary: number;
  paye: number;
  nssf_employee: number;
  loan_deduction: number;
  salary_advance: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  nssf_employer: number;
  payment_method: string;
  payment_reference: string | null;
  paid_at: string | null;
  currency: string;
  notes: string | null;
  created_at: string;
  employee: Employee;
  payroll_period: PayrollPeriod;
}

interface PayslipItem {
  id: string;
  item_type: 'earning' | 'deduction';
  item_name: string;
  amount: number;
  is_taxable: boolean;
}

export default function PayslipDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string; payslipId: string }> 
}) {
  const router = useRouter();
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [payslipItems, setPayslipItems] = useState<PayslipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailSending, setEmailSending] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [periodId, setPeriodId] = useState<string>('');
  const [payslipId, setPayslipId] = useState<string>('');

  useEffect(() => {
    params.then(({ id, payslipId: pId }) => {
      setPeriodId(id);
      setPayslipId(pId);
      fetchPayslipDetails(pId);
    });
  }, []);

  const fetchPayslipDetails = async (id: string) => {
    try {
      // Fetch payslip with employee and period details
      const { data: payslipData, error: payslipError } = await supabase
        .from('payslips')
        .select(`
          *,
          employee:employees(*),
          payroll_period:payroll_periods(period_name, start_date, end_date, payment_date, status)
        `)
        .eq('id', id)
        .single();

      if (payslipError) throw payslipError;
      setPayslip(payslipData);

      // Fetch payslip items (detailed breakdown)
      const { data: itemsData, error: itemsError } = await supabase
        .from('payslip_items')
        .select('*')
        .eq('payslip_id', id)
        .order('item_type', { ascending: false })
        .order('item_name');

      if (itemsError) throw itemsError;
      setPayslipItems(itemsData || []);
    } catch (error) {
      console.error('Error fetching payslip details:', error);
      toast.error('Failed to load payslip details');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: (payslip as any).currency || 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handlePrint = () => {
    if (!payslip) return;

    const earnings = payslipItems.filter(item => item.item_type === 'earning');
    const deductions = payslipItems.filter(item => item.item_type === 'deduction');

    const printHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payslip - ${payslip.employee.first_name} ${payslip.employee.last_name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #111827;
              background: white;
              padding: 40px;
            }
            .payslip-container { 
              max-width: 800px; 
              margin: 0 auto;
            }
            .header { 
              display: flex; 
              align-items: center; 
              justify-content: space-between;
              margin-bottom: 30px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 20px;
            }
            .company-section {
              display: flex;
              align-items: center;
            }
            .logo { 
              width: 120px; 
              height: 120px; 
              margin-right: 20px;
              border-radius: 8px;
              object-fit: contain;
            }
            .company-info h1 { 
              font-size: 24px; 
              font-weight: bold; 
              color: #1e3a5f;
              margin-bottom: 4px;
            }
            .company-info .address { 
              font-size: 12px; 
              color: #6b7280;
              margin-bottom: 2px;
            }
            .payslip-header { 
              text-align: right;
            }
            .payslip-header h2 { 
              font-size: 28px; 
              font-weight: bold; 
              color: #1e3a5f;
              margin-bottom: 4px;
            }
            .payslip-header .period { 
              font-size: 14px; 
              color: #6b7280;
            }
            .payslip-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin: 30px 0;
            }
            .info-box h3 {
              font-size: 12px;
              font-weight: 600;
              color: #6b7280;
              text-transform: uppercase;
              margin-bottom: 10px;
            }
            .info-box p {
              font-size: 14px;
              color: #111827;
              margin-bottom: 4px;
            }
            .breakdown {
              margin: 30px 0;
            }
            .breakdown-section {
              margin-bottom: 30px;
            }
            .breakdown-section h3 {
              font-size: 14px;
              font-weight: 600;
              color: #111827;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 2px solid #e5e7eb;
            }
            .breakdown-item {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
            }
            .breakdown-item.total {
              border-top: 2px solid #e5e7eb;
              margin-top: 8px;
              padding-top: 12px;
              font-weight: bold;
              font-size: 15px;
            }
            .breakdown-label {
              color: #6b7280;
            }
            .breakdown-value {
              font-weight: 600;
              color: #111827;
            }
            .breakdown-value.negative {
              color: #dc2626;
            }
            .summary {
              background: #f3f4f6;
              padding: 20px;
              border-radius: 8px;
              margin: 30px 0;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 20px;
              margin-bottom: 20px;
            }
            .summary-item {
              text-align: center;
              padding: 15px;
              background: white;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
            }
            .summary-label {
              font-size: 11px;
              color: #6b7280;
              text-transform: uppercase;
              margin-bottom: 8px;
              font-weight: 600;
            }
            .summary-value {
              font-size: 20px;
              font-weight: 700;
            }
            .summary-value.gross { color: #111827; }
            .summary-value.deductions { color: #dc2626; }
            .summary-value.net { color: #16a34a; }
            .net-pay-banner {
              background: #16a34a;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px;
              margin-top: 15px;
            }
            .net-pay-banner .label {
              font-size: 14px;
              margin-bottom: 8px;
              font-weight: 500;
            }
            .net-pay-banner .amount {
              font-size: 36px;
              font-weight: bold;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              font-size: 11px;
              color: #9ca3af;
            }
            @media print {
              body { padding: 20px; }
              @page { margin: 0.5in; }
            }
          </style>
        </head>
        <body>
          <div class="payslip-container">
            <div class="header">
              <div class="company-section">
                <img src="${typeof window !== 'undefined' ? window.location.origin : ''}/assets/logo.jpg" alt="Breco Safaris" class="logo" onerror="this.style.display='none'">
                <div class="company-info">
                  <h1>Breco Safaris Ltd</h1>
                  <p class="address">Plot 123, Kampala Road</p>
                  <p class="address">Kampala, Uganda</p>
                  <p class="address">Tel: +256 123 456 789</p>
                  <p class="address">Email: info@brecosafaris.com</p>
                </div>
              </div>
              <div class="payslip-header">
                <h2>SALARY SLIP</h2>
                <p class="period">${payslip.payroll_period.period_name}</p>
              </div>
            </div>

            <div class="payslip-info">
              <div class="info-box">
                <h3>Employee Information</h3>
                <p><strong>Name:</strong> ${payslip.employee.first_name} ${payslip.employee.last_name}</p>
                <p><strong>Employee ID:</strong> ${payslip.employee.employee_number}</p>
                <p><strong>Job Title:</strong> ${payslip.employee.job_title}</p>
                <p><strong>Department:</strong> ${payslip.employee.department || 'N/A'}</p>
              </div>

              <div class="info-box">
                <h3>Payment Information</h3>
                <p><strong>Payslip No:</strong> ${payslip.payslip_number}</p>
                <p><strong>Pay Period:</strong> ${formatDate(payslip.payroll_period.start_date)} - ${formatDate(payslip.payroll_period.end_date)}</p>
                <p><strong>Payment Date:</strong> ${formatDate(payslip.payroll_period.payment_date)}</p>
                <p><strong>Payment Method:</strong> ${payslip.payment_method.replace('_', ' ').toUpperCase()}</p>
              </div>
            </div>

            <div class="breakdown">
              <div class="breakdown-section">
                <h3>Earnings</h3>
                <div class="breakdown-item">
                  <span class="breakdown-label">Basic Salary</span>
                  <span class="breakdown-value">${formatCurrency(payslip.basic_salary)}</span>
                </div>
                ${earnings.map(item => `
                  <div class="breakdown-item">
                    <span class="breakdown-label">${item.item_name}${item.is_taxable ? '' : ' (Non-taxable)'}</span>
                    <span class="breakdown-value">${formatCurrency(item.amount)}</span>
                  </div>
                `).join('')}
                ${payslip.overtime_amount > 0 ? `
                  <div class="breakdown-item">
                    <span class="breakdown-label">Overtime (${payslip.overtime_hours} hrs)</span>
                    <span class="breakdown-value">${formatCurrency(payslip.overtime_amount)}</span>
                  </div>
                ` : ''}
                ${payslip.bonus > 0 ? `
                  <div class="breakdown-item">
                    <span class="breakdown-label">Bonus</span>
                    <span class="breakdown-value">${formatCurrency(payslip.bonus)}</span>
                  </div>
                ` : ''}
                ${payslip.commission > 0 ? `
                  <div class="breakdown-item">
                    <span class="breakdown-label">Commission</span>
                    <span class="breakdown-value">${formatCurrency(payslip.commission)}</span>
                  </div>
                ` : ''}
                ${payslip.reimbursements > 0 ? `
                  <div class="breakdown-item">
                    <span class="breakdown-label">Reimbursements</span>
                    <span class="breakdown-value">${formatCurrency(payslip.reimbursements)}</span>
                  </div>
                ` : ''}
                <div class="breakdown-item total">
                  <span class="breakdown-label">Gross Salary</span>
                  <span class="breakdown-value">${formatCurrency(payslip.gross_salary)}</span>
                </div>
              </div>

              <div class="breakdown-section">
                <h3>Deductions</h3>
                <div class="breakdown-item">
                  <span class="breakdown-label">PAYE (Income Tax)</span>
                  <span class="breakdown-value negative">${formatCurrency(payslip.paye)}</span>
                </div>
                <div class="breakdown-item">
                  <span class="breakdown-label">NSSF (Employee 5%)</span>
                  <span class="breakdown-value negative">${formatCurrency(payslip.nssf_employee)}</span>
                </div>
                ${deductions.map(item => `
                  <div class="breakdown-item">
                    <span class="breakdown-label">${item.item_name}</span>
                    <span class="breakdown-value negative">${formatCurrency(item.amount)}</span>
                  </div>
                `).join('')}
                ${payslip.loan_deduction > 0 ? `
                  <div class="breakdown-item">
                    <span class="breakdown-label">Loan Deduction</span>
                    <span class="breakdown-value negative">${formatCurrency(payslip.loan_deduction)}</span>
                  </div>
                ` : ''}
                ${payslip.salary_advance > 0 ? `
                  <div class="breakdown-item">
                    <span class="breakdown-label">Salary Advance</span>
                    <span class="breakdown-value negative">${formatCurrency(payslip.salary_advance)}</span>
                  </div>
                ` : ''}
                <div class="breakdown-item total">
                  <span class="breakdown-label">Total Deductions</span>
                  <span class="breakdown-value negative">${formatCurrency(payslip.total_deductions)}</span>
                </div>
              </div>
            </div>

            <div class="summary">
              <div class="summary-grid">
                <div class="summary-item">
                  <div class="summary-label">Gross Salary</div>
                  <div class="summary-value gross">${formatCurrency(payslip.gross_salary)}</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">Total Deductions</div>
                  <div class="summary-value deductions">${formatCurrency(payslip.total_deductions)}</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">NSSF Employer (10%)</div>
                  <div class="summary-value">${formatCurrency(payslip.nssf_employer)}</div>
                </div>
              </div>

              <div class="net-pay-banner">
                <div class="label">NET PAY</div>
                <div class="amount">${formatCurrency(payslip.net_salary)}</div>
              </div>
            </div>

            <div class="footer">
              <p>This is a computer-generated payslip and does not require a signature.</p>
              <p>Generated on ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</p>
              <p style="margin-top: 8px;">For any queries, please contact HR Department</p>
            </div>
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

  const handleEmailPayslip = async () => {
    if (!payslip) return;

    setEmailSending(true);
    try {
      const response = await fetch(`/api/payslips/${payslip.id}/email`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send email');
      }

      toast.success('Payslip emailed successfully!');
    } catch (error: any) {
      console.error('Error emailing payslip:', error);
      toast.error(error.message || 'Failed to send payslip email');
    } finally {
      setEmailSending(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!payslip) return;

    setPdfGenerating(true);
    try {
      const response = await fetch(`/api/payslips/${payslip.id}/pdf`);

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payslip_${payslip.payslip_number}_${payslip.employee.first_name}_${payslip.employee.last_name}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('PDF downloaded successfully!');
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    } finally {
      setPdfGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-breco-navy"></div>
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payslip Not Found</h2>
        <Link href="/dashboard/payroll" className="text-breco-navy hover:underline">
          Back to Payroll
        </Link>
      </div>
    );
  }

  const earnings = payslipItems.filter(item => item.item_type === 'earning');
  const deductions = payslipItems.filter(item => item.item_type === 'deduction');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/payroll/${periodId}`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {payslip.employee.first_name} {payslip.employee.last_name}
            </h1>
            <p className="text-gray-500">{payslip.payroll_period.period_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadPDF}
            disabled={pdfGenerating}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            {pdfGenerating ? 'Generating...' : 'Download PDF'}
          </button>
          <button
            onClick={handleEmailPayslip}
            disabled={emailSending || !payslip.employee.email}
            className="btn-secondary flex items-center gap-2"
            title={!payslip.employee.email ? 'No email address on file' : ''}
          >
            <EnvelopeIcon className="w-5 h-5" />
            {emailSending ? 'Sending...' : 'Email'}
          </button>
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <PrinterIcon className="w-5 h-5" />
            Print
          </button>
        </div>
      </div>

      {/* Payslip Container */}
      <div className="card overflow-hidden">
        {/* Employee & Payment Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50 border-b border-gray-200">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Employee Information
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Name:</span>
                <span className="text-sm font-medium text-gray-900">
                  {payslip.employee.first_name} {payslip.employee.last_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Employee ID:</span>
                <span className="text-sm font-medium text-gray-900">{payslip.employee.employee_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Job Title:</span>
                <span className="text-sm font-medium text-gray-900">{payslip.employee.job_title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Department:</span>
                <span className="text-sm font-medium text-gray-900">{payslip.employee.department || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Payment Information
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Payslip No:</span>
                <span className="text-sm font-medium text-gray-900">{payslip.payslip_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Pay Period:</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatDate(payslip.payroll_period.start_date)} - {formatDate(payslip.payroll_period.end_date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Payment Date:</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatDate(payslip.payroll_period.payment_date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Payment Method:</span>
                <span className="text-sm font-medium text-gray-900">
                  {payslip.payment_method.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Earnings & Deductions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Earnings */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Earnings
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between py-1">
                <span className="text-sm text-gray-600">Basic Salary</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(payslip.basic_salary)}</span>
              </div>
              {earnings.map((item) => (
                <div key={item.id} className="flex justify-between py-1">
                  <span className="text-sm text-gray-600">
                    {item.item_name}
                    {!item.is_taxable && <span className="text-xs text-gray-400 ml-1">(Non-taxable)</span>}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                </div>
              ))}
              {payslip.overtime_amount > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-sm text-gray-600">Overtime ({payslip.overtime_hours} hrs)</span>
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(payslip.overtime_amount)}</span>
                </div>
              )}
              {payslip.bonus > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-sm text-gray-600">Bonus</span>
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(payslip.bonus)}</span>
                </div>
              )}
              {payslip.commission > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-sm text-gray-600">Commission</span>
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(payslip.commission)}</span>
                </div>
              )}
              {payslip.reimbursements > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-sm text-gray-600">Reimbursements</span>
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(payslip.reimbursements)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 mt-2 border-t-2 border-gray-900">
                <span className="text-sm font-semibold text-gray-900">Gross Salary</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(payslip.gross_salary)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Deductions
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between py-1">
                <span className="text-sm text-gray-600">PAYE (Income Tax)</span>
                <span className="text-sm font-medium text-red-600">{formatCurrency(payslip.paye)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-sm text-gray-600">NSSF (Employee 5%)</span>
                <span className="text-sm font-medium text-red-600">{formatCurrency(payslip.nssf_employee)}</span>
              </div>
              {deductions.map((item) => (
                <div key={item.id} className="flex justify-between py-1">
                  <span className="text-sm text-gray-600">{item.item_name}</span>
                  <span className="text-sm font-medium text-red-600">{formatCurrency(item.amount)}</span>
                </div>
              ))}
              {payslip.loan_deduction > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-sm text-gray-600">Loan Deduction</span>
                  <span className="text-sm font-medium text-red-600">{formatCurrency(payslip.loan_deduction)}</span>
                </div>
              )}
              {payslip.salary_advance > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-sm text-gray-600">Salary Advance</span>
                  <span className="text-sm font-medium text-red-600">{formatCurrency(payslip.salary_advance)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 mt-2 border-t-2 border-gray-900">
                <span className="text-sm font-semibold text-gray-900">Total Deductions</span>
                <span className="text-sm font-bold text-red-600">{formatCurrency(payslip.total_deductions)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Gross Salary</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(payslip.gross_salary)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Deductions</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(payslip.total_deductions)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">NSSF Employer (10%)</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(payslip.nssf_employer)}</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-lg text-center">
            <p className="text-sm font-medium mb-1 opacity-90">NET PAY</p>
            <p className="text-4xl font-bold">{formatCurrency(payslip.net_salary)}</p>
          </div>
        </div>

        {/* Notes */}
        {payslip.notes && (
          <div className="p-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
            <p className="text-sm text-gray-600">{payslip.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

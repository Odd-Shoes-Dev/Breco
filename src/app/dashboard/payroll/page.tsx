'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter, type SupportedCurrency } from '@/lib/currency';
import type { PayrollPeriod, Payslip, Employee } from '@/types/breco';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  PaperAirplaneIcon,
  CurrencyDollarIcon,
  CalculatorIcon,
  ArrowPathIcon,
  EyeIcon,
  PrinterIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

type PayrollStatus = 'draft' | 'processing' | 'approved' | 'paid';

interface PayrollPeriodWithPayslips extends PayrollPeriod {
  payslips?: (Payslip & { employee?: Employee })[];
}

// Default currency for payroll - can be overridden from company settings
const defaultCurrency: SupportedCurrency = 'UGX';

// Uganda PAYE rates 2023/2024
const calculatePAYE = (grossIncome: number): number => {
  // Annual thresholds
  const threshold1 = 2820000; // UGX - tax free
  const threshold2 = 4020000; // UGX - 10%
  const threshold3 = 4920000; // UGX - 20%
  const threshold4 = 120000000; // UGX - 30%
  
  // Monthly thresholds
  const monthly1 = threshold1 / 12;
  const monthly2 = threshold2 / 12;
  const monthly3 = threshold3 / 12;
  const monthly4 = threshold4 / 12;
  
  if (grossIncome <= monthly1) return 0;
  
  let tax = 0;
  
  if (grossIncome > monthly1) {
    tax += Math.min(grossIncome - monthly1, monthly2 - monthly1) * 0.10;
  }
  if (grossIncome > monthly2) {
    tax += Math.min(grossIncome - monthly2, monthly3 - monthly2) * 0.20;
  }
  if (grossIncome > monthly3) {
    tax += Math.min(grossIncome - monthly3, monthly4 - monthly3) * 0.30;
  }
  if (grossIncome > monthly4) {
    tax += (grossIncome - monthly4) * 0.40;
  }
  
  return Math.round(tax);
};

// NSSF Rates
const calculateNSSF = (grossIncome: number) => {
  const employeeRate = 0.05; // 5%
  const employerRate = 0.10; // 10%
  
  return {
    employee: Math.round(grossIncome * employeeRate),
    employer: Math.round(grossIncome * employerRate),
  };
};

export default function PayrollPage() {
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriodWithPayslips[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriodWithPayslips | null>(null);
  const [processing, setProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    period_name: '',
    period_type: 'monthly' as 'weekly' | 'bi_weekly' | 'monthly',
    start_date: '',
    end_date: '',
    payment_date: '',
  });

  useEffect(() => {
    fetchPayrollPeriods();
    fetchEmployees();
  }, []);

  const fetchPayrollPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('payroll_periods')
        .select(`
          *,
          payslips(*, employee:employees(*))
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setPayrollPeriods(data || []);
    } catch (error) {
      console.error('Error fetching payroll periods:', error);
      toast.error('Failed to load payroll periods');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data, error } = await supabase
        .from('payroll_periods')
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Payroll period created');
      setShowCreateModal(false);
      setFormData({
        period_name: '',
        period_type: 'monthly',
        start_date: '',
        end_date: '',
        payment_date: '',
      });
      fetchPayrollPeriods();
    } catch (error) {
      console.error('Error creating payroll period:', error);
      toast.error('Failed to create payroll period');
    }
  };

  const processPayroll = async (period: PayrollPeriodWithPayslips) => {
    setProcessing(true);
    
    try {
      // Check if payslips already exist for this period
      const { data: existingPayslips } = await supabase
        .from('payslips')
        .select('id')
        .eq('payroll_period_id', period.id)
        .limit(1);

      if (existingPayslips && existingPayslips.length > 0) {
        toast.error('Payslips already exist for this period');
        setProcessing(false);
        setShowProcessModal(false);
        return;
      }

      // Update period status to processing
      await supabase
        .from('payroll_periods')
        .update({ status: 'processing' })
        .eq('id', period.id);

      // Fetch allowances and deductions for all employees
      const { data: allowancesData } = await supabase
        .from('employee_allowances')
        .select('*')
        .in('employee_id', employees.map(e => e.id))
        .eq('is_active', true)
        .lte('effective_from', period.end_date)
        .or(`effective_to.is.null,effective_to.gte.${period.end_date}`);

      const { data: deductionsData } = await supabase
        .from('employee_deductions')
        .select('*')
        .in('employee_id', employees.map(e => e.id))
        .eq('is_active', true)
        .lte('effective_from', period.end_date)
        .or(`effective_to.is.null,effective_to.gte.${period.end_date}`);

      // Group allowances and deductions by employee
      const allowancesByEmployee = new Map();
      const deductionsByEmployee = new Map();
      
      allowancesData?.forEach(a => {
        if (!allowancesByEmployee.has(a.employee_id)) {
          allowancesByEmployee.set(a.employee_id, []);
        }
        allowancesByEmployee.get(a.employee_id).push(a);
      });

      deductionsData?.forEach(d => {
        if (!deductionsByEmployee.has(d.employee_id)) {
          deductionsByEmployee.set(d.employee_id, []);
        }
        deductionsByEmployee.get(d.employee_id).push(d);
      });

      // Generate payslips for all active employees
      const payslips = employees.map(emp => {
        const basicSalary = emp.basic_salary || 0;
        
        // Calculate total allowances
        const empAllowances = allowancesByEmployee.get(emp.id) || [];
        const totalAllowances = empAllowances.reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
        const taxableAllowances = empAllowances
          .filter((a: any) => a.is_taxable)
          .reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
        
        // Gross salary = basic + allowances
        const grossSalary = basicSalary + totalAllowances;
        
        // NSSF on basic salary only (Uganda rule)
        const nssf = calculateNSSF(basicSalary);
        
        // PAYE on taxable income (basic + taxable allowances - NSSF employee)
        const taxableIncome = basicSalary + taxableAllowances - nssf.employee;
        const paye = calculatePAYE(taxableIncome);
        
        // Calculate other deductions
        const empDeductions = deductionsByEmployee.get(emp.id) || [];
        const otherDeductions = empDeductions.reduce((sum: number, d: any) => {
          if (d.is_percentage) {
            return sum + (grossSalary * (d.amount / 100));
          }
          return sum + (d.amount || 0);
        }, 0);
        
        const totalDeductions = nssf.employee + paye + otherDeductions;
        const netSalary = grossSalary - totalDeductions;
        
        return {
          payroll_period_id: period.id,
          employee_id: emp.id,
          payslip_number: `PS-${period.id.substring(0,8)}-${emp.employee_number}`,
          basic_salary: basicSalary,
          total_allowances: totalAllowances,
          gross_salary: grossSalary,
          nssf_employee: nssf.employee,
          nssf_employer: nssf.employer,
          paye: paye,
          other_deductions: otherDeductions,
          total_deductions: totalDeductions,
          net_salary: netSalary,
        };
      });

      // Insert payslips
      const { data: insertedPayslips, error: payslipError } = await supabase
        .from('payslips')
        .insert(payslips)
        .select();

      if (payslipError) throw payslipError;

      // Create payslip line items for detailed breakdown
      const payslipItems = [];
      
      for (const payslip of insertedPayslips || []) {
        const empAllowances = allowancesByEmployee.get(payslip.employee_id) || [];
        const empDeductions = deductionsByEmployee.get(payslip.employee_id) || [];
        
        // Add allowance items
        for (const allowance of empAllowances) {
          payslipItems.push({
            payslip_id: payslip.id,
            item_type: 'earning',
            item_name: allowance.allowance_type,
            amount: allowance.amount,
            is_taxable: allowance.is_taxable,
          });
        }
        
        // Add deduction items
        for (const deduction of empDeductions) {
          let amount = deduction.amount;
          if (deduction.is_percentage) {
            amount = payslip.gross_salary * (deduction.amount / 100);
          }
          payslipItems.push({
            payslip_id: payslip.id,
            item_type: 'deduction',
            item_name: deduction.deduction_type,
            amount: amount,
            is_taxable: false,
          });
        }
      }

      // Insert payslip items if any
      if (payslipItems.length > 0) {
        await supabase
          .from('payslip_items')
          .insert(payslipItems);
      }

      // Totals will be auto-calculated by trigger
      await supabase
        .from('payroll_periods')
        .update({
          status: 'draft',
        })
        .eq('id', period.id);

      toast.success('Payroll processed successfully with allowances and deductions');
      setShowProcessModal(false);
      fetchPayrollPeriods();
    } catch (error) {
      console.error('Error processing payroll:', error);
      toast.error('Failed to process payroll');
    } finally {
      setProcessing(false);
    }
  };

  const updatePeriodStatus = async (period: PayrollPeriod, newStatus: PayrollStatus) => {
    try {
      const updateData: any = { status: newStatus };

      // Use API route for paid status to trigger journal entry creation
      if (newStatus === 'paid') {
        const response = await fetch(`/api/payroll/${period.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update payroll status');
        }

        toast.success(`Payroll marked as paid and posted to general ledger`);
      } else {
        // For other statuses, update directly
        const { error } = await supabase
          .from('payroll_periods')
          .update(updateData)
          .eq('id', period.id);

        if (error) throw error;
        
        toast.success(`Status updated to ${newStatus}`);
      }
      
      fetchPayrollPeriods();
    } catch (error: any) {
      console.error('Failed to update status:', error);
      toast.error(error.message || 'Failed to update status');
    }
  };

  const handlePrint = (period: PayrollPeriod) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-UG', {
        style: 'currency',
        currency: defaultCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    const formatDate = (date: string | null) => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payroll Period - ${period.period_name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #000;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #000;
            }
            .logo {
              max-height: 80px;
            }
            .company-info {
              text-align: right;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            h1 {
              text-align: center;
              margin: 20px 0;
              font-size: 22px;
            }
            .period-info {
              background: #f5f5f5;
              padding: 15px;
              margin-bottom: 20px;
              border-radius: 5px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .info-label {
              font-weight: bold;
              width: 150px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin: 20px 0;
            }
            .summary-box {
              border: 1px solid #ddd;
              padding: 15px;
              border-radius: 5px;
              text-align: center;
            }
            .summary-label {
              font-size: 12px;
              color: #666;
              margin-bottom: 5px;
            }
            .summary-value {
              font-size: 20px;
              font-weight: bold;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
            @media print {
              body { margin: 0; }
              .header { page-break-after: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="/assets/logo_bg.png" alt="Company Logo" class="logo" />
            <div class="company-info">
              <div class="company-name">Breco Safaris</div>
              <div>Operations Department</div>
            </div>
          </div>

          <h1>Payroll Period Summary</h1>

          <div class="period-info">
            <div class="info-row">
              <span class="info-label">Period Name:</span>
              <span>${period.period_name}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Period Type:</span>
              <span>${period.period_type || '-'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Start Date:</span>
              <span>${formatDate(period.start_date)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">End Date:</span>
              <span>${formatDate(period.end_date)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Payment Date:</span>
              <span>${formatDate(period.payment_date)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span style="text-transform: capitalize;">${period.status}</span>
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-box">
              <div class="summary-label">Gross Pay</div>
              <div class="summary-value">${formatCurrency(period.total_gross || 0)}</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">Total Deductions</div>
              <div class="summary-value">${formatCurrency(period.total_deductions || 0)}</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">Net Pay</div>
              <div class="summary-value">${formatCurrency(period.total_net || 0)}</div>
            </div>
          </div>

          <div class="footer">
            <p>Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-GB')}</p>
            <p>Breco Safaris - Operations Department</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const deletePeriod = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payroll period? This will also delete all associated payslips.')) return;

    try {
      const { error } = await supabase
        .from('payroll_periods')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setPayrollPeriods(prev => prev.filter(p => p.id !== id));
      toast.success('Payroll period deleted');
    } catch (error) {
      toast.error('Failed to delete payroll period');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="badge flex items-center gap-1"><DocumentTextIcon className="w-3 h-3" /> Draft</span>;
      case 'processing':
        return <span className="badge-warning flex items-center gap-1"><ArrowPathIcon className="w-3 h-3 animate-spin" /> Processing</span>;
      case 'approved':
        return <span className="badge-info flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" /> Approved</span>;
      case 'paid':
        return <span className="badge-success flex items-center gap-1"><BanknotesIcon className="w-3 h-3" /> Paid</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const formatCurrency = (amount: number | null, currency: SupportedCurrency = 'UGX') => {
    if (!amount) return currencyFormatter(0, currency);
    return currencyFormatter(amount, currency);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Calculate summary stats
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentPeriod = payrollPeriods.find(p => p.start_date?.startsWith(currentMonth));
  const totalPaidThisYear = payrollPeriods
    .filter(p => p.status === 'paid' && p.start_date?.startsWith(new Date().getFullYear().toString()))
    .reduce((sum, p) => sum + (p.total_net || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-breco-navy"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-gray-500 mt-1">Process payroll with PAYE & NSSF compliance</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          New Pay Period
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
          <p className="text-sm text-gray-500">Active Employees</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-breco-navy">
            {formatCurrency(currentPeriod?.total_net || employees.reduce((sum, e) => sum + (e.basic_salary || 0), 0))}
          </p>
          <p className="text-sm text-gray-500">This Month Payroll</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(currentPeriod?.total_deductions || 0)}
          </p>
          <p className="text-sm text-gray-500">Total Deductions</p>
        </div>
      </div>

      {/* Tax Compliance Alert */}
      <div className="card p-4 bg-yellow-50 border-yellow-200">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-yellow-800">Statutory Remittances</h3>
            <p className="text-sm text-yellow-700 mt-1">
              PAYE must be remitted to URA by the 15th of each month. NSSF contributions must be paid by the 15th following the pay period.
            </p>
          </div>
        </div>
      </div>

      {/* Payroll Periods */}
      {payrollPeriods.length === 0 ? (
        <div className="card p-12 text-center">
          <BanknotesIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No payroll periods</h3>
          <p className="text-gray-500 mb-4">Create your first payroll period to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            New Pay Period
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {payrollPeriods.map((period) => (
            <div key={period.id} className="card">
              <div className="card-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{period.period_name}</h3>
                  <p className="text-sm text-gray-500">
                    {formatDate(period.start_date)} - {formatDate(period.end_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(period.status)}
                </div>
              </div>
              
              <div className="card-body">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-400">Employees</p>
                    <p className="font-semibold">{period.employee_count || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Gross Pay</p>
                    <p className="font-semibold">{formatCurrency(period.total_gross)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Deductions</p>
                    <p className="font-semibold text-red-600">{formatCurrency(period.total_deductions)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Net Pay</p>
                    <p className="font-semibold text-green-600">{formatCurrency(period.total_net)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-4 border-t">
                  {period.status === 'draft' && !period.employee_count && (
                    <button
                      onClick={() => {
                        setSelectedPeriod(period);
                        setShowProcessModal(true);
                      }}
                      className="btn-primary btn-sm flex items-center gap-1"
                    >
                      <CalculatorIcon className="w-4 h-4" />
                      Process Payroll
                    </button>
                  )}
                  
                  {period.status === 'draft' && period.employee_count && (
                    <button
                      onClick={() => updatePeriodStatus(period, 'approved')}
                      className="btn-primary btn-sm flex items-center gap-1"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      Approve
                    </button>
                  )}
                  
                  {period.status === 'approved' && (
                    <button
                      onClick={() => updatePeriodStatus(period, 'paid')}
                      className="btn-success btn-sm flex items-center gap-1"
                    >
                      <BanknotesIcon className="w-4 h-4" />
                      Mark as Paid
                    </button>
                  )}

                  <Link
                    href={`/dashboard/payroll/${period.id}`}
                    className="btn-secondary btn-sm flex items-center gap-1"
                  >
                    <EyeIcon className="w-4 h-4" />
                    View Payslips
                  </Link>

                  <button
                    onClick={() => handlePrint(period)}
                    className="btn-secondary btn-sm flex items-center gap-1"
                  >
                    <PrinterIcon className="w-4 h-4" />
                    Print
                  </button>

                  {period.status === 'draft' && (
                    <button
                      onClick={() => deletePeriod(period.id)}
                      className="btn-sm btn-danger ml-auto"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Period Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h2 className="text-lg font-semibold">Create Pay Period</h2>
            </div>
            <form onSubmit={handleCreatePeriod} className="card-body space-y-4">
              <div className="form-group">
                <label className="label">Period Name *</label>
                <input
                  type="text"
                  value={formData.period_name}
                  onChange={(e) => setFormData({ ...formData, period_name: e.target.value })}
                  className="input"
                  placeholder="e.g., January 2024"
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">Period Type *</label>
                <select
                  value={formData.period_type}
                  onChange={(e) => setFormData({ ...formData, period_type: e.target.value as any })}
                  className="input"
                  required
                >
                  <option value="weekly">Weekly</option>
                  <option value="bi_weekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Start Date *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label">End Date *</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Pay Date *</label>
                <input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                <button type="submit" className="btn-primary">
                  Create Period
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Payroll Modal */}
      {showProcessModal && selectedPeriod && (
        <div className="modal-overlay" onClick={() => setShowProcessModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h2 className="text-lg font-semibold">Process Payroll</h2>
            </div>
            <div className="card-body space-y-4">
              <p className="text-gray-600">
                This will generate payslips for <strong>{employees.length}</strong> active employees 
                for the period <strong>{selectedPeriod.period_name}</strong>.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium">Calculations will include:</h4>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                  <li>PAYE (Pay As You Earn) - Uganda progressive tax rates</li>
                  <li>NSSF Employee Contribution (5%)</li>
                  <li>NSSF Employer Contribution (10%)</li>
                  <li>Any configured allowances and deductions</li>
                </ul>
              </div>

              <div className="bg-yellow-50 rounded-lg p-4">
                <p className="text-sm text-yellow-700">
                  <strong>Note:</strong> You can review and adjust individual payslips after processing.
                </p>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                <button
                  onClick={() => processPayroll(selectedPeriod)}
                  disabled={processing}
                  className="btn-primary flex items-center gap-2"
                >
                  {processing ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CalculatorIcon className="w-4 h-4" />
                      Process Payroll
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowProcessModal(false)}
                  className="btn-secondary"
                  disabled={processing}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


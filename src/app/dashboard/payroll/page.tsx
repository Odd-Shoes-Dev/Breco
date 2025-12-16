'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
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
    start_date: '',
    end_date: '',
    pay_date: '',
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
        .in('employment_status', ['active', 'probation'])
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
        start_date: '',
        end_date: '',
        pay_date: '',
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
      // Update period status to processing
      await supabase
        .from('payroll_periods')
        .update({ status: 'processing' })
        .eq('id', period.id);

      // Generate payslips for all active employees
      const payslips = employees.map(emp => {
        const grossSalary = emp.base_salary || 0;
        const nssf = calculateNSSF(grossSalary);
        const paye = calculatePAYE(grossSalary - nssf.employee); // PAYE on taxable income after NSSF
        
        return {
          payroll_period_id: period.id,
          employee_id: emp.id,
          basic_salary: grossSalary,
          gross_earnings: grossSalary,
          nssf_employee: nssf.employee,
          nssf_employer: nssf.employer,
          paye: paye,
          total_deductions: nssf.employee + paye,
          net_pay: grossSalary - nssf.employee - paye,
          status: 'pending',
        };
      });

      // Insert payslips
      const { error: payslipError } = await supabase
        .from('payslips')
        .insert(payslips);

      if (payslipError) throw payslipError;

      // Calculate totals and update period
      const totalGross = payslips.reduce((sum, p) => sum + p.gross_earnings, 0);
      const totalDeductions = payslips.reduce((sum, p) => sum + p.total_deductions, 0);
      const totalNet = payslips.reduce((sum, p) => sum + p.net_pay, 0);
      const totalPaye = payslips.reduce((sum, p) => sum + p.paye, 0);
      const totalNssf = payslips.reduce((sum, p) => sum + p.nssf_employee + p.nssf_employer, 0);

      await supabase
        .from('payroll_periods')
        .update({
          status: 'draft',
          total_gross: totalGross,
          total_deductions: totalDeductions,
          total_net: totalNet,
          total_paye: totalPaye,
          total_nssf: totalNssf,
          employee_count: payslips.length,
        })
        .eq('id', period.id);

      toast.success('Payroll processed successfully');
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
      if (newStatus === 'paid') {
        updateData.paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('payroll_periods')
        .update(updateData)
        .eq('id', period.id);

      if (error) throw error;
      
      toast.success(`Status updated to ${newStatus}`);
      fetchPayrollPeriods();
    } catch (error) {
      toast.error('Failed to update status');
    }
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

  const formatCurrency = (amount: number | null, currency: string = 'UGX') => {
    if (!amount) return 'UGX 0';
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
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
            {formatCurrency(currentPeriod?.total_net || employees.reduce((sum, e) => sum + (e.base_salary || 0), 0))}
          </p>
          <p className="text-sm text-gray-500">This Month Payroll</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(currentPeriod?.total_paye || 0)}
          </p>
          <p className="text-sm text-gray-500">PAYE Due</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(currentPeriod?.total_nssf || 0)}
          </p>
          <p className="text-sm text-gray-500">NSSF Due</p>
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
                    <p className="text-xs text-gray-400">PAYE</p>
                    <p className="font-semibold text-red-600">{formatCurrency(period.total_paye)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">NSSF</p>
                    <p className="font-semibold text-blue-600">{formatCurrency(period.total_nssf)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Deductions</p>
                    <p className="font-semibold">{formatCurrency(period.total_deductions)}</p>
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
                  value={formData.pay_date}
                  onChange={(e) => setFormData({ ...formData, pay_date: e.target.value })}
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


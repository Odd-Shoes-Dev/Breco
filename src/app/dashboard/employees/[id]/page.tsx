'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  IdentificationIcon,
  BanknotesIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  other_names: string | null;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  nssf_number: string | null;
  tin: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  job_title: string;
  department: string | null;
  employment_type: string;
  employment_status: string;
  hire_date: string;
  termination_date: string | null;
  basic_salary: number;
  salary_currency: string;
  pay_frequency: string;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_number: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [allowances, setAllowances] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [recentPayslips, setRecentPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<string>('');

  useEffect(() => {
    params.then(({ id }) => {
      setEmployeeId(id);
      fetchEmployeeDetails(id);
    });
  }, []);

  const fetchEmployeeDetails = async (id: string) => {
    try {
      // Fetch employee using API
      const response = await fetch(`/api/employees/${id}`);
      if (!response.ok) throw new Error('Employee not found');
      
      const result = await response.json();
      setEmployee(result.data);
      setAllowances(result.data.allowances || []);
      setDeductions(result.data.deductions || []);

      // Fetch recent payslips
      const { data: payslips } = await supabase
        .from('payslips')
        .select('*, payroll_period:payroll_periods(period_name, payment_date)')
        .eq('employee_id', id)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentPayslips(payslips || []);
    } catch (error) {
      console.error('Error fetching employee:', error);
      toast.error('Failed to load employee details');
      router.push('/dashboard/employees');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this employee? This action cannot be undone if they have payroll history.')) {
      return;
    }

    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete employee');
      }

      toast.success(result.message || 'Employee deleted');
      router.push('/dashboard/employees');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete employee');
    }
  };

  const formatCurrency = (amount: number, currency: string = 'UGX') => {
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
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      active: 'badge-success',
      on_leave: 'badge-warning',
      probation: 'badge-info',
      terminated: 'badge-danger',
    };

    return (
      <span className={`badge ${statusStyles[status] || 'badge'}`}>
        {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-breco-navy"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Employee not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/employees" className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {employee.first_name} {employee.last_name}
            </h1>
            <p className="text-gray-500 mt-1">{employee.employee_number} • {employee.job_title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/employees/${employeeId}/edit`}
            className="btn-primary flex items-center gap-2"
          >
            <PencilIcon className="w-4 h-4" />
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="btn-danger flex items-center gap-2"
          >
            <TrashIcon className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Status Badge */}
      <div>{getStatusBadge(employee.employment_status)}</div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <UserIcon className="w-5 h-5" />
                Personal Information
              </h2>
            </div>
            <div className="card-body grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium">{employee.first_name} {employee.other_names} {employee.last_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date of Birth</p>
                <p className="font-medium">{formatDate(employee.date_of_birth)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Gender</p>
                <p className="font-medium">{employee.gender || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Nationality</p>
                <p className="font-medium">{employee.nationality}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">National ID</p>
                <p className="font-medium">{employee.national_id || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">NSSF Number</p>
                <p className="font-medium">{employee.nssf_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">TIN Number</p>
                <p className="font-medium">{employee.tin || '-'}</p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <EnvelopeIcon className="w-5 h-5" />
                Contact Information
              </h2>
            </div>
            <div className="card-body grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{employee.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{employee.phone || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">{employee.address || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Emergency Contact</p>
                <p className="font-medium">{employee.emergency_contact_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Emergency Phone</p>
                <p className="font-medium">{employee.emergency_contact_phone || '-'}</p>
              </div>
            </div>
          </div>

          {/* Employment Details */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BuildingOfficeIcon className="w-5 h-5" />
                Employment Details
              </h2>
            </div>
            <div className="card-body grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Job Title</p>
                <p className="font-medium">{employee.job_title}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Department</p>
                <p className="font-medium">{employee.department || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Employment Type</p>
                <p className="font-medium capitalize">{employee.employment_type.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Hire Date</p>
                <p className="font-medium">{formatDate(employee.hire_date)}</p>
              </div>
              {employee.termination_date && (
                <div>
                  <p className="text-sm text-gray-500">Termination Date</p>
                  <p className="font-medium">{formatDate(employee.termination_date)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Bank Details */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BanknotesIcon className="w-5 h-5" />
                Bank Details
              </h2>
            </div>
            <div className="card-body grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Bank Name</p>
                <p className="font-medium">{employee.bank_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Branch</p>
                <p className="font-medium">{employee.bank_branch || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Account Number</p>
                <p className="font-medium">{employee.bank_account_number || '-'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Compensation */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CurrencyDollarIcon className="w-5 h-5" />
                Compensation
              </h2>
            </div>
            <div className="card-body space-y-3">
              <div>
                <p className="text-sm text-gray-500">Basic Salary</p>
                <p className="text-2xl font-bold text-breco-navy">
                  {formatCurrency(employee.basic_salary, employee.salary_currency)}
                </p>
                <p className="text-xs text-gray-400 capitalize">{employee.pay_frequency}</p>
              </div>
            </div>
          </div>

          {/* Allowances */}
          {allowances.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-base font-semibold">Allowances</h2>
              </div>
              <div className="card-body space-y-2">
                {allowances.map((allowance) => (
                  <div key={allowance.id} className="flex justify-between items-center">
                    <span className="text-sm">{allowance.allowance_type}</span>
                    <span className="font-medium">{formatCurrency(allowance.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deductions */}
          {deductions.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-base font-semibold">Deductions</h2>
              </div>
              <div className="card-body space-y-2">
                {deductions.map((deduction) => (
                  <div key={deduction.id} className="flex justify-between items-center">
                    <span className="text-sm">{deduction.deduction_type}</span>
                    <span className="font-medium text-red-600">
                      {deduction.is_percentage ? `${deduction.amount}%` : formatCurrency(deduction.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Payslips */}
          {recentPayslips.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-base font-semibold">Recent Payslips</h2>
              </div>
              <div className="card-body space-y-2">
                {recentPayslips.map((payslip: any) => (
                  <div key={payslip.id} className="border-b pb-2 last:border-0">
                    <p className="text-sm font-medium">{payslip.payroll_period?.period_name}</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(payslip.net_salary)}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(payslip.payroll_period?.payment_date)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

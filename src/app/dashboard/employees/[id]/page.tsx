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
  PrinterIcon,
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
  tin_number: string | null;
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

  const handlePrint = () => {
    if (!employee) return;

    const printHTML = `
      <html>
        <head>
          <title>Employee Details - ${employee.first_name} ${employee.last_name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #111827;
              background: white;
              padding: 40px;
              max-width: 1200px;
              margin: 0 auto;
            }
            .header { 
              display: flex; 
              align-items: center; 
              justify-content: space-between;
              margin-bottom: 30px;
              border-bottom: 3px solid #1e3a5f;
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
            .document-header { 
              text-align: right;
            }
            .document-header h2 { 
              font-size: 28px; 
              font-weight: bold; 
              color: #1e3a5f;
              margin-bottom: 8px;
            }
            .document-header .employee-number { 
              font-size: 14px; 
              color: #6b7280;
            }
            .employee-name {
              font-size: 20px;
              font-weight: 600;
              color: #1e3a5f;
              margin: 20px 0 10px 0;
            }
            .job-title {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 20px;
            }
            .section { 
              margin-bottom: 30px;
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              border: 1px solid #e5e7eb;
              page-break-inside: avoid;
            }
            .section h3 { 
              font-size: 16px; 
              font-weight: 600; 
              color: #1e3a5f;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #e5e7eb;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
            }
            .info-item {
              display: flex;
              flex-direction: column;
            }
            .info-label {
              font-size: 11px;
              font-weight: 600;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 4px;
            }
            .info-value {
              font-size: 14px;
              color: #111827;
              font-weight: 500;
            }
            .compensation-section {
              background: #eff6ff;
              border: 1px solid #bfdbfe;
            }
            .salary-amount {
              font-size: 24px;
              font-weight: bold;
              color: #1e3a5f;
            }
            .allowances-grid, .deductions-grid {
              display: grid;
              grid-template-columns: 1fr auto;
              gap: 10px;
              margin-top: 10px;
            }
            .allowance-item, .deduction-item {
              display: contents;
            }
            .allowance-name, .deduction-name {
              font-size: 13px;
              color: #374151;
            }
            .allowance-amount {
              font-size: 13px;
              font-weight: 600;
              color: #059669;
              text-align: right;
            }
            .deduction-amount {
              font-size: 13px;
              font-weight: 600;
              color: #dc2626;
              text-align: right;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              text-align: center;
              font-size: 11px;
              color: #9ca3af;
            }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-section">
              <img src="${window.location.origin}/assets/logo.jpg" alt="Breco Safaris" class="logo" onerror="this.style.display='none'">
              <div class="company-info">
                <h1>Breco Safaris Ltd</h1>
                <p class="address">Plot 123, Kampala Road</p>
                <p class="address">Kampala, Uganda</p>
                <p class="address">Tel: +256 123 456 789</p>
                <p class="address">Email: info@brecosafaris.com</p>
              </div>
            </div>
            <div class="document-header">
              <h2>EMPLOYEE DETAILS</h2>
              <p class="employee-number">${employee.employee_number}</p>
            </div>
          </div>

          <div class="employee-name">${employee.first_name} ${employee.last_name}</div>
          <div class="job-title">${employee.job_title || 'N/A'}</div>

          <div class="section">
            <h3>Personal Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Full Name</span>
                <span class="info-value">${employee.first_name} ${employee.last_name}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Date of Birth</span>
                <span class="info-value">${employee.date_of_birth ? formatDate(employee.date_of_birth) : '-'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Gender</span>
                <span class="info-value">${employee.gender || '-'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Nationality</span>
                <span class="info-value">${employee.nationality || '-'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">National ID</span>
                <span class="info-value">${employee.national_id || '-'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">NSSF Number</span>
                <span class="info-value">${employee.nssf_number || '-'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">TIN Number</span>
                <span class="info-value">${employee.tin_number || '-'}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Contact Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Email</span>
                <span class="info-value">${employee.email || '-'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Phone</span>
                <span class="info-value">${employee.phone || '-'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Address</span>
                <span class="info-value">${employee.address || '-'}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Employment Details</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Department</span>
                <span class="info-value">${employee.department || '-'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Position</span>
                <span class="info-value">${employee.job_title || '-'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Hire Date</span>
                <span class="info-value">${employee.hire_date ? formatDate(employee.hire_date) : '-'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Employment Type</span>
                <span class="info-value">${employee.employment_type || '-'}</span>
              </div>
            </div>
          </div>

          <div class="section compensation-section">
            <h3>Compensation</h3>
            <div class="info-item" style="margin-bottom: 15px;">
              <span class="info-label">Basic Salary</span>
              <span class="salary-amount">${formatCurrency(employee.basic_salary || 0)}</span>
              <span class="info-value" style="font-size: 12px; color: #6b7280;">Monthly</span>
            </div>
            
            ${allowances.length > 0 ? `
            <div style="margin-top: 20px;">
              <span class="info-label" style="display: block; margin-bottom: 10px;">Allowances</span>
              <div class="allowances-grid">
                ${allowances.map(allowance => `
                  <span class="allowance-name">${allowance.allowance_type}</span>
                  <span class="allowance-amount">${allowance.is_percentage ? allowance.amount + '%' : formatCurrency(allowance.amount)}</span>
                `).join('')}
              </div>
            </div>
            ` : ''}
            
            ${deductions.length > 0 ? `
            <div style="margin-top: 20px;">
              <span class="info-label" style="display: block; margin-bottom: 10px;">Deductions</span>
              <div class="deductions-grid">
                ${deductions.map(deduction => `
                  <span class="deduction-name">${deduction.deduction_type}</span>
                  <span class="deduction-amount">${deduction.is_percentage ? deduction.amount + '%' : formatCurrency(deduction.amount)}</span>
                `).join('')}
              </div>
            </div>
            ` : ''}
          </div>

          <div class="footer">
            <p>This is a confidential document.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
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
      }, 250);
    }
  };

  const getStatusBadge = (status: string) => {
    if (!status) return null;
    
    const statusStyles: Record<string, string> = {
      active: 'badge-success',
      on_leave: 'badge-warning',
      probation: 'badge-info',
      terminated: 'badge-danger',
    };

    return (
      <span className={`badge ${statusStyles[status] || 'badge'}`}>
        {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <PrinterIcon className="w-4 h-4" />
            Print
          </button>
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

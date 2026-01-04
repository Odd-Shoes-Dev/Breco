'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { CurrencySelect } from '@/components/ui';

export default function EmployeeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState<string>('');

  const [formData, setFormData] = useState({
    employee_number: '',
    first_name: '',
    last_name: '',
    other_names: '',
    email: '',
    phone: '',
    national_id: '',
    nssf_number: '',
    tin: '',
    date_of_birth: '',
    gender: '',
    nationality: 'Ugandan',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    job_title: '',
    department: '',
    employment_type: 'full_time' as 'full_time' | 'part_time' | 'contract' | 'casual',
    employment_status: 'active' as 'active' | 'on_leave' | 'terminated' | 'probation',
    hire_date: '',
    termination_date: '',
    basic_salary: 0,
    salary_currency: 'UGX',
    pay_frequency: 'monthly' as 'weekly' | 'bi_weekly' | 'monthly',
    bank_name: '',
    bank_branch: '',
    bank_account_number: '',
    bank_account_name: '',
    notes: '',
  });

  useEffect(() => {
    params.then(({ id }) => {
      setEmployeeId(id);
      fetchEmployee(id);
    });
  }, []);

  const fetchEmployee = async (id: string) => {
    try {
      const response = await fetch(`/api/employees/${id}`);
      if (!response.ok) throw new Error('Employee not found');
      
      const result = await response.json();
      const employee = result.data;

      setFormData({
        employee_number: employee.employee_number || '',
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        other_names: employee.other_names || '',
        email: employee.email || '',
        phone: employee.phone || '',
        national_id: employee.national_id || '',
        nssf_number: employee.nssf_number || '',
        tin: employee.tin || '',
        date_of_birth: employee.date_of_birth || '',
        gender: employee.gender || '',
        nationality: employee.nationality || 'Ugandan',
        address: employee.address || '',
        emergency_contact_name: employee.emergency_contact_name || '',
        emergency_contact_phone: employee.emergency_contact_phone || '',
        job_title: employee.job_title || '',
        department: employee.department || '',
        employment_type: employee.employment_type || 'full_time',
        employment_status: employee.employment_status || 'active',
        hire_date: employee.hire_date || '',
        termination_date: employee.termination_date || '',
        basic_salary: employee.basic_salary || 0,
        salary_currency: employee.salary_currency || 'UGX',
        pay_frequency: employee.pay_frequency || 'monthly',
        bank_name: employee.bank_name || '',
        bank_branch: employee.bank_branch || '',
        bank_account_number: employee.bank_account_number || '',
        bank_account_name: employee.bank_account_name || '',
        notes: employee.notes || '',
      });
    } catch (error) {
      console.error('Error fetching employee:', error);
      toast.error('Failed to load employee');
      router.push('/dashboard/employees');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update employee');
      }

      toast.success('Employee updated successfully');
      router.push(`/dashboard/employees/${employeeId}`);
    } catch (error: any) {
      console.error('Error updating employee:', error);
      toast.error(error.message || 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  const departmentOptions = ['Operations', 'Finance', 'Sales', 'Marketing', 'Administration', 'Guides', 'Drivers', 'IT'];
  const employmentTypes = [
    { value: 'full_time', label: 'Full Time' },
    { value: 'part_time', label: 'Part Time' },
    { value: 'contract', label: 'Contract' },
    { value: 'casual', label: 'Casual' },
  ];
  const employmentStatuses = [
    { value: 'active', label: 'Active' },
    { value: 'on_leave', label: 'On Leave' },
    { value: 'probation', label: 'Probation' },
    { value: 'terminated', label: 'Terminated' },
  ];

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
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/employees/${employeeId}`} className="btn-ghost p-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Employee</h1>
          <p className="text-gray-500 mt-1">Update employee information</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Personal Information</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="form-group">
                <label className="label">Employee Number *</label>
                <input
                  type="text"
                  value={formData.employee_number}
                  onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">First Name *</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">Last Name *</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">Other Names</label>
                <input
                  type="text"
                  value={formData.other_names}
                  onChange={(e) => setFormData({ ...formData, other_names: e.target.value })}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="label">Date of Birth</label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="label">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="input"
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Statutory Information */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Statutory Information</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="form-group">
                <label className="label">National ID</label>
                <input
                  type="text"
                  value={formData.national_id}
                  onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="label">NSSF Number</label>
                <input
                  type="text"
                  value={formData.nssf_number}
                  onChange={(e) => setFormData({ ...formData, nssf_number: e.target.value })}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="label">TIN Number</label>
                <input
                  type="text"
                  value={formData.tin}
                  onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Contact Information</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="label">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                />
              </div>
              <div className="form-group col-span-2">
                <label className="label">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input"
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label className="label">Emergency Contact Name</label>
                <input
                  type="text"
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="label">Emergency Contact Phone</label>
                <input
                  type="tel"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Employment Details */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Employment Details</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="form-group">
                <label className="label">Job Title *</label>
                <input
                  type="text"
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">Department</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="input"
                >
                  {departmentOptions.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Employment Type *</label>
                <select
                  value={formData.employment_type}
                  onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as any })}
                  className="input"
                  required
                >
                  {employmentTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Employment Status *</label>
                <select
                  value={formData.employment_status}
                  onChange={(e) => setFormData({ ...formData, employment_status: e.target.value as any })}
                  className="input"
                  required
                >
                  {employmentStatuses.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Hire Date *</label>
                <input
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  className="input"
                  required
                />
              </div>
              {formData.employment_status === 'terminated' && (
                <div className="form-group">
                  <label className="label">Termination Date</label>
                  <input
                    type="date"
                    value={formData.termination_date}
                    onChange={(e) => setFormData({ ...formData, termination_date: e.target.value })}
                    className="input"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Salary Information */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Salary Information</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="form-group">
                <label className="label">Basic Salary *</label>
                <input
                  type="number"
                  value={formData.basic_salary}
                  onChange={(e) => setFormData({ ...formData, basic_salary: parseFloat(e.target.value) || 0 })}
                  className="input"
                  min="0"
                  step="1000"
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">Currency</label>
                <CurrencySelect
                  value={formData.salary_currency}
                  onChange={(e) => setFormData({ ...formData, salary_currency: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="label">Pay Frequency</label>
                <select
                  value={formData.pay_frequency}
                  onChange={(e) => setFormData({ ...formData, pay_frequency: e.target.value as any })}
                  className="input"
                >
                  <option value="monthly">Monthly</option>
                  <option value="bi_weekly">Bi-Weekly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Bank Details</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="form-group">
                <label className="label">Bank Name</label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="label">Account Number</label>
                <input
                  type="text"
                  value={formData.bank_account_number}
                  onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="label">Branch</label>
                <input
                  type="text"
                  value={formData.bank_branch}
                  onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Notes</h2>
          </div>
          <div className="card-body">
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input"
              rows={3}
              placeholder="Additional notes about the employee..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href={`/dashboard/employees/${employeeId}`}
            className="btn-secondary"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

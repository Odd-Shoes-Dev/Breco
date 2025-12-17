'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { Employee } from '@/types/breco';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  IdentificationIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  CheckBadgeIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

type EmploymentStatus = 'active' | 'on_leave' | 'terminated' | 'probation';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    employee_number: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    national_id: '',
    nssf_number: '',
    tin: '',
    date_of_birth: '',
    hire_date: '',
    job_title: '',
    department: 'Operations',
    employment_type: 'full_time' as 'full_time' | 'part_time' | 'contract' | 'casual',
    pay_frequency: 'monthly' as 'weekly' | 'bi_weekly' | 'monthly',
    basic_salary: 0,
    salary_currency: 'UGX',
    bank_name: '',
    bank_account_number: '',
    bank_branch: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    address: '',
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('first_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('employees')
        .insert([{
          ...formData,
          date_of_birth: formData.date_of_birth || null,
          is_active: true, // New employees are active by default
        }]);

      if (error) throw error;
      
      toast.success('Employee added successfully');
      setShowCreateModal(false);
      setFormData({
        employee_number: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        national_id: '',
        nssf_number: '',
        tin: '',
        date_of_birth: '',
        hire_date: '',
        job_title: '',
        department: 'Operations',
        employment_type: 'full_time',
        pay_frequency: 'monthly',
        basic_salary: 0,
        salary_currency: 'UGX',
        bank_name: '',
        bank_account_number: '',
        bank_branch: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        address: '',
      });
      fetchEmployees();
    } catch (error: any) {
      console.error('Error creating employee:', error);
      const errorMessage = error?.message || 'Failed to add employee';
      toast.error(errorMessage);
    }
  };

  const updateStatus = async (employee: Employee, newStatus: EmploymentStatus) => {
    try {
      const updateData: any = { employment_status: newStatus };
      if (newStatus === 'terminated') {
        updateData.termination_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('employees')
        .update(updateData)
        .eq('id', employee.id);

      if (error) throw error;
      
      setEmployees(prev => 
        prev.map(e => e.id === employee.id ? { ...e, ...updateData } : e)
      );
      
      toast.success('Status updated');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee record?')) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setEmployees(prev => prev.filter(e => e.id !== id));
      toast.success('Employee deleted');
    } catch (error) {
      toast.error('Failed to delete employee');
    }
  };

  const departments = [...new Set(employees.map(e => e.department).filter((d): d is string => Boolean(d)))];
  
  const filteredEmployees = employees.filter(employee => {
    const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase();
    const matchesSearch = 
      fullName.includes(searchQuery.toLowerCase()) ||
      employee.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.employee_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.job_title?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || employee.employment_status === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || employee.department === departmentFilter;
    
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge-success flex items-center gap-1"><CheckBadgeIcon className="w-3 h-3" /> Active</span>;
      case 'on_leave':
        return <span className="badge-warning flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> On Leave</span>;
      case 'probation':
        return <span className="badge-info flex items-center gap-1"><UserIcon className="w-3 h-3" /> Probation</span>;
      case 'terminated':
        return <span className="badge-danger flex items-center gap-1"><XCircleIcon className="w-3 h-3" /> Terminated</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const formatCurrency = (amount: number | null, currency: string = 'UGX') => {
    if (!amount) return '-';
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

  const departmentOptions = ['Operations', 'Finance', 'Sales', 'Marketing', 'Administration', 'Guides', 'Drivers', 'IT'];
  const employmentTypes = [
    { value: 'full_time', label: 'Full Time' },
    { value: 'part_time', label: 'Part Time' },
    { value: 'contract', label: 'Contract' },
    { value: 'casual', label: 'Casual' },
  ];
  const statuses: EmploymentStatus[] = ['active', 'on_leave', 'probation', 'terminated'];

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
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 mt-1">Manage staff and payroll information</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Add Employee
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
          <p className="text-sm text-gray-500">Total Employees</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-green-600">
            {employees.filter(e => e.employment_status === 'active').length}
          </p>
          <p className="text-sm text-gray-500">Active</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-blue-600">
            {employees.filter(e => e.employment_status === 'probation').length}
          </p>
          <p className="text-sm text-gray-500">On Probation</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-breco-navy">
            {formatCurrency(
              employees
                .filter(e => e.is_active)
                .reduce((sum, e) => sum + (e.basic_salary || 0), 0),
              'UGX'
            )}
          </p>
          <p className="text-sm text-gray-500">Monthly Payroll</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-full sm:w-44"
          >
            <option value="all">All Statuses</option>
            {statuses.map(status => (
              <option key={status} value={status}>
                {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="input w-full sm:w-44"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Table */}
      {filteredEmployees.length === 0 ? (
        <div className="card p-12 text-center">
          <UserGroupIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
          <p className="text-gray-500 mb-4">Add your first employee</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Add Employee
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Position</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Hire Date</th>
                  <th>Salary</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className={employee.employment_status === 'terminated' ? 'opacity-50' : ''}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-breco-navy/10 rounded-full flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-breco-navy" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {employee.first_name} {employee.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{employee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="font-medium">{employee.job_title || '-'}</p>
                      <p className="text-xs text-gray-400">
                        {employee.employee_number}
                      </p>
                    </td>
                    <td>{employee.department || '-'}</td>
                    <td>{getStatusBadge(employee.employment_status)}</td>
                    <td>{formatDate(employee.hire_date)}</td>
                    <td>
                      <p className="font-medium">
                        {formatCurrency(employee.basic_salary, employee.salary_currency)}
                      </p>
                      <p className="text-xs text-gray-400">{employee.pay_frequency}</p>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/employees/${employee.id}`}
                          className="btn-secondary btn-sm"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/dashboard/employees/${employee.id}/edit`}
                          className="btn-secondary btn-sm"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => deleteEmployee(employee.id)}
                          className="btn-sm btn-danger"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h2 className="text-lg font-semibold">Add Employee</h2>
            </div>
            <form onSubmit={handleCreateEmployee} className="card-body space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Personal Information */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="label">Employee Number *</label>
                    <input
                      type="text"
                      value={formData.employee_number}
                      onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                      className="input"
                      placeholder="EMP001"
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
                  <div className="form-group">
                    <label className="label">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              {/* Statutory IDs */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Statutory Information</h3>
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

              {/* Employment Details */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Employment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="label">Job Title</label>
                    <input
                      type="text"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                      className="input"
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
                    <label className="label">Employment Type</label>
                    <select
                      value={formData.employment_type}
                      onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as any })}
                      className="input"
                    >
                      {employmentTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
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
                </div>
              </div>

              {/* Salary Information */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Salary Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="label">Basic Salary</label>
                    <input
                      type="number"
                      value={formData.basic_salary}
                      onChange={(e) => setFormData({ ...formData, basic_salary: parseFloat(e.target.value) })}
                      className="input"
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Currency</label>
                    <select
                      value={formData.salary_currency}
                      onChange={(e) => setFormData({ ...formData, salary_currency: e.target.value })}
                      className="input"
                    >
                      <option value="UGX">UGX - Ugandan Shilling</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                    </select>
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

              {/* Bank Details */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Bank Details</h3>
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

              <div className="flex items-center gap-4 pt-4 border-t">
                <button type="submit" className="btn-primary">
                  Add Employee
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
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
}

export default function NewSalaryAdvancePage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    advance_date: new Date().toISOString().split('T')[0],
    amount: '',
    reason: '',
    repayment_months: '1',
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_number')
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('salary_advances')
        .insert({
          employee_id: formData.employee_id,
          advance_date: formData.advance_date,
          amount: parseFloat(formData.amount),
          reason: formData.reason || null,
          repayment_months: parseInt(formData.repayment_months),
          status: 'pending',
          created_by: user.id,
        });

      if (error) throw error;

      toast.success('Salary advance request created successfully');
      router.push('/dashboard/employees/advances');
    } catch (error: any) {
      console.error('Error creating salary advance:', error);
      toast.error(error.message || 'Failed to create salary advance');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/employees/advances"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Salary Advance</h1>
          <p className="text-gray-500 mt-1">Create a salary advance request</p>
        </div>
      </div>

      {/* Form */}
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Employee */}
            <div>
              <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700 mb-2">
                Employee *
              </label>
              <select
                id="employee_id"
                name="employee_id"
                value={formData.employee_id}
                onChange={handleChange}
                required
                className="input"
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_number})
                  </option>
                ))}
              </select>
            </div>

            {/* Advance Date */}
            <div>
              <label htmlFor="advance_date" className="block text-sm font-medium text-gray-700 mb-2">
                Advance Date *
              </label>
              <input
                type="date"
                id="advance_date"
                name="advance_date"
                value={formData.advance_date}
                onChange={handleChange}
                required
                className="input"
              />
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount (UGX) *
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                required
                min="0"
                step="1000"
                placeholder="0"
                className="input"
              />
            </div>

            {/* Repayment Months */}
            <div>
              <label htmlFor="repayment_months" className="block text-sm font-medium text-gray-700 mb-2">
                Repayment Period (Months) *
              </label>
              <select
                id="repayment_months"
                name="repayment_months"
                value={formData.repayment_months}
                onChange={handleChange}
                required
                className="input"
              >
                {[1, 2, 3, 4, 5, 6, 9, 12].map((months) => (
                  <option key={months} value={months}>
                    {months} {months === 1 ? 'Month' : 'Months'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason
            </label>
            <textarea
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows={3}
              placeholder="Brief description of the reason for this advance..."
              className="input"
            />
          </div>

          {/* Monthly Deduction Preview */}
          {formData.amount && formData.repayment_months && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-1">Monthly Deduction Preview:</p>
              <p className="text-2xl font-bold text-blue-900">
                {new Intl.NumberFormat('en-UG', {
                  style: 'currency',
                  currency: 'UGX',
                  minimumFractionDigits: 0,
                }).format(parseFloat(formData.amount) / parseInt(formData.repayment_months))}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                This amount will be deducted from the employee's salary each month for {formData.repayment_months} {parseInt(formData.repayment_months) === 1 ? 'month' : 'months'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Advance Request'}
            </button>
            <Link href="/dashboard/employees/advances" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

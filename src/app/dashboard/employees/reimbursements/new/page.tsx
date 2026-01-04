'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { ArrowLeftIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
}

const EXPENSE_TYPES = [
  'Travel',
  'Meals',
  'Accommodation',
  'Communication',
  'Fuel',
  'Office Supplies',
  'Client Entertainment',
  'Medical',
  'Training',
  'Other',
];

export default function NewReimbursementPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    reimbursement_date: new Date().toISOString().split('T')[0],
    expense_type: '',
    description: '',
    amount: '',
    receipt_url: '',
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and PDF files are allowed');
      return;
    }

    setUploadingReceipt(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      setFormData({
        ...formData,
        receipt_url: publicUrl,
      });

      toast.success('Receipt uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading receipt:', error);
      toast.error(error.message || 'Failed to upload receipt');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('employee_reimbursements')
        .insert({
          employee_id: formData.employee_id,
          reimbursement_date: formData.reimbursement_date,
          expense_type: formData.expense_type,
          description: formData.description || null,
          amount: parseFloat(formData.amount),
          receipt_url: formData.receipt_url || null,
          status: 'pending',
          created_by: user.id,
        });

      if (error) throw error;

      toast.success('Reimbursement request created successfully');
      router.push('/dashboard/employees/reimbursements');
    } catch (error: any) {
      console.error('Error creating reimbursement:', error);
      toast.error(error.message || 'Failed to create reimbursement');
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
          href="/dashboard/employees/reimbursements"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Reimbursement Request</h1>
          <p className="text-gray-500 mt-1">Create an employee expense reimbursement request</p>
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

            {/* Reimbursement Date */}
            <div>
              <label htmlFor="reimbursement_date" className="block text-sm font-medium text-gray-700 mb-2">
                Expense Date *
              </label>
              <input
                type="date"
                id="reimbursement_date"
                name="reimbursement_date"
                value={formData.reimbursement_date}
                onChange={handleChange}
                required
                className="input"
              />
            </div>

            {/* Expense Type */}
            <div>
              <label htmlFor="expense_type" className="block text-sm font-medium text-gray-700 mb-2">
                Expense Type *
              </label>
              <select
                id="expense_type"
                name="expense_type"
                value={formData.expense_type}
                onChange={handleChange}
                required
                className="input"
              >
                <option value="">Select Expense Type</option>
                {EXPENSE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
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
                step="100"
                placeholder="0"
                className="input"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Brief description of the expense..."
              className="input"
            />
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receipt/Invoice (Optional)
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors">
                <CloudArrowUpIcon className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {uploadingReceipt ? 'Uploading...' : 'Upload Receipt'}
                </span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  className="hidden"
                  disabled={uploadingReceipt}
                />
              </label>
              {formData.receipt_url && (
                <a
                  href={formData.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-breco-navy hover:underline"
                >
                  View uploaded receipt
                </a>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Supported formats: JPG, PNG, PDF (Max 5MB)
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Reimbursement Request'}
            </button>
            <Link href="/dashboard/employees/reimbursements" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

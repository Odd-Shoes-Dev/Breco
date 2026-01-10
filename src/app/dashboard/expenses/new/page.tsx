'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  CreditCardIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { CurrencySelect } from '@/components/ui';

interface Vendor {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  code: string;
}

export default function NewExpensePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);

  const [formData, setFormData] = useState({
    vendor_id: '',
    expense_date: new Date().toISOString().split('T')[0],
    category: '',
    department: '',
    expense_account_id: '',
    description: '',
    amount: 0,
    tax_amount: 0,
    payment_method: 'bank_transfer',
    reference_number: '',
    is_billable: false,
    notes: '',
    currency: 'USD',
  });

  const [attachments, setAttachments] = useState<File[]>([]);
  useEffect(() => {
    fetchVendors();
    fetchExpenseAccounts();
  }, []);

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/vendors?active=true');
      const result = await response.json();
      setVendors(result.data || []);
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      setVendors([]);
    }
  };

  const fetchExpenseAccounts = async () => {
    try {
      const response = await fetch('/api/accounts?type=expense&active=true');
      const result = await response.json();
      setExpenseAccounts(result.data || []);
      // Set default expense account if available
      if (result.data && result.data.length > 0) {
        setFormData(prev => ({ ...prev, expense_account_id: result.data[0].id }));
      }
    } catch (error) {
      console.error('Failed to fetch expense accounts:', error);
      setExpenseAccounts([]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked
        : type === 'number' 
          ? Number(value) 
          : value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).filter(file => {
        const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
        const maxSize = 10 * 1024 * 1024; // 10MB
        return validTypes.includes(file.type) && file.size <= maxSize;
      });
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let receiptUrl = null;

      // Upload attachment if exists
      if (attachments.length > 0) {
        const file = attachments[0]; // Take the first file
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `expense-receipts/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error('Failed to upload receipt');
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);

        receiptUrl = publicUrl;
      }

      // Prepare the payload
      const payload = {
        expense_date: formData.expense_date,
        amount: formData.amount,
        expense_account_id: formData.expense_account_id,
        vendor_id: formData.vendor_id || null,
        description: formData.description,
        payment_method: formData.payment_method,
        currency: formData.currency,
        reference: formData.reference_number || null,
        notes: formData.notes || null,
        receipt_url: receiptUrl,
      };

      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create expense');
      }

      router.push('/dashboard/expenses');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const expenseCategories = [
    { value: 'office_supplies', label: 'Office Supplies' },
    { value: 'software', label: 'Software & Subscriptions' },
    { value: 'marketing', label: 'Marketing & Advertising' },
    { value: 'travel', label: 'Travel & Transportation' },
    { value: 'meals', label: 'Meals & Entertainment' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'rent', label: 'Rent & Lease' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'professional_services', label: 'Professional Services' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'inventory', label: 'Inventory/COGS' },
    { value: 'other', label: 'Other' },
  ];

  const paymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'check', label: 'Check' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'debit_card', label: 'Debit Card' },
    { value: 'bank_transfer', label: 'Bank Transfer / ACH' },
    { value: 'wire', label: 'Wire Transfer' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/expenses"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Record Expense</h1>
          <p className="text-gray-600">Log a new business expense</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CreditCardIcon className="w-5 h-5 text-[#52b53b]" />
            <h2 className="font-semibold text-gray-900">Expense Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="expense_date"
                value={formData.expense_date}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expense Account <span className="text-red-500">*</span>
              </label>
              <select
                name="expense_account_id"
                value={formData.expense_account_id}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">Select account...</option>
                {expenseAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">Select category...</option>
                {expenseCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">Select department...</option>
                <option value="Operations">Operations</option>
                <option value="Cafe">Cafe</option>
                <option value="Administration">Administration</option>
                <option value="Sales">Sales</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor
              </label>
              <select
                name="vendor_id"
                value={formData.vendor_id}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">No vendor / General expense</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                name="payment_method"
                value={formData.payment_method}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency <span className="text-red-500">*</span>
              </label>
              <CurrencySelect
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="What was this expense for?"
              />
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Amount</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Amount
              </label>
              <input
                type="number"
                name="tax_amount"
                value={formData.tax_amount}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total
              </label>
              <div className="h-10 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-medium text-gray-900">
                {currencyFormatter(formData.amount + formData.tax_amount, formData.currency as any)}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Additional Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference / Receipt Number
              </label>
              <input
                type="text"
                name="reference_number"
                value={formData.reference_number}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="Receipt #, check #, etc."
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_billable"
                  checked={formData.is_billable}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-[#52b53b] focus:ring-[#52b53b]"
                />
                <span className="text-sm text-gray-700">Billable to customer</span>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="Additional notes..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attachments
              </label>
              <input
                type="file"
                id="file-upload"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
              >
                <PaperClipIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  Drag & drop receipt or click to upload
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG up to 10MB</p>
              </label>
              
              {attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-center gap-2">
                        <PaperClipIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/dashboard/expenses"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-[#52b53b] text-white rounded-lg text-sm font-medium hover:bg-[#449932] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Recording...' : 'Record Expense'}
          </button>
        </div>
      </form>
    </div>
  );
}


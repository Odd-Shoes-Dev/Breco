'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase/client';

interface Vendor {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  code: string;
}

interface Expense {
  id: string;
  expense_number: string;
  expense_date: string;
  payee: string | null;
  vendor_id: string | null;
  amount: number;
  tax_amount: number;
  payment_method: string;
  reference_number: string | null;
  expense_account_id: string;
  payment_account_id: string;
  category: string | null;
  department: string | null;
  description: string | null;
  is_reimbursable: boolean;
  is_billable: boolean;
}

export default function EditExpensePage() {
  const params = useParams();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<Account[]>([]);
  const [expense, setExpense] = useState<Expense | null>(null);

  const [formData, setFormData] = useState({
    vendor_id: '',
    payee: '',
    expense_date: '',
    category: '',
    department: '',
    expense_account_id: '',
    payment_account_id: '',
    description: '',
    amount: 0,
    tax_amount: 0,
    payment_method: 'bank_transfer',
    reference_number: '',
    is_reimbursable: false,
    is_billable: false,
  });

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchVendors(),
        fetchExpenseAccounts(),
        fetchPaymentAccounts(),
      ]);
      await loadExpense();
    };
    loadData();
  }, [params.id]);

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
    } catch (error) {
      console.error('Failed to fetch expense accounts:', error);
      setExpenseAccounts([]);
    }
  };

  const fetchPaymentAccounts = async () => {
    try {
      const response = await fetch('/api/accounts?type=asset&active=true');
      const result = await response.json();
      setPaymentAccounts(result.data || []);
    } catch (error) {
      console.error('Failed to fetch payment accounts:', error);
      setPaymentAccounts([]);
    }
  };

  const loadExpense = async () => {
    try {
      setLoading(true);

      const { data, error: expenseError } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', params.id)
        .single();

      if (expenseError) throw expenseError;

      setExpense(data);
      setFormData({
        vendor_id: data.vendor_id || '',
        payee: data.payee || '',
        expense_date: data.expense_date,
        category: data.category || '',
        department: data.department || '',
        expense_account_id: data.expense_account_id,
        payment_account_id: data.payment_account_id,
        description: data.description || '',
        amount: parseFloat(data.amount),
        tax_amount: parseFloat(data.tax_amount),
        payment_method: data.payment_method,
        reference_number: data.reference_number || '',
        is_reimbursable: data.is_reimbursable,
        is_billable: data.is_billable,
      });
    } catch (error) {
      console.error('Failed to load expense:', error);
      setError('Failed to load expense');
    } finally {
      setLoading(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const total = formData.amount + formData.tax_amount;

      const { error: updateError } = await supabase
        .from('expenses')
        .update({
          vendor_id: formData.vendor_id || null,
          payee: formData.payee || null,
          expense_date: formData.expense_date,
          category: formData.category || null,
          department: formData.department || null,
          expense_account_id: formData.expense_account_id,
          payment_account_id: formData.payment_account_id,
          description: formData.description,
          amount: formData.amount,
          tax_amount: formData.tax_amount,
          total: total,
          payment_method: formData.payment_method,
          reference_number: formData.reference_number || null,
          is_reimbursable: formData.is_reimbursable,
          is_billable: formData.is_billable,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id);

      if (updateError) throw updateError;

      router.push(`/dashboard/expenses/${params.id}`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-breco-navy"></div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Expense not found</p>
        <Link href="/dashboard/expenses" className="btn-primary mt-4">
          Back to Expenses
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/dashboard/expenses/${params.id}`}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Expense</h1>
          <p className="text-gray-600">{expense.expense_number}</p>
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
                Vendor
              </label>
              <select
                name="vendor_id"
                value={formData.vendor_id}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">Select vendor...</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payee (if no vendor)
              </label>
              <input
                type="text"
                name="payee"
                value={formData.payee}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="Enter payee name"
              />
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
                Payment Account <span className="text-red-500">*</span>
              </label>
              <select
                name="payment_account_id"
                value={formData.payment_account_id}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">Select account...</option>
                {paymentAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
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
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  name="tax_amount"
                  value={formData.tax_amount}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="text"
                  value={(formData.amount + formData.tax_amount).toFixed(2)}
                  disabled
                  className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm bg-gray-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Payment Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                name="payment_method"
                value={formData.payment_method}
                onChange={handleChange}
                required
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
          </div>
        </div>

        {/* Additional Options */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Additional Options</h2>

          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_reimbursable"
                checked={formData.is_reimbursable}
                onChange={handleChange}
                className="rounded border-gray-300 text-[#52b53b] focus:ring-[#52b53b]"
              />
              <span className="text-sm text-gray-700">Reimbursable expense</span>
            </label>

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
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/dashboard/expenses/${params.id}`}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-[#52b53b] text-white rounded-lg text-sm font-medium hover:bg-[#449932] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

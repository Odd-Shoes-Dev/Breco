'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, cn } from '@/lib/utils';

interface LineItem {
  id: string;
  accountCode: string;
  accountName: string;
  accountId: string;
  description: string;
  debit: number;
  credit: number;
}

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
}

interface JournalEntryForm {
  entryNumber: string;
  date: string;
  reference: string;
  description: string;
  type: 'Manual' | 'System' | 'Adjustment' | 'Closing';
  lineItems: LineItem[];
}

export default function NewJournalEntryPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [formData, setFormData] = useState<JournalEntryForm>({
    entryNumber: `JE-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    type: 'Manual',
    lineItems: [
      {
        id: '1',
        accountCode: '',
        accountName: '',
        accountId: '',
        description: '',
        debit: 0,
        credit: 0,
      },
      {
        id: '2',
        accountCode: '',
        accountName: '',
        accountId: '',
        description: '',
        debit: 0,
        credit: 0,
      }
    ]
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load accounts from database
  useEffect(() => {
    const fetchAccounts = async () => {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const result = await res.json();
        setAccounts(result.data || result || []);
      }
    };
    fetchAccounts();
  }, []);

  const addLineItem = () => {
    const newLineItem: LineItem = {
      id: String(Date.now()),
      accountCode: '',
      accountName: '',
      accountId: '',
      description: '',
      debit: 0,
      credit: 0,
    };
    setFormData(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, newLineItem]
    }));
  };

  const removeLineItem = (id: string) => {
    if (formData.lineItems.length <= 2) return; // Keep at least 2 line items
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter(item => item.id !== id)
    }));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          
          // If account ID changes, update account code and name
          if (field === 'accountId') {
            const account = accounts.find(acc => acc.id === value);
            if (account) {
              updatedItem.accountCode = account.code;
              updatedItem.accountName = account.name;
            }
          }
          
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const getTotalDebits = () => {
    return formData.lineItems.reduce((sum, item) => sum + (item.debit || 0), 0);
  };

  const getTotalCredits = () => {
    return formData.lineItems.reduce((sum, item) => sum + (item.credit || 0), 0);
  };

  const isBalanced = () => {
    const debits = getTotalDebits();
    const credits = getTotalCredits();
    return Math.abs(debits - credits) < 0.01 && debits > 0 && credits > 0;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.reference.trim()) {
      newErrors.reference = 'Reference is required';
    }

    // Validate line items
    formData.lineItems.forEach((item, index) => {
      if (!item.accountId) {
        newErrors[`lineItem_${index}_account`] = 'Account is required';
      }
      if (!item.description.trim()) {
        newErrors[`lineItem_${index}_description`] = 'Description is required';
      }
      if (item.debit === 0 && item.credit === 0) {
        newErrors[`lineItem_${index}_amount`] = 'Either debit or credit amount is required';
      }
      if (item.debit > 0 && item.credit > 0) {
        newErrors[`lineItem_${index}_amount`] = 'Cannot have both debit and credit amounts';
      }
    });

    if (!isBalanced()) {
      newErrors.balance = 'Entry must be balanced (total debits must equal total credits)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Prepare the data for API
      const requestData = {
        entry_date: formData.date,
        description: formData.description,
        reference: formData.reference,
        source: formData.type.toLowerCase(),
        source_id: null,
        is_posted: true,  // Post immediately
        lines: formData.lineItems.map(item => ({
          account_id: item.accountId,
          debit_amount: item.debit || 0,
          credit_amount: item.credit || 0,
          description: item.description,
        })),
      };

      const response = await fetch('/api/journal-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create journal entry');
      }

      const result = await response.json();
      console.log('Journal entry created:', result);
      
      // Redirect to general ledger
      router.push('/dashboard/general-ledger');
      
    } catch (error) {
      console.error('Error creating journal entry:', error);
      alert(error instanceof Error ? error.message : 'Failed to create journal entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      // Prepare the data for API
      const requestData = {
        entry_date: formData.date,
        description: formData.description,
        reference: formData.reference,
        source: formData.type.toLowerCase(),
        source_id: null,
        is_posted: false,  // Save as draft
        lines: formData.lineItems.map(item => ({
          account_id: item.accountId,
          debit_amount: item.debit || 0,
          credit_amount: item.credit || 0,
          description: item.description,
        })),
      };

      const response = await fetch('/api/journal-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save draft');
      }

      const result = await response.json();
      console.log('Draft saved:', result);
      
      // Redirect to general ledger
      router.push('/dashboard/general-ledger');
      
    } catch (error) {
      console.error('Error saving draft:', error);
      alert(error instanceof Error ? error.message : 'Failed to save draft. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/dashboard/reports/journal-entries" className="btn-ghost p-1.5 sm:p-2">
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">New Journal Entry</h1>
            <p className="text-sm sm:text-base text-gray-600">Create a new accounting journal entry</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Entry Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-4">
            <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
            <h3 className="text-sm sm:text-base font-semibold text-gray-900">Entry Details</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entry Number</label>
              <input
                type="text"
                value={formData.entryNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, entryNumber: e.target.value }))}
                className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy bg-gray-50"
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
              >
                <option value="Manual">Manual</option>
                <option value="Adjustment">Adjustment</option>
                <option value="Closing">Closing</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                placeholder="Invoice #, Check #, etc."
                className={cn(
                  "block w-full px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy",
                  errors.reference ? "border-red-300" : "border-gray-300"
                )}
                required
              />
              {errors.reference && (
                <p className="mt-1 text-xs text-red-600">{errors.reference}</p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the purpose of this journal entry..."
              rows={3}
              className={cn(
                "block w-full px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy",
                errors.description ? "border-red-300" : "border-gray-300"
              )}
              required
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">{errors.description}</p>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Line Items</h3>
              </div>
              <button
                type="button"
                onClick={addLineItem}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-breco-navy hover:bg-breco-navy/10 rounded-md"
              >
                <PlusIcon className="w-3 h-3" />
                Add Line
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {formData.lineItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <select
                        value={item.accountId}
                        onChange={(e) => updateLineItem(item.id, 'accountId', e.target.value)}
                        className={cn(
                          "block w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-breco-navy focus:border-breco-navy",
                          errors[`lineItem_${index}_account`] ? "border-red-300" : "border-gray-300"
                        )}
                        required
                      >
                        <option value="">Select Account</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                      {errors[`lineItem_${index}_account`] && (
                        <p className="mt-1 text-xs text-red-600">{errors[`lineItem_${index}_account`]}</p>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        placeholder="Line item description..."
                        className={cn(
                          "block w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-breco-navy focus:border-breco-navy",
                          errors[`lineItem_${index}_description`] ? "border-red-300" : "border-gray-300"
                        )}
                        required
                      />
                      {errors[`lineItem_${index}_description`] && (
                        <p className="mt-1 text-xs text-red-600">{errors[`lineItem_${index}_description`]}</p>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.debit || ''}
                        onChange={(e) => {
                          const value = e.target.value ? parseFloat(e.target.value) : 0;
                          updateLineItem(item.id, 'debit', value);
                          if (value > 0) updateLineItem(item.id, 'credit', 0);
                        }}
                        placeholder="0.00"
                        className={cn(
                          "block w-full px-2 py-1 text-xs text-right tabular-nums border rounded focus:outline-none focus:ring-1 focus:ring-breco-navy focus:border-breco-navy",
                          errors[`lineItem_${index}_amount`] ? "border-red-300" : "border-gray-300"
                        )}
                      />
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.credit || ''}
                        onChange={(e) => {
                          const value = e.target.value ? parseFloat(e.target.value) : 0;
                          updateLineItem(item.id, 'credit', value);
                          if (value > 0) updateLineItem(item.id, 'debit', 0);
                        }}
                        placeholder="0.00"
                        className={cn(
                          "block w-full px-2 py-1 text-xs text-right tabular-nums border rounded focus:outline-none focus:ring-1 focus:ring-breco-navy focus:border-breco-navy",
                          errors[`lineItem_${index}_amount`] ? "border-red-300" : "border-gray-300"
                        )}
                      />
                      {errors[`lineItem_${index}_amount`] && (
                        <p className="mt-1 text-xs text-red-600">{errors[`lineItem_${index}_amount`]}</p>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      {formData.lineItems.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(item.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={2} className="px-3 sm:px-6 py-3 text-sm font-semibold text-gray-900">
                    Totals
                  </td>
                  <td className="px-3 sm:px-6 py-3 text-sm font-bold text-right tabular-nums text-red-600">
                    {formatCurrency(getTotalDebits())}
                  </td>
                  <td className="px-3 sm:px-6 py-3 text-sm font-bold text-right tabular-nums text-green-600">
                    {formatCurrency(getTotalCredits())}
                  </td>
                  <td className="px-3 sm:px-6 py-3 text-center">
                    {isBalanced() ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-500 mx-auto" />
                    ) : (
                      <XMarkIcon className="w-5 h-5 text-red-500 mx-auto" />
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {errors.balance && (
            <div className="px-4 sm:px-6 py-3 bg-red-50 border-t border-red-200">
              <p className="text-sm text-red-600">{errors.balance}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end">
          <Link
            href="/dashboard/reports/journal-entries"
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isBalanced()}
            className="inline-flex items-center justify-center px-4 py-2 bg-breco-navy text-white rounded-lg text-sm font-medium hover:bg-breco-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Entry'}
          </button>
        </div>
      </form>
    </div>
  );
}

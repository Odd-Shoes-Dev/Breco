'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency as currencyFormatter, SupportedCurrency } from '@/lib/currency';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase/client';

interface Vendor {
  id: string;
  name: string;
  payment_terms: number;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_cost: number;
  account_code: string;
  expense_account_id?: string;
  amount: number;
}

interface Bill {
  id: string;
  vendor_id: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  vendor_invoice_number: string | null;
  notes: string | null;
  status: string;
  currency?: SupportedCurrency;
}

export default function EditBillPage() {
  const params = useParams();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bill, setBill] = useState<Bill | null>(null);

  const [formData, setFormData] = useState({
    vendor_id: '',
    bill_date: '',
    due_date: '',
    vendor_invoice_number: '',
    notes: '',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  useEffect(() => {
    fetchVendors();
    loadBill();
  }, [params.id]);

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/vendors');
      const result = await response.json();
      setVendors(result.data || []);
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    }
  };

  const loadBill = async () => {
    try {
      setLoading(true);

      // Fetch bill
      const { data: billData, error: billError } = await supabase
        .from('bills')
        .select('*')
        .eq('id', params.id)
        .single();

      if (billError) throw billError;

      // Check if bill can be edited
      if (billData.status !== 'draft') {
        setError('Only draft bills can be edited');
        setLoading(false);
        return;
      }

      setBill(billData);
      setFormData({
        vendor_id: billData.vendor_id,
        bill_date: billData.bill_date,
        due_date: billData.due_date,
        vendor_invoice_number: billData.vendor_invoice_number || '',
        notes: billData.notes || '',
      });

      // Fetch bill lines
      const { data: linesData, error: linesError } = await supabase
        .from('bill_lines')
        .select('*')
        .eq('bill_id', params.id)
        .order('line_number');

      if (linesError) throw linesError;

      setLineItems(
        (linesData || []).map((line: any) => ({
          id: line.id,
          description: line.description,
          quantity: parseFloat(line.quantity),
          unit_cost: parseFloat(line.unit_cost),
          account_code: '',
          expense_account_id: line.expense_account_id,
          amount: parseFloat(line.line_total),
        }))
      );
    } catch (error) {
      console.error('Failed to load bill:', error);
      setError('Failed to load bill');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLineItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        updated.amount = updated.quantity * updated.unit_cost;
        return updated;
      })
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: Date.now().toString(), description: '', quantity: 1, unit_cost: 0, account_code: '5100', amount: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const total = subtotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Filter valid line items (must have description, quantity and amount > 0)
      const validLineItems = lineItems.filter(
        (item) => item.description.trim() && item.quantity > 0 && item.amount > 0
      );

      if (validLineItems.length === 0) {
        throw new Error('Please add at least one line item with description, quantity, and price');
      }

      const response = await fetch(`/api/bills/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          line_items: validLineItems,
          subtotal,
          total,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update bill');
      }

      router.push(`/dashboard/bills/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, bill?.currency || 'USD');
  };

  const expenseAccounts = [
    { code: '5100', name: 'Cost of Goods Sold' },
    { code: '6100', name: 'Operating Expenses' },
    { code: '6200', name: 'Office Supplies' },
    { code: '6300', name: 'Utilities' },
    { code: '6400', name: 'Professional Services' },
    { code: '6500', name: 'Marketing & Advertising' },
    { code: '6600', name: 'Insurance' },
    { code: '6700', name: 'Repairs & Maintenance' },
    { code: '6800', name: 'Travel & Entertainment' },
    { code: '1500', name: 'Inventory (Asset)' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="loading"></div>
      </div>
    );
  }

  if (error && !bill) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/dashboard/bills" className="btn-primary">
          Back to Bills
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/dashboard/bills/${params.id}`}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Bill</h1>
          <p className="text-gray-600">{bill?.bill_number}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bill Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <DocumentTextIcon className="w-5 h-5 text-[#52b53b]" />
            <h2 className="font-semibold text-gray-900">Bill Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor <span className="text-red-500">*</span>
              </label>
              <select
                name="vendor_id"
                value={formData.vendor_id}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52b53b]"
              >
                <option value="">Select a vendor...</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Invoice #
              </label>
              <input
                type="text"
                name="vendor_invoice_number"
                value={formData.vendor_invoice_number}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52b53b]"
                placeholder="Vendor's invoice #"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bill Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="bill_date"
                value={formData.bill_date}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52b53b]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52b53b]"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Line Items</h2>
            <button
              type="button"
              onClick={addLineItem}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#52b53b] hover:bg-gray-100 rounded-lg"
            >
              <PlusIcon className="w-4 h-4" />
              Add Line
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="pb-2 pr-2">Description</th>
                  <th className="pb-2 px-2 w-24">Account</th>
                  <th className="pb-2 px-2 w-20 text-right">Qty</th>
                  <th className="pb-2 px-2 w-28 text-right">Price</th>
                  <th className="pb-2 px-2 w-28 text-right">Amount</th>
                  <th className="pb-2 pl-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lineItems.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#52b53b]"
                        placeholder="Description *"
                        required
                      />
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={item.account_code}
                        onChange={(e) => handleLineItemChange(item.id, 'account_code', e.target.value)}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#52b53b]"
                      >
                        {expenseAccounts.map((acc) => (
                          <option key={acc.code} value={acc.code}>
                            {acc.code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(item.id, 'quantity', Number(e.target.value))}
                        min="1"
                        step="1"
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#52b53b]"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={item.unit_cost}
                        onChange={(e) => handleLineItemChange(item.id, 'unit_cost', Number(e.target.value))}
                        min="0"
                        step="0.01"
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#52b53b]"
                      />
                    </td>
                    <td className="py-2 px-2 text-right text-sm font-medium tabular-nums">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="py-2 pl-2">
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        disabled={lineItems.length === 1}
                        className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Notes</h2>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52b53b]"
            placeholder="Internal notes..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/dashboard/bills/${params.id}`}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !formData.vendor_id || total === 0}
            className="px-6 py-2 bg-[#52b53b] text-white rounded-lg text-sm font-medium hover:bg-[#449932] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { CurrencySelect } from '@/components/ui';

interface Vendor {
  id: string;
  name: string;
  payment_terms: number;
}

interface Product {
  id: string;
  name: string;
  unit_price: number;
  sku: string;
}

interface LineItem {
  id: string;
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  account_code: string;
  amount: number;
}

export default function NewBillPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [formData, setFormData] = useState({
    vendor_id: '',
    bill_number: '',
    bill_date: new Date().toISOString().split('T')[0],
    due_date: '',
    reference: '',
    notes: '',
    currency: 'USD',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', product_id: '', description: '', quantity: 1, unit_price: 0, account_code: '5100', amount: 0 },
  ]);

  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    USD: 1,
    EUR: 1,
    GBP: 1,
    UGX: 1,
  });

  const [previousCurrency, setPreviousCurrency] = useState('USD');

  useEffect(() => {
    fetchVendors();
    fetchProducts();
    fetchExchangeRates();
  }, []);

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch('/api/exchange-rates');
      const result = await response.json();
      if (result.data && Array.isArray(result.data)) {
        // Convert array to object with currency codes as keys
        const ratesMap: Record<string, number> = {
          USD: 1, // Base currency
        };
        
        // Get the most recent rate for each currency
        const latestRates = result.data.reduce((acc: any, rate: any) => {
          if (!acc[rate.to_currency] || new Date(rate.effective_date) > new Date(acc[rate.to_currency].effective_date)) {
            acc[rate.to_currency] = rate;
          }
          return acc;
        }, {});
        
        // Build rates map (USD to each currency)
        Object.values(latestRates).forEach((rate: any) => {
          if (rate.from_currency === 'USD') {
            ratesMap[rate.to_currency] = parseFloat(rate.rate);
          }
        });
        
        console.log('Exchange rates loaded:', ratesMap);
        setExchangeRates(ratesMap);
      }
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/vendors');
      const result = await response.json();
      setVendors(result.data || []);
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/inventory?active=true');
      const result = await response.json();
      setProducts(result.data || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-set due date based on vendor payment terms
    if (name === 'vendor_id') {
      const vendor = vendors.find((v) => v.id === value);
      if (vendor && formData.bill_date) {
        const billDate = new Date(formData.bill_date);
        billDate.setDate(billDate.getDate() + (vendor.payment_terms || 30));
        setFormData((prev) => ({ ...prev, due_date: billDate.toISOString().split('T')[0] }));
      }
    }

    if (name === 'bill_date') {
      const vendor = vendors.find((v) => v.id === formData.vendor_id);
      if (vendor) {
        const billDate = new Date(value);
        billDate.setDate(billDate.getDate() + (vendor.payment_terms || 30));
        setFormData((prev) => ({ ...prev, due_date: billDate.toISOString().split('T')[0] }));
      }
    }
  };

  const handleLineItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        updated.amount = updated.quantity * updated.unit_price;
        return updated;
      })
    );
  };

  const handleProductChange = (id: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      // Convert product price from USD to current currency
      const usdRate = exchangeRates['USD'] || 1;
      const currentRate = exchangeRates[formData.currency] || 1;
      const conversionFactor = currentRate / usdRate;
      const convertedPrice = product.unit_price * conversionFactor;
      
      setLineItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            product_id: productId,
            description: product.name,
            unit_price: Math.round(convertedPrice * 100) / 100,
            amount: Math.round(item.quantity * convertedPrice * 100) / 100,
          };
        })
      );
    }
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: Date.now().toString(), product_id: '', description: '', quantity: 1, unit_price: 0, account_code: '5100', amount: 0 },
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

      const response = await fetch('/api/bills', {
        method: 'POST',
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
        throw new Error(data.error || 'Failed to create bill');
      }

      router.push('/dashboard/bills');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/bills"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Bill</h1>
          <p className="text-gray-600">Record a bill from a vendor</p>
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
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
                Bill Number
              </label>
              <input
                type="text"
                name="bill_number"
                value={formData.bill_number}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="Vendor's invoice #"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference
              </label>
              <input
                type="text"
                name="reference"
                value={formData.reference}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="PO #, etc."
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency <span className="text-red-500">*</span>
              </label>
              <CurrencySelect
                value={formData.currency}
                onChange={(e) => {
                  const newCurrency = e.target.value;
                  const oldCurrency = previousCurrency;
                  
                  console.log('Currency change:', { oldCurrency, newCurrency, exchangeRates });
                  
                  // Convert existing line items to new currency
                  if (oldCurrency !== newCurrency) {
                    const oldRate = exchangeRates[oldCurrency] || 1;
                    const newRate = exchangeRates[newCurrency] || 1;
                    const conversionFactor = newRate / oldRate;
                    
                    console.log('Conversion:', { oldRate, newRate, conversionFactor });
                    
                    setLineItems((prev) =>
                      prev.map((item) => {
                        const convertedUnitPrice = item.unit_price * conversionFactor;
                        const newItem = {
                          ...item,
                          unit_price: Math.round(convertedUnitPrice * 100) / 100,
                          amount: Math.round(item.quantity * convertedUnitPrice * 100) / 100,
                        };
                        console.log('Line item converted:', { old: item, new: newItem });
                        return newItem;
                      })
                    );
                    
                    setPreviousCurrency(newCurrency);
                  }
                  
                  setFormData({ ...formData, currency: newCurrency });
                }}
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
                  <th className="pb-2 pr-2">Product</th>
                  <th className="pb-2 px-2">Description</th>
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
                      <select
                        value={item.product_id}
                        onChange={(e) => handleProductChange(item.id, e.target.value)}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                      >
                        <option value="">Custom item</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                        placeholder="Description *"
                        required
                      />
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={item.account_code}
                        onChange={(e) => handleLineItemChange(item.id, 'account_code', e.target.value)}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
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
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => handleLineItemChange(item.id, 'unit_price', Number(e.target.value))}
                        min="0"
                        step="0.01"
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                      />
                    </td>
                    <td className="py-2 px-2 text-right text-sm font-medium tabular-nums">
                      {currencyFormatter(item.amount, formData.currency as any)}
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
                  <span className="font-medium tabular-nums">{currencyFormatter(subtotal, formData.currency as any)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className="tabular-nums">{currencyFormatter(total, formData.currency as any)}</span>
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            placeholder="Internal notes..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/dashboard/bills"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !formData.vendor_id || total === 0}
            className="px-6 py-2 bg-[#52b53b] text-white rounded-lg text-sm font-medium hover:bg-[#449932] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Bill'}
          </button>
        </div>
      </form>
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

interface Vendor {
  id: string;
  name: string;
  company_name: string | null;
  email: string;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  cost_price: number;
  unit_of_measure: string;
}

interface POLine {
  id: string;
  product_id: string | null;
  product_name: string;
  description: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  const [formData, setFormData] = useState({
    vendor_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    shipping_address: '',
    notes: '',
    currency: 'USD',
  });

  const [lines, setLines] = useState<POLine[]>([
    {
      id: Math.random().toString(),
      product_id: null,
      product_name: '',
      description: '',
      quantity: 1,
      unit_cost: 0,
      line_total: 0,
    },
  ]);

  useEffect(() => {
    loadVendors();
    loadProducts();
  }, []);

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, company_name, email')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Failed to load vendors:', error);
      toast.error('Failed to load vendors');
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error} = await supabase
        .from('products')
        .select('id, name, sku, cost_price, unit_of_measure')
        .eq('is_active', true)
        .order('name')
        .limit(100);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const handleLineChange = (index: number, field: keyof POLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };

    // Recalculate line total
    if (field === 'quantity' || field === 'unit_cost') {
      newLines[index].line_total = newLines[index].quantity * newLines[index].unit_cost;
    }

    // If product selected, populate details
    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        newLines[index].product_name = product.name;
        newLines[index].description = product.name;
        newLines[index].unit_cost = product.cost_price || 0;
        newLines[index].line_total = newLines[index].quantity * newLines[index].unit_cost;
      }
    }

    setLines(newLines);
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: Math.random().toString(),
        product_id: null,
        product_name: '',
        description: '',
        quantity: 1,
        unit_cost: 0,
        line_total: 0,
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = lines.reduce((sum, line) => sum + line.line_total, 0);
    const tax = 0; // Can add tax calculation logic
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vendor_id) {
      toast.error('Please select a vendor');
      return;
    }

    if (lines.length === 0 || lines.every(l => !l.description)) {
      toast.error('Please add at least one line item');
      return;
    }

    setLoading(true);
    try {
      const totals = calculateTotals();

      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          expected_date: formData.expected_date || null,
          subtotal: totals.subtotal,
          tax_amount: totals.tax,
          total: totals.total,
          lines: lines.map((line, index) => ({
            line_number: index + 1,
            product_id: line.product_id,
            description: line.description,
            quantity_ordered: line.quantity,
            unit_cost: line.unit_cost,
            line_total: line.line_total,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create purchase order');
      }

      toast.success('Purchase order created successfully');
      router.push(`/dashboard/purchase-orders/${result.id}`);
    } catch (error: any) {
      console.error('Error creating PO:', error);
      toast.error(error.message || 'Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();
  const formatCurrency = (amount: number) => currencyFormatter(amount, formData.currency as any);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/purchase-orders" className="btn-ghost p-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Purchase Order</h1>
          <p className="text-gray-500 mt-1">Create a new purchase order from a vendor</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PO Details */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Order Information</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">
                  Vendor <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select vendor...</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.company_name || vendor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="input"
                >
                  <option value="USD">USD</option>
                  <option value="UGX">UGX</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>

              <div>
                <label className="label">
                  Order Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Expected Delivery Date</label>
                <input
                  type="date"
                  value={formData.expected_date}
                  onChange={(e) => setFormData({ ...formData, expected_date: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="label">Shipping Address</label>
              <textarea
                value={formData.shipping_address}
                onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                className="input"
                rows={3}
                placeholder="Enter delivery address..."
              />
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input"
                rows={3}
                placeholder="Additional notes or instructions..."
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold">Line Items</h2>
            <button type="button" onClick={addLine} className="btn-secondary text-sm">
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Line
            </button>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-64">Product</th>
                    <th>Description</th>
                    <th className="w-32">Quantity</th>
                    <th className="w-32">Unit Cost</th>
                    <th className="w-32 text-right">Total</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.id}>
                      <td>
                        <select
                          value={line.product_id || ''}
                          onChange={(e) => handleLineChange(index, 'product_id', e.target.value || null)}
                          className="input text-sm"
                        >
                          <option value="">Select product...</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.sku ? `${product.sku} - ` : ''}{product.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                          className="input text-sm"
                          placeholder="Description..."
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="input text-sm"
                          min="0"
                          step="0.01"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={line.unit_cost}
                          onChange={(e) => handleLineChange(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                          className="input text-sm"
                          min="0"
                          step="0.01"
                          required
                        />
                      </td>
                      <td className="text-right font-medium">
                        {formatCurrency(line.line_total)}
                      </td>
                      <td>
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="btn-ghost text-red-600 p-1"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="card">
          <div className="card-body">
            <div className="flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">{formatCurrency(totals.tax)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/dashboard/purchase-orders" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating...' : 'Create Purchase Order'}
          </button>
        </div>
      </form>
    </div>
  );
}

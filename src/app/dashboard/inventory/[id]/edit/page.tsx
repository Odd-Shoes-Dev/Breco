'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase/client';
import { type SupportedCurrency } from '@/lib/currency';
import { CurrencySelect } from '@/components/ui/currency-select';

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface Product {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  product_type: string;
  unit_of_measure: string;
  cost_price: number;
  unit_price: number;
  currency: string;
  quantity_on_hand: number;
  reorder_point: number | null;
  reorder_quantity: number | null;
  is_taxable: boolean;
  is_active: boolean;
}

export default function EditInventoryItemPage() {
  const params = useParams();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category_id: '',
    unit_of_measure: 'each',
    unit_cost: 0,
    selling_price: 0,
    currency: 'USD',
    quantity_on_hand: 0,
    reorder_point: 10,
    reorder_quantity: 50,
    is_taxable: true,
    is_active: true,
  });

  useEffect(() => {
    fetchCategories();
    if (params.id) {
      loadItem();
    }
  }, [params.id]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name, description')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const loadItem = async () => {
    try {
      setLoading(true);

      const { data, error: itemError } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .single();

      if (itemError) throw itemError;

      setItem(data);
      setFormData({
        sku: data.sku || '',
        name: data.name,
        description: data.description || '',
        category_id: data.category_id || '',
        unit_of_measure: data.unit_of_measure,
        unit_cost: parseFloat(data.cost_price),
        selling_price: parseFloat(data.unit_price),
        currency: data.currency || 'USD',
        quantity_on_hand: data.quantity_on_hand,
        reorder_point: data.reorder_point || 10,
        reorder_quantity: data.reorder_quantity || 50,
        is_taxable: data.is_taxable,
        is_active: data.is_active,
      });
    } catch (error) {
      console.error('Failed to load item:', error);
      setError('Failed to load item');
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
      const payload = {
        sku: formData.sku,
        name: formData.name,
        description: formData.description || null,
        category_id: formData.category_id || null,
        unit_of_measure: formData.unit_of_measure,
        cost_price: formData.unit_cost,
        unit_price: formData.selling_price,
        currency: formData.currency,
        quantity_on_hand: formData.quantity_on_hand,
        reorder_point: formData.reorder_point,
        reorder_quantity: formData.reorder_quantity,
        is_taxable: formData.is_taxable,
        is_active: formData.is_active,
      };

      const { error: updateError } = await supabase
        .from('products')
        .update(payload)
        .eq('id', params.id);

      if (updateError) throw updateError;

      router.push(`/dashboard/inventory/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const unitsOfMeasure = [
    { value: 'each', label: 'Each (ea)' },
    { value: 'pair', label: 'Pair (pr)' },
    { value: 'dozen', label: 'Dozen (doz)' },
    { value: 'box', label: 'Box (bx)' },
    { value: 'case', label: 'Case (cs)' },
    { value: 'piece', label: 'Piece (pc)' },
    { value: 'unit', label: 'Unit (u)' },
    { value: 'pack', label: 'Pack (pk)' },
    { value: 'set', label: 'Set' },
    { value: 'kg', label: 'Kilogram (kg)' },
    { value: 'lb', label: 'Pound (lb)' },
    { value: 'liter', label: 'Liter (L)' },
    { value: 'gallon', label: 'Gallon (gal)' },
  ];

  const grossMargin = formData.selling_price > 0
    ? (((formData.selling_price - formData.unit_cost) / formData.selling_price) * 100).toFixed(1)
    : '0.0';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-600"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Item not found</p>
        <Link href="/dashboard/inventory" className="btn-secondary mt-4">
          Back to Inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/inventory/${params.id}`} className="btn-ghost p-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Inventory Item</h1>
          <p className="text-gray-500 mt-1">Update product information</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CubeIcon className="w-5 h-5 text-green-600" />
            Product Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="PROD-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">Select category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                <Link href="/dashboard/settings/categories" className="text-breco-navy hover:underline">
                  Manage categories
                </Link>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit of Measure
              </label>
              <select
                name="unit_of_measure"
                value={formData.unit_of_measure}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                {unitsOfMeasure.map((unit) => (
                  <option key={unit.value} value={unit.value}>{unit.label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="Enter product name"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="Product description..."
              />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_taxable"
                  checked={formData.is_taxable}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-[#52b53b] focus:ring-[#52b53b]"
                />
                <span className="text-sm text-gray-700">Taxable</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-[#52b53b] focus:ring-[#52b53b]"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Pricing</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit Cost <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="unit_cost"
                value={formData.unit_cost}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500 mt-1">Your purchase cost</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Selling Price <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="selling_price"
                value={formData.selling_price}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500 mt-1">Customer price</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency <span className="text-red-500">*</span>
              </label>
              <CurrencySelect
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
              />
              <p className="text-xs text-gray-500 mt-1">Pricing currency</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gross Margin
            </label>
            <div className="h-10 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-medium text-gray-900 max-w-xs">
              {grossMargin}%
            </div>
            <p className="text-xs text-gray-500 mt-1">Profit margin</p>
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Stock Levels</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Quantity
              </label>
              <input
                type="number"
                name="quantity_on_hand"
                value={formData.quantity_on_hand}
                onChange={handleChange}
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">Current stock count</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reorder Point
              </label>
              <input
                type="number"
                name="reorder_point"
                value={formData.reorder_point}
                onChange={handleChange}
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="10"
              />
              <p className="text-xs text-gray-500 mt-1">Alert when stock falls below</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reorder Quantity
              </label>
              <input
                type="number"
                name="reorder_quantity"
                value={formData.reorder_quantity}
                onChange={handleChange}
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="50"
              />
              <p className="text-xs text-gray-500 mt-1">Suggested order amount</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-6">
          <Link
            href={`/dashboard/inventory/${params.id}`}
            className="btn-secondary"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

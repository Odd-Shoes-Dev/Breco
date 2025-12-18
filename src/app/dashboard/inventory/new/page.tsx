'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter, type SupportedCurrency } from '@/lib/currency';
import { CurrencySelect } from '@/components/ui/currency-select';
import {
  ArrowLeftIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';

interface Category {
  id: string;
  name: string;
  description: string | null;
}

export default function NewInventoryItemPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    notes: '',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

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
        ...formData,
        unit_price: formData.selling_price, // Map selling_price to unit_price for API
      };
      
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create inventory item');
      }

      router.push('/dashboard/inventory');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const unitsOfMeasure = [
    { value: 'each', label: 'Each' },
    { value: 'pair', label: 'Pair' },
    { value: 'set', label: 'Set' },
    { value: 'box', label: 'Box' },
    { value: 'case', label: 'Case' },
    { value: 'pack', label: 'Pack' },
    { value: 'lb', label: 'Pound (lb)' },
    { value: 'oz', label: 'Ounce (oz)' },
    { value: 'kg', label: 'Kilogram (kg)' },
    { value: 'g', label: 'Gram (g)' },
    { value: 'gal', label: 'Gallon' },
    { value: 'l', label: 'Liter' },
    { value: 'ft', label: 'Foot' },
    { value: 'm', label: 'Meter' },
    { value: 'sqft', label: 'Square Foot' },
    { value: 'hour', label: 'Hour' },
  ];

  const grossMargin = formData.selling_price > 0 
    ? ((formData.selling_price - formData.unit_cost) / formData.selling_price * 100).toFixed(1)
    : '0.0';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/inventory"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Inventory Item</h1>
          <p className="text-gray-600">Add a new product to your inventory</p>
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
            <CubeIcon className="w-5 h-5 text-[#52b53b]" />
            <h2 className="font-semibold text-gray-900">Product Information</h2>
          </div>

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

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_taxable"
                  checked={formData.is_taxable}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-[#52b53b] focus:ring-[#52b53b]"
                />
                <span className="text-sm text-gray-700">Taxable (6.25% MA)</span>
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

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Additional Notes</h2>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            placeholder="Internal notes about this item..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/dashboard/inventory"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-[#52b53b] text-white rounded-lg text-sm font-medium hover:bg-[#449932] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Item'}
          </button>
        </div>
      </form>
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  TrashIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

interface Location {
  id: string;
  name: string;
  type: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  unit: string;
}

interface StockTakeLine {
  product_id: string;
  product_name: string;
  sku: string;
  expected_quantity: number;
  counted_quantity: number;
  unit: string;
  variance: number;
  notes: string;
}

export default function NewStockTakePage() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    reference_number: '',
    stock_take_date: new Date().toISOString().split('T')[0],
    location_id: '',
    type: 'full',
    notes: '',
  });

  const [lines, setLines] = useState<StockTakeLine[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    generateReference();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('inventory_locations')
        .select('id, name, type')
        .eq('is_active', true)
        .order('name');

      if (locationsError) throw locationsError;
      setLocations(locationsData || []);

      // Load products with current stock
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, current_stock, unit')
        .eq('is_active', true)
        .eq('type', 'inventory')
        .order('name');

      if (productsError) throw productsError;
      setProducts(productsData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const generateReference = async () => {
    try {
      const { count, error } = await supabase
        .from('stock_takes')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      const nextNumber = (count || 0) + 1;
      const ref = `ST-${String(nextNumber).padStart(5, '0')}`;
      setFormData((prev) => ({ ...prev, reference_number: ref }));
    } catch (error) {
      console.error('Failed to generate reference:', error);
    }
  };

  const loadLocationProducts = async (locationId: string) => {
    if (!locationId) return;

    try {
      // For full count, load all products with expected quantities
      const { data: productsData, error } = await supabase
        .from('products')
        .select('id, name, sku, current_stock, unit')
        .eq('is_active', true)
        .eq('type', 'inventory')
        .order('name');

      if (error) throw error;

      const newLines: StockTakeLine[] = (productsData || []).map((product) => ({
        product_id: product.id,
        product_name: product.name,
        sku: product.sku || '',
        expected_quantity: product.current_stock || 0,
        counted_quantity: 0,
        unit: product.unit || 'pcs',
        variance: 0 - (product.current_stock || 0),
        notes: '',
      }));

      setLines(newLines);
      toast.success(`Loaded ${newLines.length} products for counting`);
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('Failed to load products');
    }
  };

  const handleLocationChange = (locationId: string) => {
    setFormData({ ...formData, location_id: locationId });
    if (formData.type === 'full') {
      loadLocationProducts(locationId);
    }
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        product_id: '',
        product_name: '',
        sku: '',
        expected_quantity: 0,
        counted_quantity: 0,
        unit: 'pcs',
        variance: 0,
        notes: '',
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof StockTakeLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };

    // If product changed, update product details
    if (field === 'product_id') {
      const product = products.find((p) => p.id === value);
      if (product) {
        newLines[index].product_name = product.name;
        newLines[index].sku = product.sku || '';
        newLines[index].expected_quantity = product.current_stock || 0;
        newLines[index].unit = product.unit || 'pcs';
      }
    }

    // Calculate variance
    if (field === 'counted_quantity' || field === 'expected_quantity') {
      newLines[index].variance =
        newLines[index].counted_quantity - newLines[index].expected_quantity;
    }

    setLines(newLines);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.location_id) {
      toast.error('Please select a location');
      return;
    }

    if (lines.length === 0) {
      toast.error('Please add at least one product to count');
      return;
    }

    // Validate all lines have products selected
    const invalidLines = lines.filter((line) => !line.product_id);
    if (invalidLines.length > 0) {
      toast.error('Please select a product for all lines');
      return;
    }

    try {
      setSaving(true);

      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create stock take
      const { data: stockTake, error: stockTakeError } = await supabase
        .from('stock_takes')
        .insert({
          reference_number: formData.reference_number,
          stock_take_date: formData.stock_take_date,
          location_id: formData.location_id,
          type: formData.type,
          status: 'draft',
          counted_by: user.id,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (stockTakeError) throw stockTakeError;

      // Create lines
      const linesData = lines.map((line) => ({
        stock_take_id: stockTake.id,
        product_id: line.product_id,
        expected_quantity: line.expected_quantity,
        counted_quantity: line.counted_quantity,
        variance: line.variance,
        notes: line.notes || null,
      }));

      const { error: linesError } = await supabase
        .from('stock_take_lines')
        .insert(linesData);

      if (linesError) throw linesError;

      toast.success('Stock take created successfully');
      router.push(`/dashboard/inventory/stock-takes/${stockTake.id}`);
    } catch (error: any) {
      console.error('Error creating stock take:', error);
      toast.error(error.message || 'Failed to create stock take');
    } finally {
      setSaving(false);
    }
  };

  const totalVariance = lines.reduce((sum, line) => sum + Math.abs(line.variance), 0);
  const totalLines = lines.length;
  const countedLines = lines.filter((line) => line.counted_quantity > 0).length;

  return (
    <div className="max-w-7xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-ghost p-2"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">New Stock Take</h1>
              <p className="text-gray-500 mt-1">Create a new inventory stock count</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary"
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Stock Take'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="card">
            <div className="card-body">
              <div className="text-sm text-gray-600">Total Products</div>
              <div className="text-2xl font-bold text-gray-900">{totalLines}</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div className="text-sm text-gray-600">Counted</div>
              <div className="text-2xl font-bold text-blue-600">
                {countedLines} / {totalLines}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div className="text-sm text-gray-600">Total Variance</div>
              <div className={`text-2xl font-bold ${totalVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {totalVariance.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Stock Take Details */}
        <div className="card">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-4">Stock Take Details</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">
                  Reference Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.reference_number}
                  onChange={(e) =>
                    setFormData({ ...formData, reference_number: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">
                  Stock Take Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.stock_take_date}
                  onChange={(e) =>
                    setFormData({ ...formData, stock_take_date: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">
                  Location <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.location_id}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select Location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name} - {location.type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="input"
                  required
                >
                  <option value="full">Full Count</option>
                  <option value="cycle">Cycle Count</option>
                  <option value="spot">Spot Check</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="label">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input"
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stock Count Lines */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Products to Count</h2>
              <button
                type="button"
                onClick={addLine}
                className="btn-primary flex items-center gap-2"
              >
                <PlusIcon className="w-5 h-5" />
                Add Product
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500">
                  {formData.type === 'full' && formData.location_id
                    ? 'Products will be loaded automatically for full count'
                    : 'No products added yet'}
                </p>
                <button
                  type="button"
                  onClick={addLine}
                  className="btn-primary mt-4"
                >
                  Add First Product
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Expected</th>
                      <th>Counted</th>
                      <th>Variance</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={index}>
                        <td>
                          <select
                            value={line.product_id}
                            onChange={(e) => updateLine(index, 'product_id', e.target.value)}
                            className="input"
                            required
                          >
                            <option value="">Select Product</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <span className="text-sm text-gray-600">{line.sku}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{line.expected_quantity}</span>
                            <span className="text-sm text-gray-500">{line.unit}</span>
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            value={line.counted_quantity}
                            onChange={(e) =>
                              updateLine(index, 'counted_quantity', parseFloat(e.target.value) || 0)
                            }
                            className="input w-24"
                            step="0.01"
                            required
                          />
                        </td>
                        <td>
                          <span
                            className={`font-medium ${
                              line.variance > 0
                                ? 'text-green-600'
                                : line.variance < 0
                                ? 'text-red-600'
                                : 'text-gray-600'
                            }`}
                          >
                            {line.variance > 0 ? '+' : ''}
                            {line.variance.toFixed(2)}
                          </span>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={line.notes}
                            onChange={(e) => updateLine(index, 'notes', e.target.value)}
                            className="input w-40"
                            placeholder="Optional notes"
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="btn-ghost text-red-600 p-2"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

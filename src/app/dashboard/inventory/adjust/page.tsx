'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface Product {
  id: string;
  name: string;
  sku: string;
  quantity_in_stock: number;
}

interface AdjustmentLine {
  id: string;
  product_id: string;
  product_name: string;
  current_quantity: number;
  adjustment_quantity: number;
  new_quantity: number;
  reason: string;
}

export default function InventoryAdjustmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<AdjustmentLine[]>([]);
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, quantity_in_stock')
        .eq('track_inventory', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('Failed to load products');
    }
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: Math.random().toString(),
        product_id: '',
        product_name: '',
        current_quantity: 0,
        adjustment_quantity: 0,
        new_quantity: 0,
        reason: 'count_correction',
      },
    ]);
  };

  const updateLine = (index: number, field: keyof AdjustmentLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };

    if (field === 'product_id') {
      const product = products.find((p) => p.id === value);
      if (product) {
        newLines[index].product_name = product.name;
        newLines[index].current_quantity = product.quantity_in_stock;
        newLines[index].new_quantity = product.quantity_in_stock + newLines[index].adjustment_quantity;
      }
    }

    if (field === 'adjustment_quantity') {
      newLines[index].new_quantity = newLines[index].current_quantity + parseFloat(value || '0');
    }

    setLines(newLines);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lines.length === 0) {
      toast.error('Please add at least one adjustment');
      return;
    }

    if (lines.some((line) => !line.product_id)) {
      toast.error('Please select a product for all lines');
      return;
    }

    setLoading(true);
    try {
      // Create adjustments and update inventory
      for (const line of lines) {
        if (line.adjustment_quantity === 0) continue;

        // Update product quantity
        const { error: updateError } = await supabase
          .from('products')
          .update({
            quantity_in_stock: line.new_quantity,
          })
          .eq('id', line.product_id);

        if (updateError) throw updateError;

        // Record inventory movement
        const { error: movementError } = await supabase
          .from('inventory_movements')
          .insert({
            product_id: line.product_id,
            movement_type: 'adjustment',
            quantity: line.adjustment_quantity,
            unit_cost: 0,
            movement_date: adjustmentDate,
            reference_type: 'adjustment',
            reference_id: Math.random().toString(),
            notes: `${line.reason}: ${notes}`,
          });

        if (movementError) throw movementError;
      }

      toast.success('Inventory adjusted successfully');
      router.push('/dashboard/inventory/products');
    } catch (error: any) {
      console.error('Error adjusting inventory:', error);
      toast.error(error.message || 'Failed to adjust inventory');
    } finally {
      setLoading(false);
    }
  };

  const reasonOptions = [
    { value: 'count_correction', label: 'Count Correction' },
    { value: 'damage', label: 'Damage' },
    { value: 'theft', label: 'Theft' },
    { value: 'spoilage', label: 'Spoilage' },
    { value: 'found', label: 'Found Items' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/inventory/products" className="btn-ghost p-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Adjustment</h1>
          <p className="text-gray-500 mt-1">Adjust stock quantities for corrections or losses</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Adjustment Info */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Adjustment Information</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">
                  Adjustment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={adjustmentDate}
                  onChange={(e) => setAdjustmentDate(e.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input"
                rows={2}
                placeholder="Reason for adjustment..."
              />
            </div>
          </div>
        </div>

        {/* Adjustment Lines */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold">Adjustments</h2>
            <button type="button" onClick={addLine} className="btn-primary flex items-center gap-2">
              <PlusIcon className="w-4 h-4" />
              Add Product
            </button>
          </div>
          <div className="card-body">
            {lines.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No adjustments added. Click "Add Product" to start.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-64">Product</th>
                      <th className="w-32">Current Qty</th>
                      <th className="w-32">Adjustment</th>
                      <th className="w-32">New Qty</th>
                      <th className="w-48">Reason</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={line.id}>
                        <td>
                          <select
                            value={line.product_id}
                            onChange={(e) => updateLine(index, 'product_id', e.target.value)}
                            className="input text-sm"
                            required
                          >
                            <option value="">Select product...</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name} ({product.sku})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="text-center font-medium">{line.current_quantity}</td>
                        <td>
                          <input
                            type="number"
                            value={line.adjustment_quantity}
                            onChange={(e) =>
                              updateLine(index, 'adjustment_quantity', parseFloat(e.target.value) || 0)
                            }
                            className="input text-sm text-center"
                            step="0.01"
                            placeholder="0"
                            required
                          />
                        </td>
                        <td className="text-center font-medium">{line.new_quantity}</td>
                        <td>
                          <select
                            value={line.reason}
                            onChange={(e) => updateLine(index, 'reason', e.target.value)}
                            className="input text-sm"
                            required
                          >
                            {reasonOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="btn-ghost text-red-600 p-1"
                          >
                            <TrashIcon className="w-4 h-4" />
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

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/dashboard/inventory/products" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={loading || lines.length === 0} className="btn-primary">
            {loading ? 'Processing...' : 'Process Adjustment'}
          </button>
        </div>
      </form>
    </div>
  );
}

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

interface Location {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  quantity_in_stock: number;
}

interface TransferLine {
  id: string;
  product_id: string;
  product_name: string;
  available_quantity: number;
  transfer_quantity: number;
}

export default function NewInventoryTransferPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<TransferLine[]>([]);

  const [formData, setFormData] = useState({
    from_location_id: '',
    to_location_id: '',
    transfer_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    loadLocations();
    loadProducts();
  }, []);

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Failed to load locations:', error);
      toast.error('Failed to load locations');
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, quantity_in_stock')
        .eq('track_inventory', true)
        .gt('quantity_in_stock', 0)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: Math.random().toString(),
        product_id: '',
        product_name: '',
        available_quantity: 0,
        transfer_quantity: 0,
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof TransferLine, value: any) => {
    const newLines = [...lines];
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        newLines[index] = {
          ...newLines[index],
          product_id: value,
          product_name: product.name,
          available_quantity: product.quantity_in_stock,
          transfer_quantity: 0,
        };
      }
    } else {
      newLines[index] = { ...newLines[index], [field]: value };
    }
    
    setLines(newLines);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.from_location_id || !formData.to_location_id) {
      toast.error('Please select both locations');
      return;
    }

    if (formData.from_location_id === formData.to_location_id) {
      toast.error('From and To locations must be different');
      return;
    }

    if (lines.length === 0) {
      toast.error('Please add at least one product');
      return;
    }

    if (lines.some(line => !line.product_id || line.transfer_quantity <= 0)) {
      toast.error('Please complete all line items');
      return;
    }

    if (lines.some(line => line.transfer_quantity > line.available_quantity)) {
      toast.error('Transfer quantity cannot exceed available quantity');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/inventory-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_location_id: formData.from_location_id,
          to_location_id: formData.to_location_id,
          transfer_date: formData.transfer_date,
          notes: formData.notes,
          lines: lines.map(line => ({
            product_id: line.product_id,
            quantity: line.transfer_quantity,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create transfer');
      }

      toast.success('Transfer created successfully');
      router.push(`/dashboard/inventory/transfers/${result.id}`);
    } catch (error: any) {
      console.error('Error creating transfer:', error);
      toast.error(error.message || 'Failed to create transfer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/inventory/transfers" className="btn-ghost p-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Inventory Transfer</h1>
          <p className="text-gray-500 mt-1">Transfer inventory between locations</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Transfer Details</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="label">
                  From Location <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.from_location_id}
                  onChange={(e) => setFormData({ ...formData, from_location_id: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select location...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  To Location <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.to_location_id}
                  onChange={(e) => setFormData({ ...formData, to_location_id: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select location...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id} disabled={loc.id === formData.from_location_id}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  Transfer Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.transfer_date}
                  onChange={(e) => setFormData({ ...formData, transfer_date: e.target.value })}
                  className="input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input"
                rows={2}
                placeholder="Optional transfer notes..."
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold">Products to Transfer</h2>
            <button
              type="button"
              onClick={addLine}
              className="btn-secondary flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Add Product
            </button>
          </div>
          <div className="card-body">
            {lines.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No products added. Click "Add Product" to start.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="w-32">Available</th>
                      <th className="w-32">Quantity</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={line.id}>
                        <td>
                          <select
                            value={line.product_id}
                            onChange={(e) => handleLineChange(index, 'product_id', e.target.value)}
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
                        <td>
                          <span className="text-sm text-gray-600">{line.available_quantity}</span>
                        </td>
                        <td>
                          <input
                            type="number"
                            value={line.transfer_quantity}
                            onChange={(e) => handleLineChange(index, 'transfer_quantity', parseFloat(e.target.value) || 0)}
                            className="input text-sm"
                            min="0"
                            max={line.available_quantity}
                            step="0.01"
                            required
                          />
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

        <div className="flex justify-end gap-3">
          <Link href="/dashboard/inventory/transfers" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={loading || lines.length === 0} className="btn-primary">
            {loading ? 'Creating...' : 'Create Transfer'}
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  ChartBarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  category_id: string | null;
  unit_of_measure: string;
  unit_price: number;
  cost: number;
  quantity_in_stock: number;
  reorder_point: number | null;
  manufacturer: string | null;
  brand: string | null;
  model_number: string | null;
  weight: number | null;
  dimensions: string | null;
  is_active: boolean;
  track_inventory: boolean;
  product_categories?: {
    name: string;
  } | null;
}

interface InventoryMovement {
  id: string;
  movement_type: string;
  quantity: number;
  unit_cost: number;
  movement_date: string;
  reference_type: string;
  reference_id: string;
  notes: string | null;
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetailPageClient productId={id} />;
}

function ProductDetailPageClient({ productId }: { productId: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    loadProduct();
    loadMovements();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_categories (name)
        `)
        .eq('id', productId)
        .single();

      if (error) throw error;
      setProduct(data);
      setFormData(data);
    } catch (error) {
      console.error('Failed to load product:', error);
      toast.error('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('product_id', productId)
        .order('movement_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setMovements(data || []);
    } catch (error) {
      console.error('Failed to load movements:', error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('products')
        .update({
          ...formData,
          unit_price: parseFloat(formData.unit_price) || 0,
          cost: parseFloat(formData.cost) || 0,
          quantity_in_stock: parseFloat(formData.quantity_in_stock) || 0,
          reorder_point: formData.reorder_point ? parseFloat(formData.reorder_point) : null,
          weight: formData.weight ? parseFloat(formData.weight) : null,
        })
        .eq('id', productId);

      if (error) throw error;

      toast.success('Product updated successfully');
      setEditing(false);
      loadProduct();
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast.error(error.message || 'Failed to update product');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast.success('Product deleted successfully');
      router.push('/dashboard/inventory/products');
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error(error.message || 'Failed to delete product');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Product not found</p>
        <Link href="/dashboard/inventory/products" className="btn-primary mt-4">
          Back to Products
        </Link>
      </div>
    );
  }

  const stockValue = product.quantity_in_stock * product.unit_price;
  const isLowStock = product.reorder_point && product.quantity_in_stock <= product.reorder_point;

  const movementTypeLabels: Record<string, string> = {
    purchase: 'Purchase',
    sale: 'Sale',
    adjustment: 'Adjustment',
    transfer_in: 'Transfer In',
    transfer_out: 'Transfer Out',
    return: 'Return',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/inventory/products" className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-gray-500 mt-1">SKU: {product.sku}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!editing && (
            <>
              <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-2">
                <PencilIcon className="w-4 h-4" />
                Edit
              </button>
              <button onClick={handleDelete} className="btn-secondary text-red-600 border-red-600 hover:bg-red-50 flex items-center gap-2">
                <TrashIcon className="w-4 h-4" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">Edit Product</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Product Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="label">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="label">Unit Price</label>
                  <input
                    type="number"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                    className="input"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="label">Cost</label>
                  <input
                    type="number"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="input"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="label">Reorder Point</label>
                  <input
                    type="number"
                    value={formData.reorder_point || ''}
                    onChange={(e) => setFormData({ ...formData, reorder_point: e.target.value })}
                    className="input"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Stats */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="card">
              <div className="card-body">
                <div className="text-sm text-gray-500">In Stock</div>
                <div className={`text-2xl font-bold mt-1 ${isLowStock ? 'text-yellow-600' : 'text-gray-900'}`}>
                  {product.quantity_in_stock} {product.unit_of_measure}
                </div>
                {isLowStock && (
                  <div className="text-xs text-yellow-600 mt-1">Low Stock</div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="text-sm text-gray-500">Stock Value</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(stockValue)}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="text-sm text-gray-500">Unit Price</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(product.unit_price)}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="text-sm text-gray-500">Cost</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(product.cost)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Margin: {((product.unit_price - product.cost) / product.unit_price * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">Product Information</h2>
              </div>
              <div className="card-body space-y-3">
                <div>
                  <div className="text-sm text-gray-500">Category</div>
                  <div className="mt-1">{product.product_categories?.name || 'Uncategorized'}</div>
                </div>

                {product.barcode && (
                  <div>
                    <div className="text-sm text-gray-500">Barcode</div>
                    <div className="mt-1 font-mono">{product.barcode}</div>
                  </div>
                )}

                {product.description && (
                  <div>
                    <div className="text-sm text-gray-500">Description</div>
                    <div className="mt-1 text-gray-700">{product.description}</div>
                  </div>
                )}

                <div>
                  <div className="text-sm text-gray-500">Unit of Measure</div>
                  <div className="mt-1">{product.unit_of_measure}</div>
                </div>

                {product.reorder_point && (
                  <div>
                    <div className="text-sm text-gray-500">Reorder Point</div>
                    <div className="mt-1">{product.reorder_point}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">Product Details</h2>
              </div>
              <div className="card-body space-y-3">
                {product.manufacturer && (
                  <div>
                    <div className="text-sm text-gray-500">Manufacturer</div>
                    <div className="mt-1">{product.manufacturer}</div>
                  </div>
                )}

                {product.brand && (
                  <div>
                    <div className="text-sm text-gray-500">Brand</div>
                    <div className="mt-1">{product.brand}</div>
                  </div>
                )}

                {product.model_number && (
                  <div>
                    <div className="text-sm text-gray-500">Model Number</div>
                    <div className="mt-1">{product.model_number}</div>
                  </div>
                )}

                {product.weight && (
                  <div>
                    <div className="text-sm text-gray-500">Weight</div>
                    <div className="mt-1">{product.weight} kg</div>
                  </div>
                )}

                {product.dimensions && (
                  <div>
                    <div className="text-sm text-gray-500">Dimensions</div>
                    <div className="mt-1">{product.dimensions}</div>
                  </div>
                )}

                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Inventory Movements */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-semibold">Recent Movements</h2>
              </div>
              <span className="text-sm text-gray-500">{movements.length} transactions</span>
            </div>
            <div className="card-body p-0">
              {movements.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No inventory movements yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th className="text-right">Quantity</th>
                        <th className="text-right">Unit Cost</th>
                        <th>Reference</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((movement) => (
                        <tr key={movement.id}>
                          <td>{new Date(movement.movement_date).toLocaleDateString()}</td>
                          <td>
                            <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {movementTypeLabels[movement.movement_type] || movement.movement_type}
                            </span>
                          </td>
                          <td className={`text-right font-medium ${movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                          </td>
                          <td className="text-right">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                            }).format(movement.unit_cost)}
                          </td>
                          <td className="text-sm text-gray-600">
                            {movement.reference_type}: {movement.reference_id.substring(0, 8)}
                          </td>
                          <td className="text-sm text-gray-600">{movement.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

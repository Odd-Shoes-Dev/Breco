'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  ExclamationTriangleIcon,
  ShoppingCartIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface LowStockProduct {
  id: string;
  name: string;
  sku: string;
  quantity_in_stock: number;
  reorder_point: number;
  unit_price: number;
  cost: number;
  preferred_vendor_id: string | null;
  vendors?: {
    name: string;
    company_name: string | null;
  } | null;
  product_categories?: {
    name: string;
  } | null;
}

export default function ReorderAlertsPage() {
  const [products, setProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadLowStockProducts();
  }, []);

  const loadLowStockProducts = async () => {
    try {
      setLoading(true);
      
      // Get all products with reorder points
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          vendors (name, company_name),
          product_categories (name)
        `)
        .not('reorder_point', 'is', null)
        .eq('track_inventory', true)
        .order('name');

      if (error) throw error;

      // Filter products below reorder point
      const lowStock = (data || []).filter(
        (p: any) => p.quantity_in_stock <= p.reorder_point
      );

      setProducts(lowStock);
    } catch (error) {
      console.error('Failed to load low stock products:', error);
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const toggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const toggleAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map((p) => p.id)));
    }
  };

  const createPurchaseOrder = () => {
    if (selectedProducts.size === 0) {
      toast.error('Please select at least one product');
      return;
    }

    // Get selected product IDs
    const productIds = Array.from(selectedProducts).join(',');
    
    // Navigate to new PO page with pre-selected products
    window.location.href = `/dashboard/purchase-orders/new?products=${productIds}`;
  };

  const getStockStatus = (product: LowStockProduct) => {
    const percentage = (product.quantity_in_stock / product.reorder_point) * 100;
    if (product.quantity_in_stock === 0) {
      return { color: 'text-red-600', bg: 'bg-red-100', label: 'Out of Stock' };
    } else if (percentage <= 50) {
      return { color: 'text-red-600', bg: 'bg-red-100', label: 'Critical' };
    } else {
      return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Low Stock' };
    }
  };

  const outOfStockCount = products.filter((p) => p.quantity_in_stock === 0).length;
  const criticalCount = products.filter(
    (p) => p.quantity_in_stock > 0 && p.quantity_in_stock <= p.reorder_point * 0.5
  ).length;
  const lowStockCount = products.length - outOfStockCount - criticalCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reorder Alerts</h1>
          <p className="text-gray-500 mt-1">Products below reorder point</p>
        </div>
        <Link href="/dashboard/inventory/products" className="btn-secondary">
          View All Products
        </Link>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Total Alerts</div>
            <div className="text-2xl font-bold text-gray-900 mt-1 flex items-center gap-2">
              {products.length}
              {products.length > 0 && <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500" />}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Out of Stock</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {outOfStockCount}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Critical</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {criticalCount}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Low Stock</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">
              {lowStockCount}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      {selectedProducts.size > 0 && (
        <div className="card border-blue-200 bg-blue-50">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircleIcon className="w-6 h-6 text-blue-600" />
                <span className="font-medium text-blue-900">
                  {selectedProducts.size} product{selectedProducts.size > 1 ? 's' : ''} selected
                </span>
              </div>
              <button onClick={createPurchaseOrder} className="btn-primary flex items-center gap-2">
                <ShoppingCartIcon className="w-4 h-4" />
                Create Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-900 font-medium">All products are adequately stocked!</p>
              <p className="text-gray-500 mt-1">No reorder alerts at this time.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedProducts.size === products.length}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Vendor</th>
                    <th className="text-right">In Stock</th>
                    <th className="text-right">Reorder Point</th>
                    <th className="text-right">Suggested Order Qty</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const status = getStockStatus(product);
                    const suggestedQty = Math.max(
                      product.reorder_point * 2 - product.quantity_in_stock,
                      product.reorder_point
                    );

                    return (
                      <tr key={product.id} className={status.bg}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.id)}
                            onChange={() => toggleProduct(product.id)}
                            className="rounded"
                          />
                        </td>
                        <td>
                          <Link
                            href={`/dashboard/inventory/products/${product.id}`}
                            className="font-medium text-blue-600 hover:text-blue-800"
                          >
                            {product.name}
                          </Link>
                          <div className="text-sm text-gray-500">{product.sku}</div>
                        </td>
                        <td>{product.product_categories?.name || '-'}</td>
                        <td className="text-sm">
                          {product.vendors?.company_name || product.vendors?.name || 'No vendor'}
                        </td>
                        <td className={`text-right font-semibold ${status.color}`}>
                          {product.quantity_in_stock}
                        </td>
                        <td className="text-right text-gray-600">
                          {product.reorder_point}
                        </td>
                        <td className="text-right font-medium text-blue-600">
                          {suggestedQty}
                        </td>
                        <td>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/dashboard/purchase-orders/new?product=${product.id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                          >
                            <ShoppingCartIcon className="w-4 h-4" />
                            Order
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

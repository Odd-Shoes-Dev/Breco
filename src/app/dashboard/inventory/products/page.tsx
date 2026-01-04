'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  quantity_in_stock: number;
  reorder_point: number | null;
  unit_price: number;
  product_categories?: {
    name: string;
  };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [showLowStock, setShowLowStock] = useState(false);

  useEffect(() => {
    loadCategories();
    loadProducts();
  }, [search, categoryFilter, showLowStock]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('products')
        .select(`
          *,
          product_categories (name)
        `)
        .order('name');

      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
      }

      if (categoryFilter) {
        query = query.eq('category_id', categoryFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredData = data || [];

      if (showLowStock) {
        filteredData = filteredData.filter(
          p => p.reorder_point && p.quantity_in_stock <= p.reorder_point
        );
      }

      setProducts(filteredData);
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const lowStockCount = products.filter(
    p => p.reorder_point && p.quantity_in_stock <= p.reorder_point
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 mt-1">Manage your product catalog</p>
        </div>
        <Link href="/dashboard/inventory/products/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          New Product
        </Link>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Total Products</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {products.length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Total Stock Value</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(
                products.reduce((sum, p) => sum + p.quantity_in_stock * p.unit_price, 0)
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Low Stock Items</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1 flex items-center gap-2">
              {lowStockCount}
              {lowStockCount > 0 && <ExclamationTriangleIcon className="w-5 h-5" />}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Categories</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {categories.length}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>

            <div className="w-full md:w-64">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowLowStock(!showLowStock)}
              className={`btn-secondary flex items-center gap-2 ${
                showLowStock ? 'bg-yellow-50 text-yellow-700 border-yellow-300' : ''
              }`}
            >
              <FunnelIcon className="w-4 h-4" />
              {showLowStock ? 'Show All' : 'Low Stock Only'}
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No products found</p>
              <Link href="/dashboard/inventory/products/new" className="btn-primary mt-4">
                Add Your First Product
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th className="text-right">In Stock</th>
                    <th className="text-right">Reorder Point</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Stock Value</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const isLowStock = product.reorder_point && product.quantity_in_stock <= product.reorder_point;
                    const stockValue = product.quantity_in_stock * product.unit_price;

                    return (
                      <tr key={product.id} className={isLowStock ? 'bg-yellow-50' : ''}>
                        <td>
                          <div className="font-mono text-sm">{product.sku}</div>
                          {product.barcode && (
                            <div className="text-xs text-gray-500">{product.barcode}</div>
                          )}
                        </td>
                        <td>
                          <Link
                            href={`/dashboard/inventory/products/${product.id}`}
                            className="font-medium text-blue-600 hover:text-blue-800"
                          >
                            {product.name}
                          </Link>
                        </td>
                        <td>{product.product_categories?.name || '-'}</td>
                        <td className="text-right">
                          <span
                            className={
                              isLowStock
                                ? 'text-yellow-700 font-semibold'
                                : 'text-gray-900'
                            }
                          >
                            {product.quantity_in_stock}
                          </span>
                        </td>
                        <td className="text-right text-gray-500">
                          {product.reorder_point || '-'}
                        </td>
                        <td className="text-right">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          }).format(product.unit_price)}
                        </td>
                        <td className="text-right font-medium">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          }).format(stockValue)}
                        </td>
                        <td>
                          <Link
                            href={`/dashboard/inventory/products/${product.id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            View
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

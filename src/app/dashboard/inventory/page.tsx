'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import type { Product } from '@/types/database';

export default function InventoryPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalValue: 0,
    lowStock: 0,
    outOfStock: 0,
  });
  const pageSize = 20;

  useEffect(() => {
    loadInventory();
    loadStats();
  }, [searchQuery, stockFilter, currentPage]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('track_inventory', true)
        .order('name');

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%`);
      }

      if (stockFilter === 'low') {
        query = query.gt('quantity_on_hand', 0).lte('quantity_on_hand', 10); // Low stock threshold
      } else if (stockFilter === 'out') {
        query = query.eq('quantity_on_hand', 0);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setItems(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/inventory/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return currencyFormatter(amount, currency as any);
  };

  const getStockStatus = (item: Product) => {
    if ((item.quantity_on_hand || 0) === 0) {
      return { label: 'Out of Stock', class: 'badge-error', icon: ExclamationTriangleIcon };
    }
    if ((item.quantity_on_hand || 0) <= (item.reorder_point || 0)) {
      return { label: 'Low Stock', class: 'badge-warning', icon: ArrowTrendingDownIcon };
    }
    return { label: 'In Stock', class: 'badge-success', icon: ArrowTrendingUpIcon };
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 mt-1">Track and manage stock levels</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/inventory/movements" className="btn-secondary">
            Stock Movements
          </Link>
          <Link href="/dashboard/inventory/new" className="btn-primary">
            <PlusIcon className="w-5 h-5 mr-2" />
            Add Item
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Total Items</p>
            <p className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900 mt-1">{stats.totalItems}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Total Value</p>
            <p className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.totalValue)}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Low Stock</p>
            <p className="text-base sm:text-lg lg:text-2xl font-bold text-amber-600 mt-1">{stats.lowStock}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Out of Stock</p>
            <p className="text-base sm:text-lg lg:text-2xl font-bold text-red-600 mt-1">{stats.outOfStock}</p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, SKU, or barcode..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="input pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-gray-400" />
              <select
                value={stockFilter}
                onChange={(e) => {
                  setStockFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="input w-auto"
              >
                <option value="all">All Items</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <CubeIcon className="w-12 h-12 text-gray-400 mx-auto" />
            <p className="text-gray-500 mt-2">No inventory items found.</p>
            <Link href="/dashboard/inventory/new" className="btn-primary mt-4 inline-flex">
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Your First Item
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th className="text-right">On Hand</th>
                  <th className="text-right">Reserved</th>
                  <th className="text-right">Available</th>
                  <th className="text-right">Unit Cost</th>
                  <th className="text-right">Total Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const status = getStockStatus(item);
                  const available = (item.quantity_on_hand || 0) - (item.quantity_reserved || 0);
                  return (
                    <tr key={item.id}>
                      <td>
                        <Link
                          href={`/dashboard/inventory/${item.id}`}
                          className="font-medium text-gray-900 hover:text-navy-600"
                        >
                          {item.name}
                        </Link>
                        {item.description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">{item.description}</p>
                        )}
                      </td>
                      <td>
                        <span className="font-mono text-sm">{item.sku || '-'}</span>
                      </td>
                      <td className="text-right font-medium">
                        {item.quantity_on_hand} {item.unit_of_measure}
                      </td>
                      <td className="text-right text-gray-500">
                        {item.quantity_reserved}
                      </td>
                      <td className="text-right font-medium">
                        {available} {item.unit_of_measure}
                      </td>
                      <td className="text-right">{formatCurrency(item.cost_price, item.currency)}</td>
                      <td className="text-right font-medium">
                        {formatCurrency((item.quantity_on_hand || 0) * (item.cost_price || 0), item.currency)}
                      </td>
                      <td>
                        <span className={`badge ${status.class}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden grid gap-4">
            {items.map((item) => {
              const status = getStockStatus(item);
              const available = (item.quantity_on_hand || 0) - (item.quantity_reserved || 0);
              return (
                <div key={item.id} className="card">
                  <div className="card-body">
                    <div className="flex justify-between items-start">
                      <div>
                        <Link
                          href={`/dashboard/inventory/${item.id}`}
                          className="font-semibold text-gray-900 hover:text-navy-600"
                        >
                          {item.name}
                        </Link>
                        <p className="text-sm text-gray-500 font-mono">{item.sku || '-'}</p>
                      </div>
                      <span className={`badge ${status.class}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">On Hand</p>
                        <p className="font-semibold">{item.quantity_on_hand}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">Reserved</p>
                        <p className="font-semibold">{item.quantity_reserved}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">Available</p>
                        <p className="font-semibold">{available}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                      <div>
                        <span className="text-gray-500">Value:</span>
                        <span className="ml-1.5 font-medium">
                          {formatCurrency((item.quantity_on_hand || 0) * (item.cost_price || 0))}
                        </span>
                      </div>
                      <Link
                        href={`/dashboard/inventory/${item.id}`}
                        className="text-navy-600 font-medium"
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} items
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn-secondary disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn-secondary disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


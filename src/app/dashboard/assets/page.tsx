'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  BuildingLibraryIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type { FixedAsset } from '@/types/database';

type AssetStatus = 'all' | 'active' | 'disposed' | 'fully_depreciated';

interface AssetWithCategory extends FixedAsset {
  asset_categories?: { name: string } | null;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    totalAssets: 0,
    totalCost: 0,
    totalBookValue: 0,
    totalDepreciation: 0,
  });
  const pageSize = 20;

  useEffect(() => {
    loadAssets();
    loadStats();
  }, [searchQuery, statusFilter, currentPage]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('fixed_assets')
        .select(`
          *,
          asset_categories (name)
        `, { count: 'exact' })
        .order('purchase_date', { ascending: false });

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,asset_number.ilike.%${searchQuery}%,serial_number.ilike.%${searchQuery}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setAssets(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/assets/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, 'USD');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'badge-success',
      disposed: 'badge-gray',
      fully_depreciated: 'badge-warning',
    };
    return styles[status] || 'badge-gray';
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fixed Assets</h1>
          <p className="text-gray-500 mt-1">Track and depreciate company assets</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/assets/depreciation" className="btn-secondary">
            <ArrowPathIcon className="w-5 h-5 mr-2" />
            Run Depreciation
          </Link>
          <Link href="/dashboard/assets/new" className="btn-primary">
            <PlusIcon className="w-5 h-5 mr-2" />
            Add Asset
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-3 sm:p-4 lg:p-6">
          <p className="text-sm text-gray-500">Active Assets</p>
          <p className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900 mt-0.5">{stats.totalAssets}</p>
        </div>
        <div className="card p-3 sm:p-4 lg:p-6">
          <p className="text-sm text-gray-500">Total Cost</p>
          <p className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(stats.totalCost)}</p>
        </div>
        <div className="card p-3 sm:p-4 lg:p-6">
          <p className="text-sm text-gray-500">Accumulated Depreciation</p>
          <p className="text-base sm:text-lg lg:text-2xl font-bold text-amber-600 mt-0.5">{formatCurrency(stats.totalDepreciation)}</p>
        </div>
        <div className="card p-3 sm:p-4 lg:p-6">
          <p className="text-sm text-gray-500">Net Book Value</p>
          <p className="text-base sm:text-lg lg:text-2xl font-bold text-green-600 mt-0.5">{formatCurrency(stats.totalBookValue)}</p>
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
                placeholder="Search by name, code, or serial..."
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
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as AssetStatus);
                  setCurrentPage(1);
                }}
                className="input w-auto"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="fully_depreciated">Fully Depreciated</option>
                <option value="disposed">Disposed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Assets List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600" />
        </div>
      ) : assets.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <BuildingLibraryIcon className="w-12 h-12 text-gray-400 mx-auto" />
            <p className="text-gray-500 mt-2">No fixed assets found.</p>
            <Link href="/dashboard/assets/new" className="btn-primary mt-4 inline-flex">
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Your First Asset
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Category</th>
                  <th>Purchase Date</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Depreciation</th>
                  <th className="text-right">Book Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <Link
                        href={`/dashboard/assets/${asset.id}`}
                        className="font-medium text-gray-900 hover:text-navy-600"
                      >
                        {asset.name}
                      </Link>
                      <div className="flex gap-2 text-sm text-gray-500">
                        <span className="font-mono">{asset.asset_number}</span>
                        {asset.serial_number && (
                          <span>• S/N: {asset.serial_number}</span>
                        )}
                      </div>
                    </td>
                    <td>{asset.asset_categories?.name || '-'}</td>
                    <td className="whitespace-nowrap">{formatDate(asset.purchase_date)}</td>
                    <td className="text-right">{formatCurrency(asset.purchase_price)}</td>
                    <td className="text-right text-amber-600">
                      ({formatCurrency(asset.accumulated_depreciation)})
                    </td>
                    <td className="text-right font-medium">
                      {formatCurrency(asset.book_value)}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(asset.status)}`}>
                        {asset.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden grid gap-4">
            {assets.map((asset) => (
              <div key={asset.id} className="card">
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link
                        href={`/dashboard/assets/${asset.id}`}
                        className="font-semibold text-gray-900 hover:text-navy-600"
                      >
                        {asset.name}
                      </Link>
                      <p className="text-sm text-gray-500 font-mono">{asset.asset_number}</p>
                    </div>
                    <span className={`badge ${getStatusBadge(asset.status)}`}>
                      {asset.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-3 text-sm">
                    <p className="text-gray-500">
                      {asset.asset_categories?.name} • {formatDate(asset.purchase_date)}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-500">Cost</p>
                      <p className="font-semibold text-sm">{formatCurrency(asset.purchase_price)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-500">Depreciation</p>
                      <p className="font-semibold text-sm text-amber-600">
                        {formatCurrency(asset.accumulated_depreciation)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-500">Book Value</p>
                      <p className="font-semibold text-sm text-green-600">
                        {formatCurrency(asset.book_value)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} assets
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


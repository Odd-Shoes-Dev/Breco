'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

interface StockTake {
  id: string;
  stock_take_number: string;
  type: string;
  status: string;
  scheduled_date: string;
  started_at: string | null;
  completed_at: string | null;
  locations: {
    name: string;
    code: string;
  } | null;
}

export default function StockTakesPage() {
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadStockTakes();
  }, [search, statusFilter]);

  const loadStockTakes = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('stock_takes')
        .select(`
          *,
          locations (name, code)
        `)
        .order('scheduled_date', { ascending: false });

      if (search) {
        query = query.ilike('stock_take_number', `%${search}%`);
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStockTakes(data || []);
    } catch (error) {
      console.error('Failed to load stock takes:', error);
      toast.error('Failed to load stock takes');
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    scheduled: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };

  const typeColors: Record<string, string> = {
    full: 'bg-purple-100 text-purple-800',
    cycle: 'bg-blue-100 text-blue-800',
    spot: 'bg-green-100 text-green-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Takes</h1>
          <p className="text-gray-500 mt-1">Physical inventory counts and reconciliation</p>
        </div>
        <Link href="/dashboard/inventory/stock-takes/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          New Stock Take
        </Link>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Total Stock Takes</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {stockTakes.length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Scheduled</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">
              {stockTakes.filter(st => st.status === 'scheduled').length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">In Progress</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {stockTakes.filter(st => st.status === 'in_progress').length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Completed</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {stockTakes.filter(st => st.status === 'completed').length}
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
                  placeholder="Search stock takes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>

            <div className="w-full md:w-64">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input"
              >
                <option value="">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Takes List */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : stockTakes.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No stock takes</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by scheduling a stock take.</p>
              <div className="mt-6">
                <Link href="/dashboard/inventory/stock-takes/new" className="btn-primary">
                  <PlusIcon className="w-5 h-5 mr-2" />
                  New Stock Take
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Stock Take #</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Scheduled Date</th>
                    <th>Started</th>
                    <th>Completed</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {stockTakes.map((stockTake) => (
                    <tr key={stockTake.id}>
                      <td>
                        <Link
                          href={`/dashboard/inventory/stock-takes/${stockTake.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {stockTake.stock_take_number}
                        </Link>
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs ${typeColors[stockTake.type]}`}>
                          {stockTake.type.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div>
                          <div className="font-medium">{stockTake.locations?.name}</div>
                          <div className="text-sm text-gray-500">{stockTake.locations?.code}</div>
                        </div>
                      </td>
                      <td>{new Date(stockTake.scheduled_date).toLocaleDateString()}</td>
                      <td>
                        {stockTake.started_at
                          ? new Date(stockTake.started_at).toLocaleDateString()
                          : '-'}
                      </td>
                      <td>
                        {stockTake.completed_at
                          ? new Date(stockTake.completed_at).toLocaleDateString()
                          : '-'}
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs ${statusColors[stockTake.status]}`}>
                          {stockTake.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/dashboard/inventory/stock-takes/${stockTake.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {stockTake.status === 'scheduled' ? 'Start' : 'View'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

interface Transfer {
  id: string;
  transfer_number: string;
  transfer_date: string;
  status: string;
  notes: string | null;
  from_location: {
    name: string;
    code: string;
  } | null;
  to_location: {
    name: string;
    code: string;
  } | null;
}

export default function InventoryTransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadTransfers();
  }, [search, statusFilter]);

  const loadTransfers = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('inventory_transfers')
        .select(`
          *,
          from_location:locations!inventory_transfers_from_location_id_fkey (name, code),
          to_location:locations!inventory_transfers_to_location_id_fkey (name, code)
        `)
        .order('transfer_date', { ascending: false });

      if (search) {
        query = query.ilike('transfer_number', `%${search}%`);
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTransfers(data || []);
    } catch (error) {
      console.error('Failed to load transfers:', error);
      toast.error('Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_transit: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Transfers</h1>
          <p className="text-gray-500 mt-1">Transfer inventory between locations</p>
        </div>
        <Link href="/dashboard/inventory/transfers/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          New Transfer
        </Link>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Total Transfers</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {transfers.length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Pending</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">
              {transfers.filter(t => t.status === 'pending').length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">In Transit</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {transfers.filter(t => t.status === 'in_transit').length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Completed</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {transfers.filter(t => t.status === 'completed').length}
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
                  placeholder="Search transfers..."
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
                <option value="pending">Pending</option>
                <option value="in_transit">In Transit</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Transfers List */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No transfers found</p>
              <Link href="/dashboard/inventory/transfers/new" className="btn-primary mt-4">
                Create Your First Transfer
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Transfer #</th>
                    <th>Date</th>
                    <th>From</th>
                    <th></th>
                    <th>To</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((transfer) => (
                    <tr key={transfer.id}>
                      <td>
                        <Link
                          href={`/dashboard/inventory/transfers/${transfer.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {transfer.transfer_number}
                        </Link>
                      </td>
                      <td>{new Date(transfer.transfer_date).toLocaleDateString()}</td>
                      <td>
                        <div>
                          <div className="font-medium">{transfer.from_location?.name}</div>
                          <div className="text-sm text-gray-500">{transfer.from_location?.code}</div>
                        </div>
                      </td>
                      <td>
                        <ArrowRightIcon className="w-5 h-5 text-gray-400" />
                      </td>
                      <td>
                        <div>
                          <div className="font-medium">{transfer.to_location?.name}</div>
                          <div className="text-sm text-gray-500">{transfer.to_location?.code}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs ${statusColors[transfer.status]}`}>
                          {transfer.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/dashboard/inventory/transfers/${transfer.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View
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

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

interface PurchaseOrder {
  id: string;
  po_number: string;
  order_date: string;
  expected_date: string | null;
  total: number;
  currency: string;
  status: string;
  vendors?: {
    name: string;
    company_name: string | null;
  };
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    draft: 0,
    sent: 0,
    partial: 0,
    received: 0,
    totalValue: 0,
  });
  const pageSize = 20;

  useEffect(() => {
    loadOrders();
    loadStats();
  }, [searchQuery, statusFilter, currentPage]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (
            name,
            company_name
          )
        `, { count: 'exact' })
        .order('order_date', { ascending: false });

      if (searchQuery) {
        query = query.or(`po_number.ilike.%${searchQuery}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setOrders(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Failed to load purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('status, total, currency');

      if (error) throw error;

      const stats = {
        draft: data?.filter(o => o.status === 'draft').length || 0,
        sent: data?.filter(o => o.status === 'sent').length || 0,
        partial: data?.filter(o => o.status === 'partial').length || 0,
        received: data?.filter(o => o.status === 'received').length || 0,
        totalValue: data?.reduce((sum, o) => sum + Number(o.total || 0), 0) || 0,
      };
      setStats(stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return currencyFormatter(amount, currency as any);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; class: string; icon: any }> = {
      draft: { label: 'Draft', class: 'badge-gray', icon: DocumentTextIcon },
      sent: { label: 'Sent', class: 'badge-info', icon: ClockIcon },
      approved: { label: 'Approved', class: 'badge-success', icon: CheckCircleIcon },
      partial: { label: 'Partially Received', class: 'badge-warning', icon: TruckIcon },
      received: { label: 'Received', class: 'badge-success', icon: CheckCircleIcon },
      cancelled: { label: 'Cancelled', class: 'badge-error', icon: XCircleIcon },
    };
    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.class}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-500 mt-1">Manage purchase orders from vendors</p>
        </div>
        <Link href="/dashboard/purchase-orders/new" className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          New Purchase Order
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-4">
          <p className="text-2xl font-bold text-gray-900">{stats.draft}</p>
          <p className="text-sm text-gray-500">Draft</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
          <p className="text-sm text-gray-500">Sent</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-yellow-600">{stats.partial}</p>
          <p className="text-sm text-gray-500">Partial</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-green-600">{stats.received}</p>
          <p className="text-sm text-gray-500">Received</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-breco-navy">{formatCurrency(stats.totalValue)}</p>
          <p className="text-sm text-gray-500">Total Value</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by PO number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 input"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-full md:w-48"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="approved">Approved</option>
            <option value="partial">Partially Received</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Purchase Orders List */}
      <div className="card">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-breco-navy mx-auto"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No purchase orders found</h3>
            <p className="text-gray-500 mb-4">Create your first purchase order to get started</p>
            <Link href="/dashboard/purchase-orders/new" className="btn-primary inline-flex items-center">
              <PlusIcon className="w-5 h-5 mr-2" />
              New Purchase Order
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Vendor</th>
                    <th>Order Date</th>
                    <th>Expected Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link 
                          href={`/dashboard/purchase-orders/${order.id}`}
                          className="font-medium text-breco-navy hover:text-breco-ocean"
                        >
                          {order.po_number}
                        </Link>
                      </td>
                      <td>
                        <div className="text-sm">
                          {order.vendors?.company_name || order.vendors?.name || 'N/A'}
                        </div>
                      </td>
                      <td>{formatDate(order.order_date)}</td>
                      <td>{order.expected_date ? formatDate(order.expected_date) : '-'}</td>
                      <td>
                        <span className="font-medium">
                          {formatCurrency(order.total, order.currency)}
                        </span>
                      </td>
                      <td>{getStatusBadge(order.status)}</td>
                      <td className="text-right">
                        <Link
                          href={`/dashboard/purchase-orders/${order.id}`}
                          className="btn-ghost text-sm"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="card-footer flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} orders
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn-secondary"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-secondary"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

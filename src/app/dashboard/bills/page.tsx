'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentTextIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import type { Bill } from '@/types/database';

type BillStatus = 'all' | 'draft' | 'pending' | 'partial' | 'paid' | 'overdue';

interface BillWithVendor extends Bill {
  vendors?: { name: string } | null;
}

export default function BillsPage() {
  const [bills, setBills] = useState<BillWithVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    totalUnpaid: 0,
    dueThisWeek: 0,
    overdue: 0,
    paidThisMonth: 0,
  });
  const pageSize = 20;

  useEffect(() => {
    loadBills();
    loadStats();
  }, [searchQuery, statusFilter, currentPage]);

  const loadBills = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('bills')
        .select(`
          *,
          vendors (name)
        `, { count: 'exact' })
        .order('bill_date', { ascending: false });

      if (searchQuery) {
        query = query.or(`bill_number.ilike.%${searchQuery}%,reference.ilike.%${searchQuery}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setBills(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Failed to load bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/bills/stats');
      if (!response.ok) throw new Error('Failed to load stats');
      
      const data = await response.json();
      setStats(data);
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
    const styles: Record<string, string> = {
      draft: 'badge-gray',
      pending: 'badge-warning',
      partial: 'badge-info',
      paid: 'badge-success',
      overdue: 'badge-error',
      void: 'badge-gray',
    };
    return styles[status] || 'badge-gray';
  };

  const isOverdue = (bill: BillWithVendor) => {
    if (bill.status === 'paid' || bill.status === 'void') return false;
    return new Date(bill.due_date) < new Date();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
          <p className="text-gray-500 mt-1">Manage vendor bills and payments</p>
        </div>
        <Link href="/dashboard/bills/new" className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          New Bill
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Total Unpaid</p>
            <p className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(stats.totalUnpaid)}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Due This Week</p>
            <p className="text-base sm:text-lg lg:text-2xl font-bold text-amber-600 mt-1">
              {formatCurrency(stats.dueThisWeek)}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Overdue</p>
            <p className="text-base sm:text-lg lg:text-2xl font-bold text-red-600 mt-1">
              {formatCurrency(stats.overdue)}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Paid This Month</p>
            <p className="text-base sm:text-lg lg:text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(stats.paidThisMonth)}
            </p>
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
                placeholder="Search bills..."
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
                  setStatusFilter(e.target.value as BillStatus);
                  setCurrentPage(1);
                }}
                className="input w-auto"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bills List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600" />
        </div>
      ) : bills.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto" />
            <p className="text-gray-500 mt-2">No bills found.</p>
            <Link href="/dashboard/bills/new" className="btn-primary mt-4 inline-flex">
              <PlusIcon className="w-5 h-5 mr-2" />
              Create Your First Bill
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop/Mobile Table with horizontal scroll */}
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <div className="inline-block min-w-full align-middle">
              <table className="table">
                <thead>
                  <tr>
                    <th>Bill #</th>
                    <th>Vendor</th>
                    <th>Bill Date</th>
                    <th>Due Date</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Balance</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr key={bill.id}>
                      <td>
                        <Link
                          href={`/dashboard/bills/${bill.id}`}
                          className="font-mono font-medium text-navy-600 hover:underline"
                        >
                          {bill.bill_number}
                        </Link>
                      </td>
                      <td>{bill.vendors?.name || '-'}</td>
                      <td className="whitespace-nowrap">{formatDate(bill.bill_date)}</td>
                      <td className={`whitespace-nowrap ${isOverdue(bill) ? 'text-red-600 font-medium' : ''}`}>
                        {formatDate(bill.due_date)}
                      </td>
                      <td className="text-right font-medium">
                        {formatCurrency(bill.total, bill.currency || 'USD')}
                      </td>
                      <td className="text-right font-medium">
                        {formatCurrency(bill.total - bill.amount_paid, bill.currency || 'USD')}
                      </td>
                      <td>
                        <span className={`badge ${isOverdue(bill) ? 'badge-error' : getStatusBadge(bill.status)}`}>
                          {isOverdue(bill) ? 'Overdue' : bill.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/dashboard/bills/${bill.id}`}
                          className="btn-ghost p-2"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards - Hidden */}
          <div className="hidden">
            {bills.map((bill) => (
              <div key={bill.id} className="card">
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link
                        href={`/dashboard/bills/${bill.id}`}
                        className="font-mono font-semibold text-navy-600"
                      >
                        {bill.bill_number}
                      </Link>
                      <p className="text-sm text-gray-600">{bill.vendors?.name}</p>
                    </div>
                    <span className={`badge ${isOverdue(bill) ? 'badge-error' : getStatusBadge(bill.status)}`}>
                      {isOverdue(bill) ? 'Overdue' : bill.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Bill Date:</span>
                      <span className="ml-1.5">{formatDate(bill.bill_date)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Due:</span>
                      <span className={`ml-1.5 ${isOverdue(bill) ? 'text-red-600 font-medium' : ''}`}>
                        {formatDate(bill.due_date)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-500">Balance Due</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(bill.total - bill.amount_paid, bill.currency || 'USD')}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/bills/${bill.id}`}
                      className="text-navy-600 font-medium text-sm"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} bills
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


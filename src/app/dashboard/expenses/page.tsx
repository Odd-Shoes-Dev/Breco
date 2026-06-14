'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { ScaledNumber } from '@/components/ui/scaled-number';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ReceiptPercentIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import type { Expense } from '@/types/database';

type ExpenseStatus = 'all' | 'pending' | 'approved' | 'paid' | 'rejected';

interface ExpenseWithDetails extends Expense {
  vendors?: { name: string } | null;
  accounts?: { name: string; code: string } | null;
}

export default function ExpensesPage() {
  const searchParams = useSearchParams();
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>(searchParams.get('department') || 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    thisMonth: 0,
    pendingApproval: 0,
    approved: 0,
    paid: 0,
  });
  const pageSize = 20;

  useEffect(() => {
    loadExpenses();
    loadStats();
  }, [searchQuery, statusFilter, departmentFilter, currentPage]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('expenses')
        .select(`
          *,
          vendors (name),
          accounts:expense_account_id (name, code)
        `, { count: 'exact' })
        .order('expense_date', { ascending: false });

      if (searchQuery) {
        query = query.or(`expense_number.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      if (departmentFilter && departmentFilter !== 'all') {
        query = query.eq('department', departmentFilter);
      }

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setExpenses(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Failed to load expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/expenses/stats');
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'badge-warning',
      approved: 'badge-info',
      rejected: 'badge-error',
      paid: 'badge-success',
    };
    return styles[status] || 'badge-gray';
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500 mt-1">Track and manage business expenses</p>
        </div>
        <Link href="/dashboard/expenses/new" className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          Record Expense
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search expenses..."
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
                  setStatusFilter(e.target.value as ExpenseStatus);
                  setCurrentPage(1);
                }}
                className="input w-auto"
              >
                <option value="all">All Expenses</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">This Month (USD)</p>
            <ScaledNumber value={formatCurrency(stats.thisMonth)} className="text-gray-900 mt-1" />
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Pending Approval</p>
            <ScaledNumber value={String(stats.pendingApproval)} className="text-amber-600 mt-1" />
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Approved</p>
            <ScaledNumber value={String(stats.approved)} className="text-blue-600 mt-1" />
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Paid</p>
            <ScaledNumber value={String(stats.paid)} className="text-green-600 mt-1" />
          </div>
        </div>
      </div>

      {/* Expenses List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <ReceiptPercentIcon className="w-12 h-12 text-gray-400 mx-auto" />
            <p className="text-gray-500 mt-2">No expenses found.</p>
            <Link href="/dashboard/expenses/new" className="btn-primary mt-4 inline-flex">
              <PlusIcon className="w-5 h-5 mr-2" />
              Record Your First Expense
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop & Tablet Table */}
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Expense #</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Vendor</th>
                  <th className="text-right">Amount</th>
                  <th>Method</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr 
                    key={expense.id}
                    onClick={() => window.location.href = `/dashboard/expenses/${expense.id}`}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="whitespace-nowrap">{formatDate(expense.expense_date)}</td>
                    <td>
                      <span className="font-mono text-sm">{expense.expense_number || '-'}</span>
                    </td>
                    <td>
                      <p className="max-w-xs truncate">{expense.description}</p>
                    </td>
                    <td>
                      <span className="text-sm text-gray-600">
                        {expense.accounts?.name || '-'}
                      </span>
                    </td>
                    <td>
                      {expense.department ? (
                        <span className="badge badge-blue text-xs">
                          {expense.department}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">{expense.vendors?.name || expense.payee || '-'}</td>
                    <td className="text-right font-medium whitespace-nowrap">
                      {formatCurrency(expense.total, expense.currency || 'USD')}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="badge badge-gray">
                        {expense.payment_method}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/dashboard/expenses/${expense.id}`}
                        className="btn-ghost p-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <EyeIcon className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards - Hidden by default, can be shown if preferred */}
          <div className="hidden grid gap-4">
            {expenses.map((expense) => (
              <div key={expense.id} className="card">
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900 truncate max-w-[200px]">
                        {expense.description}
                      </p>
                      <p className="text-sm text-gray-500">{formatDate(expense.expense_date)}</p>
                    </div>
                    <span className="badge badge-gray">
                      {expense.payment_method}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    {expense.accounts && (
                      <p className="text-gray-600">{expense.accounts.name}</p>
                    )}
                    {(expense.vendors || expense.payee) && (
                      <p className="text-gray-600">Payee: {expense.vendors?.name || expense.payee}</p>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(expense.total, expense.currency || 'USD')}
                    </span>
                    <Link
                      href={`/dashboard/expenses/${expense.id}`}
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
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} expenses
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


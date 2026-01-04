'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { PlusIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Employee {
  first_name: string;
  last_name: string;
  employee_number: string;
}

interface SalaryAdvance {
  id: string;
  employee_id: string;
  advance_date: string;
  amount: number;
  reason: string | null;
  repayment_months: number;
  amount_repaid: number;
  status: 'pending' | 'approved' | 'rejected' | 'repaid';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  employee: Employee;
  approver?: {
    full_name: string;
  };
}

export default function SalaryAdvancesPage() {
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchAdvances();
  }, [statusFilter]);

  const fetchAdvances = async () => {
    try {
      let query = supabase
        .from('salary_advances')
        .select(`
          *,
          employee:employees(first_name, last_name, employee_number),
          approver:user_profiles!approved_by(full_name)
        `)
        .order('advance_date', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAdvances(data || []);
    } catch (error) {
      console.error('Error fetching salary advances:', error);
      toast.error('Failed to load salary advances');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (advanceId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('salary_advances')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', advanceId);

      if (error) throw error;

      toast.success('Salary advance approved');
      fetchAdvances();
    } catch (error: any) {
      console.error('Error approving advance:', error);
      toast.error(error.message || 'Failed to approve advance');
    }
  };

  const handleReject = async (advanceId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('salary_advances')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', advanceId);

      if (error) throw error;

      toast.success('Salary advance rejected');
      fetchAdvances();
    } catch (error: any) {
      console.error('Error rejecting advance:', error);
      toast.error(error.message || 'Failed to reject advance');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-700', icon: ClockIcon },
      approved: { color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
      rejected: { color: 'bg-red-100 text-red-700', icon: XCircleIcon },
      repaid: { color: 'bg-gray-100 text-gray-700', icon: CheckCircleIcon },
    };

    const badge = badges[status as keyof typeof badges];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const calculateMonthlyDeduction = (amount: number, months: number) => {
    return amount / months;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-breco-navy"></div>
      </div>
    );
  }

  const stats = {
    pending: advances.filter(a => a.status === 'pending').length,
    approved: advances.filter(a => a.status === 'approved').length,
    totalAdvanced: advances
      .filter(a => a.status === 'approved' || a.status === 'repaid')
      .reduce((sum, a) => sum + a.amount, 0),
    totalOutstanding: advances
      .filter(a => a.status === 'approved')
      .reduce((sum, a) => sum + (a.amount - a.amount_repaid), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary Advances</h1>
          <p className="text-gray-500 mt-1">Manage employee salary advance requests</p>
        </div>
        <Link href="/dashboard/employees/advances/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          New Advance Request
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <p className="text-sm text-gray-500 mb-1">Pending Requests</p>
          <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500 mb-1">Approved</p>
          <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500 mb-1">Total Advanced</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAdvanced)}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500 mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-breco-navy">{formatCurrency(stats.totalOutstanding)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          <div className="flex gap-2">
            {['all', 'pending', 'approved', 'rejected', 'repaid'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-breco-navy text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Advances Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Advance Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Repayment
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monthly Deduction
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount Repaid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {advances.map((advance) => (
                <tr key={advance.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="font-medium text-gray-900">
                        {advance.employee.first_name} {advance.employee.last_name}
                      </p>
                      <p className="text-sm text-gray-500">{advance.employee.employee_number}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {formatDate(advance.advance_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                    {formatCurrency(advance.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-gray-600">
                    {advance.repayment_months} {advance.repayment_months === 1 ? 'month' : 'months'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                    {formatCurrency(calculateMonthlyDeduction(advance.amount, advance.repayment_months))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div>
                      <p className="font-medium text-green-600">{formatCurrency(advance.amount_repaid)}</p>
                      <p className="text-xs text-gray-500">
                        {((advance.amount_repaid / advance.amount) * 100).toFixed(0)}%
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 max-w-xs truncate text-gray-600">
                    {advance.reason || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {getStatusBadge(advance.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {advance.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(advance.id)}
                          className="text-green-600 hover:text-green-900 text-sm font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(advance.id)}
                          className="text-red-600 hover:text-red-900 text-sm font-medium"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {advance.status === 'approved' && advance.approver && (
                      <p className="text-xs text-gray-500">
                        By {advance.approver.full_name}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {advances.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No salary advances found</p>
          </div>
        )}
      </div>
    </div>
  );
}

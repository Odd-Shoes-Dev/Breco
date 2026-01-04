'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { PlusIcon, CheckCircleIcon, XCircleIcon, ClockIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Employee {
  first_name: string;
  last_name: string;
  employee_number: string;
}

interface EmployeeReimbursement {
  id: string;
  employee_id: string;
  reimbursement_date: string;
  expense_type: string;
  description: string | null;
  amount: number;
  receipt_url: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  approved_by: string | null;
  approved_at: string | null;
  paid_in_payroll_id: string | null;
  created_at: string;
  employee: Employee;
  approver?: {
    full_name: string;
  };
  payroll_period?: {
    period_name: string;
  };
}

export default function ReimbursementsPage() {
  const [reimbursements, setReimbursements] = useState<EmployeeReimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchReimbursements();
  }, [statusFilter]);

  const fetchReimbursements = async () => {
    try {
      let query = supabase
        .from('employee_reimbursements')
        .select(`
          *,
          employee:employees(first_name, last_name, employee_number),
          approver:user_profiles!approved_by(full_name),
          payroll_period:payroll_periods!paid_in_payroll_id(period_name)
        `)
        .order('reimbursement_date', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReimbursements(data || []);
    } catch (error) {
      console.error('Error fetching reimbursements:', error);
      toast.error('Failed to load reimbursements');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (reimbursementId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('employee_reimbursements')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', reimbursementId);

      if (error) throw error;

      toast.success('Reimbursement approved');
      fetchReimbursements();
    } catch (error: any) {
      console.error('Error approving reimbursement:', error);
      toast.error(error.message || 'Failed to approve reimbursement');
    }
  };

  const handleReject = async (reimbursementId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('employee_reimbursements')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', reimbursementId);

      if (error) throw error;

      toast.success('Reimbursement rejected');
      fetchReimbursements();
    } catch (error: any) {
      console.error('Error rejecting reimbursement:', error);
      toast.error(error.message || 'Failed to reject reimbursement');
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
      paid: { color: 'bg-blue-100 text-blue-700', icon: CheckCircleIcon },
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-breco-navy"></div>
      </div>
    );
  }

  const stats = {
    pending: reimbursements.filter(r => r.status === 'pending').length,
    approved: reimbursements.filter(r => r.status === 'approved').length,
    totalApproved: reimbursements
      .filter(r => r.status === 'approved' || r.status === 'paid')
      .reduce((sum, r) => sum + r.amount, 0),
    unpaid: reimbursements
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + r.amount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Reimbursements</h1>
          <p className="text-gray-500 mt-1">Manage employee expense reimbursement requests</p>
        </div>
        <Link href="/dashboard/employees/reimbursements/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          New Reimbursement
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
          <p className="text-sm text-gray-500 mb-1">Total Approved</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalApproved)}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500 mb-1">Awaiting Payment</p>
          <p className="text-2xl font-bold text-breco-navy">{formatCurrency(stats.unpaid)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          <div className="flex gap-2">
            {['all', 'pending', 'approved', 'rejected', 'paid'].map((status) => (
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

      {/* Reimbursements Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expense Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Receipt
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paid In
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reimbursements.map((reimbursement) => (
                <tr key={reimbursement.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="font-medium text-gray-900">
                        {reimbursement.employee.first_name} {reimbursement.employee.last_name}
                      </p>
                      <p className="text-sm text-gray-500">{reimbursement.employee.employee_number}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {formatDate(reimbursement.reimbursement_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {reimbursement.expense_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 max-w-xs truncate text-gray-600">
                    {reimbursement.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                    {formatCurrency(reimbursement.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {reimbursement.receipt_url ? (
                      <a
                        href={reimbursement.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-breco-navy hover:text-breco-navy/80"
                      >
                        <DocumentTextIcon className="w-5 h-5 inline" />
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {getStatusBadge(reimbursement.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {reimbursement.payroll_period?.period_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {reimbursement.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(reimbursement.id)}
                          className="text-green-600 hover:text-green-900 text-sm font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(reimbursement.id)}
                          className="text-red-600 hover:text-red-900 text-sm font-medium"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {reimbursement.status === 'approved' && (
                      <span className="text-xs text-gray-500">Awaiting payroll</span>
                    )}
                    {reimbursement.status === 'paid' && reimbursement.approver && (
                      <p className="text-xs text-gray-500">
                        By {reimbursement.approver.full_name}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {reimbursements.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No reimbursement requests found</p>
          </div>
        )}
      </div>
    </div>
  );
}

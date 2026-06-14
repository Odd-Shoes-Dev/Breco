'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { ScaledNumber } from '@/components/ui/scaled-number';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  cashBalance: number;
  accountsReceivable: number;
  accountsPayable: number;
  overdueInvoices: number;
  overdueBills: number;
  inventoryValue: number;
  currency: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Get recent invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*, customers(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentInvoices(invoices || []);

      // Get recent bills
      const { data: bills } = await supabase
        .from('bills')
        .select('*, vendors(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentBills(bills || []);

      // Load stats with currency conversion from API
      const response = await fetch('/api/dashboard/stats');
      if (response.ok) {
        const statsData = await response.json();
        
        // Calculate overdue counts
        const now = new Date();
        const overdueInvoices = (invoices || []).filter(inv => 
          inv.status !== 'paid' && inv.status !== 'void' && 
          inv.status !== 'cancelled' && new Date(inv.due_date) < now
        ).length;

        const overdueBills = (bills || []).filter(bill =>
          bill.status !== 'paid' && bill.status !== 'void' &&
          new Date(bill.due_date) < now
        ).length;

        setStats({
          ...statsData,
          overdueInvoices,
          overdueBills,
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const baseCurrency = stats?.currency || 'UGX';

  const formatCurrency = (amount: number, currency: string = baseCurrency) => {
    return currencyFormatter(amount, currency as any);
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      draft: 'status-draft',
      sent: 'status-sent',
      partial: 'status-partial',
      paid: 'status-paid',
      overdue: 'status-overdue',
      approved: 'status-approved',
      void: 'status-void',
    };
    return classes[status] || 'badge-gray';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-breco-navy border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome to Breco Safaris Operations</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/invoices/new" className="btn-primary">
            New Invoice
          </Link>
          <Link href="/dashboard/expenses/new" className="btn-secondary">
            New Expense
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Cash Balance"
          value={formatCurrency(stats?.cashBalance || 0)}
          icon={BanknotesIcon}
          trend={12.5}
          color="navy"
        />
        <StatCard
          title="Accounts Receivable"
          value={formatCurrency(stats?.accountsReceivable || 0)}
          icon={DocumentTextIcon}
          subtitle={`${stats?.overdueInvoices || 0} overdue`}
          color="navy"
        />
        <StatCard
          title="Accounts Payable"
          value={formatCurrency(stats?.accountsPayable || 0)}
          icon={CurrencyDollarIcon}
          subtitle={`${stats?.overdueBills || 0} overdue`}
          color="navy"
        />
        <StatCard
          title="Net Income"
          value={formatCurrency(stats?.netIncome || 0)}
          icon={ArrowTrendingUpIcon}
          trend={8.2}
          color="navy"
        />
      </div>

      {/* Alerts */}
      {((stats?.overdueInvoices || 0) > 0 || (stats?.overdueBills || 0) > 0) && (
        <div className="card border-l-4 border-l-yellow-500 bg-yellow-50">
          <div className="card-body flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">Attention Required</h3>
              <p className="text-sm text-yellow-700 mt-1">
                You have {stats?.overdueInvoices || 0} overdue invoices and{' '}
                {stats?.overdueBills || 0} overdue bills that need attention.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Invoices</h2>
            <Link
              href="/dashboard/invoices"
              className="text-sm text-breco-teal hover:text-breco-teal-dark hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {recentInvoices.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No invoices yet.{' '}
                <Link href="/dashboard/invoices/new" className="text-breco-teal hover:text-breco-teal-dark hover:underline">
                  Create your first invoice
                </Link>
              </div>
            ) : (
              recentInvoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/dashboard/invoices/${invoice.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {invoice.invoice_number}
                      </p>
                      <p className="text-sm text-gray-500">
                        {invoice.customers?.name || 'Unknown Customer'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {formatCurrency(invoice.total, invoice.currency || 'USD')}
                      </p>
                      <span className={getStatusBadge(invoice.status)}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Bills */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Bills</h2>
            <Link
              href="/dashboard/bills"
              className="text-sm text-breco-teal hover:text-breco-teal-dark hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {recentBills.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No bills yet.{' '}
                <Link href="/dashboard/bills/new" className="text-breco-teal hover:text-breco-teal-dark hover:underline">
                  Create your first bill
                </Link>
              </div>
            ) : (
              recentBills.map((bill) => (
                <Link
                  key={bill.id}
                  href={`/dashboard/bills/${bill.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {bill.bill_number}
                      </p>
                      <p className="text-sm text-gray-500">
                        {bill.vendors?.name || 'Unknown Vendor'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {formatCurrency(bill.total, bill.currency || 'USD')}
                      </p>
                      <span className={getStatusBadge(bill.status)}>
                        {bill.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <DocumentTextIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900 truncate">
                {recentInvoices.length}
              </p>
              <p className="text-xs text-gray-500 truncate">Total Invoices</p>
            </div>
          </div>
        </div>
        <div className="card p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <BanknotesIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900 truncate">
                {recentBills.length}
              </p>
              <p className="text-xs text-gray-500 truncate">Total Bills</p>
            </div>
          </div>
        </div>
        <div className="card p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <CubeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <ScaledNumber value={formatCurrency(stats?.inventoryValue || 0)} className="text-gray-900" />
              <p className="text-xs text-gray-500 truncate">Inventory Value</p>
            </div>
          </div>
        </div>
        <div className="card p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <ArrowTrendingUpIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <ScaledNumber value={formatCurrency(stats?.totalRevenue || 0)} className="text-gray-900" />
              <p className="text-xs text-gray-500 truncate">Total Revenue</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: number;
  subtitle?: string;
  color: 'navy' | 'magenta' | 'purple' | 'green';
}) {
  const colorClasses = {
    navy: 'bg-breco-navy',
    magenta: 'bg-Breco Safaris-magenta',
    purple: 'bg-Breco Safaris-purple',
    green: 'bg-breco-teal',
  };

  return (
    <div className="card p-3 sm:p-4 lg:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 truncate">{title}</p>
          <ScaledNumber value={value} className="text-gray-900 mt-0.5" />
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-1">
              {trend >= 0 ? (
                <ArrowUpIcon className="w-3 h-3 text-green-600" />
              ) : (
                <ArrowDownIcon className="w-3 h-3 text-red-600" />
              )}
              <span
                className={`text-xs font-medium ${
                  trend >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {Math.abs(trend)}%
              </span>
              <span className="text-xs text-gray-500 hidden sm:inline">vs last month</span>
            </div>
          )}
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1 truncate">{subtitle}</p>
          )}
        </div>
        <div className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 ${colorClasses[color]} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white" />
        </div>
      </div>
    </div>
  );
}


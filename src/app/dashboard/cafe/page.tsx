'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BuildingStorefrontIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  ChartBarIcon,
  UsersIcon,
  PlusIcon,
  DocumentTextIcon,
  ReceiptPercentIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/currency';

interface CafeStats {
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number;
  employeeCount: number;
  totalPayroll: number;
}

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface ExpenseBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export default function CafeDashboardPage() {
  const [stats, setStats] = useState<CafeStats>({
    revenue: 0,
    expenses: 0,
    profit: 0,
    profitMargin: 0,
    employeeCount: 0,
    totalPayroll: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCafeData();
  }, []);

  const loadCafeData = async () => {
    try {
      setLoading(true);
      
      // Get current month start and end
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // Fetch cafe revenue accounts (42xx)
      const { data: cafeAccounts } = await supabase
        .from('accounts')
        .select('id')
        .like('code', '42%');

      const cafeAccountIds = cafeAccounts?.map(a => a.id) || [];

      // Fetch cafe revenue from journal lines
      const { data: revenueData } = await supabase
        .from('journal_lines')
        .select('credit')
        .in('account_id', cafeAccountIds)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .gt('credit', 0);

      const revenue = revenueData?.reduce((sum, entry) => sum + Number(entry.credit || 0), 0) || 0;

      // Fetch cafe expenses (department = 'Cafe')
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('total')
        .eq('department', 'Cafe')
        .gte('expense_date', monthStart.toISOString())
        .lte('expense_date', monthEnd.toISOString());

      const expenses = expensesData?.reduce((sum, exp) => sum + Number(exp.total || 0), 0) || 0;

      // Fetch cafe employees
      const { data: employeesData, count: employeeCount } = await supabase
        .from('employees')
        .select('id, basic_salary', { count: 'exact' })
        .eq('department', 'Cafe')
        .eq('employment_status', 'active');

      const totalPayroll = employeesData?.reduce((sum, emp) => sum + Number(emp.basic_salary || 0), 0) || 0;

      const profit = revenue - expenses;
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

      setStats({
        revenue,
        expenses,
        profit,
        profitMargin,
        employeeCount: employeeCount || 0,
        totalPayroll,
      });

      // Fetch last 6 months data
      await loadMonthlyTrend();
      
      // Fetch expense breakdown
      await loadExpenseBreakdown(monthStart, monthEnd, expenses);

    } catch (error) {
      console.error('Error loading cafe data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyTrend = async () => {
    const months: MonthlyData[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

      // Fetch cafe account IDs (42xx)
      const { data: cafeAccounts } = await supabase
        .from('accounts')
        .select('id')
        .like('code', '42%');

      const cafeAccountIds = cafeAccounts?.map(a => a.id) || [];

      // Revenue
      const { data: revenueData } = await supabase
        .from('journal_lines')
        .select('credit')
        .in('account_id', cafeAccountIds)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .gt('credit', 0);

      const revenue = revenueData?.reduce((sum, entry) => sum + Number(entry.credit || 0), 0) || 0;

      // Expenses
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('total')
        .eq('department', 'Cafe')
        .gte('expense_date', monthStart.toISOString())
        .lte('expense_date', monthEnd.toISOString());

      const expenses = expensesData?.reduce((sum, exp) => sum + Number(exp.total || 0), 0) || 0;

      months.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
        revenue,
        expenses,
        profit: revenue - expenses,
      });
    }

    setMonthlyData(months);
  };

  const loadExpenseBreakdown = async (monthStart: Date, monthEnd: Date, totalExpenses: number) => {
    const { data: expenses } = await supabase
      .from('expenses')
      .select('category, total')
      .eq('department', 'Cafe')
      .gte('expense_date', monthStart.toISOString())
      .lte('expense_date', monthEnd.toISOString());

    if (!expenses || expenses.length === 0) {
      setExpenseBreakdown([]);
      return;
    }

    // Group by category
    const categoryTotals: Record<string, number> = {};
    expenses.forEach(exp => {
      const category = exp.category || 'Other';
      categoryTotals[category] = (categoryTotals[category] || 0) + Number(exp.total || 0);
    });

    // Add payroll to breakdown
    categoryTotals['Payroll'] = stats.totalPayroll;

    const breakdown = Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / (totalExpenses + stats.totalPayroll)) * 100 : 0,
    }));

    breakdown.sort((a, b) => b.amount - a.amount);
    setExpenseBreakdown(breakdown);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-breco-navy"></div>
      </div>
    );
  }

  const maxRevenue = Math.max(...monthlyData.map(m => m.revenue));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BuildingStorefrontIcon className="w-8 h-8 text-breco-navy" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cafe Performance</h1>
            <p className="text-gray-500">Track cafe revenue, expenses, and profitability</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/cafe/record-sales"
            className="btn-primary flex items-center gap-2"
          >
            <ReceiptPercentIcon className="w-5 h-5" />
            Record Sales
          </Link>
          <Link
            href="/dashboard/expenses/new?department=Cafe"
            className="btn-secondary flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Add Expense
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Revenue (This Month)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stats.revenue)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Expenses (This Month)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stats.expenses)}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <BanknotesIcon className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Profit */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Profit (This Month)</p>
                <p className={`text-2xl font-bold mt-1 ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(stats.profit)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.profitMargin.toFixed(1)}% margin
                </p>
              </div>
              <div className={`p-3 rounded-lg ${stats.profit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                {stats.profit >= 0 ? (
                  <ArrowTrendingUpIcon className="w-6 h-6 text-green-600" />
                ) : (
                  <ArrowTrendingDownIcon className="w-6 h-6 text-red-600" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Employees */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Cafe Staff</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.employeeCount}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Payroll: {formatCurrency(stats.totalPayroll)}/mo
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <UsersIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Revenue Trend (Last 6 Months)</h2>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {monthlyData.map((month, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{month.month}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(month.revenue)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-breco-navy h-2 rounded-full"
                      style={{ width: `${maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Expense Breakdown (This Month)</h2>
          </div>
          <div className="card-body">
            {expenseBreakdown.length > 0 ? (
              <div className="space-y-3">
                {expenseBreakdown.map((item, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {item.category.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(item.amount)}
                        </span>
                        <span className="text-xs text-gray-500">({item.percentage.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No expenses recorded this month</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/dashboard/cafe/record-sales"
              className="flex items-center gap-3 p-4 border-2 border-green-500 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <BanknotesIcon className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-gray-900">Record Sales</p>
                <p className="text-xs text-gray-600">Daily/Weekly/Monthly</p>
              </div>
            </Link>

            <Link
              href="/dashboard/employees?department=Cafe"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-breco-navy hover:bg-gray-50 transition-colors"
            >
              <UsersIcon className="w-6 h-6 text-breco-navy" />
              <div>
                <p className="font-medium text-gray-900">View Cafe Staff</p>
                <p className="text-xs text-gray-500">{stats.employeeCount} employees</p>
              </div>
            </Link>

            <Link
              href="/dashboard/expenses?department=Cafe"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-breco-navy hover:bg-gray-50 transition-colors"
            >
              <BanknotesIcon className="w-6 h-6 text-breco-navy" />
              <div>
                <p className="font-medium text-gray-900">View Cafe Expenses</p>
                <p className="text-xs text-gray-500">All cafe costs</p>
              </div>
            </Link>

            <Link
              href="/dashboard/reports/profit-loss?accounts=42"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-breco-navy hover:bg-gray-50 transition-colors"
            >
              <ChartBarIcon className="w-6 h-6 text-breco-navy" />
              <div>
                <p className="font-medium text-gray-900">Cafe P&L Report</p>
                <p className="text-xs text-gray-500">Detailed financials</p>
              </div>
            </Link>

            <Link
              href="/dashboard/general-ledger?account_filter=42"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-breco-navy hover:bg-gray-50 transition-colors"
            >
              <DocumentTextIcon className="w-6 h-6 text-breco-navy" />
              <div>
                <p className="font-medium text-gray-900">Cafe Transactions</p>
                <p className="text-xs text-gray-500">View all entries</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

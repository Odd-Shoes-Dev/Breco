'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  PlusIcon,
  BanknotesIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import type { BankAccount, BankTransaction } from '@/types/database';

export default function BankPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<(BankTransaction & { bank_accounts?: { name: string; currency: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBalance: 0,
    unreconciledCount: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load bank accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (accountsError) throw accountsError;
      setAccounts(accountsData || []);

      // Calculate total balance from all bank accounts (convert to USD for now)
      const totalBalance = accountsData?.reduce((sum, account) => {
        return sum + (account.current_balance || 0);
      }, 0) || 0;

      // Load recent transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('bank_transactions')
        .select(`
          *,
          bank_accounts (name, currency)
        `)
        .order('transaction_date', { ascending: false })
        .limit(10);

      if (transactionsError) throw transactionsError;
      setRecentTransactions(transactionsData || []);

      // Count unreconciled
      const { count } = await supabase
        .from('bank_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('is_reconciled', false);

      setStats({
        totalBalance,
        unreconciledCount: count || 0,
      });
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return currencyFormatter(amount, currency as any);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cash & Bank</h1>
          <p className="text-gray-500 mt-1">Manage bank accounts and transactions</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/bank/reconcile" className="btn-secondary">
            <ArrowsRightLeftIcon className="w-5 h-5 mr-2" />
            Reconcile
          </Link>
          <Link href="/dashboard/bank/accounts/new" className="btn-primary">
            <PlusIcon className="w-5 h-5 mr-2" />
            Add Account
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Total Cash Balance</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(stats.totalBalance)}</p>
            <p className="text-sm text-gray-500 mt-2">Across {accounts.length} accounts</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Unreconciled</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.unreconciledCount}</p>
            <p className="text-sm text-gray-500 mt-2">transactions pending</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">This Month</p>
            <div className="flex gap-4 mt-1">
              <div>
                <div className="flex items-center gap-1 text-green-600">
                  <ArrowUpIcon className="w-4 h-4" />
                  <span className="text-lg font-bold">$0</span>
                </div>
                <p className="text-xs text-gray-500">In</p>
              </div>
              <div>
                <div className="flex items-center gap-1 text-red-600">
                  <ArrowDownIcon className="w-4 h-4" />
                  <span className="text-lg font-bold">$0</span>
                </div>
                <p className="text-xs text-gray-500">Out</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Accounts */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Bank Accounts</h2>
          <Link href="/dashboard/bank/accounts" className="text-sm text-navy-600 font-medium">
            View All
          </Link>
        </div>
        <div className="card-body">
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <BanknotesIcon className="w-12 h-12 text-gray-400 mx-auto" />
              <p className="text-gray-500 mt-2">No bank accounts set up.</p>
              <Link href="/dashboard/bank/accounts/new" className="btn-primary mt-4 inline-flex">
                <PlusIcon className="w-5 h-5 mr-2" />
                Add Bank Account
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((account) => (
                <Link
                  key={account.id}
                  href={`/dashboard/bank/accounts/${account.id}`}
                  className="block p-4 border border-gray-200 rounded-lg hover:border-navy-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{account.name}</h3>
                      <p className="text-sm text-gray-500">{account.bank_name}</p>
                      <p className="text-xs text-gray-400 mt-1">{account.account_type}</p>
                    </div>
                    <div className="text-right">
                      <span className={`badge ${account.is_primary ? 'badge-success' : 'badge-gray'}`}>
                        {account.is_primary ? 'Primary' : account.currency}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
          <Link href="/dashboard/bank/transactions" className="text-sm text-navy-600 font-medium">
            View All
          </Link>
        </div>
        <div className="card-body">
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No transactions yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((transaction) => {
                const isIncoming = transaction.amount > 0 || transaction.transaction_type === 'deposit' || transaction.transaction_type === 'transfer_in';
                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        isIncoming
                          ? 'bg-green-100 text-green-600' 
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {isIncoming ? (
                          <ArrowUpIcon className="w-4 h-4" />
                        ) : (
                          <ArrowDownIcon className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {transaction.description || 'Transaction'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(transaction.transaction_date)} • {transaction.bank_accounts?.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${
                        isIncoming ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {isIncoming ? '+' : '-'}
                        {formatCurrency(Math.abs(transaction.amount), transaction.bank_accounts?.currency || 'USD')}
                      </p>
                      {!transaction.is_reconciled && (
                        <span className="text-xs text-amber-600">Unreconciled</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link
          href="/dashboard/bank/transactions/new?type=deposit"
          className="card hover:shadow-md transition-shadow"
        >
          <div className="card-body flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <ArrowUpIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Record Deposit</h3>
              <p className="text-sm text-gray-500">Add incoming funds</p>
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/bank/transactions/new?type=withdrawal"
          className="card hover:shadow-md transition-shadow"
        >
          <div className="card-body flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <ArrowDownIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Record Withdrawal</h3>
              <p className="text-sm text-gray-500">Record outgoing funds</p>
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/bank/transfer"
          className="card hover:shadow-md transition-shadow"
        >
          <div className="card-body flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ArrowsRightLeftIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Transfer Funds</h3>
              <p className="text-sm text-gray-500">Move between accounts</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}


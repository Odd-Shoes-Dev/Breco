'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_type: string;
  routing_number: string;
  wire_routing_number: string;
  currency: string;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
}

interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  reference_number: string;
  amount: number;
  transaction_type: string;
  is_reconciled: boolean;
}

export default function BankAccountDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAccount();
    loadTransactions();
  }, [id]);

  const loadAccount = async () => {
    try {
      const res = await fetch(`/api/bank-accounts/${id}`);
      if (!res.ok) throw new Error('Failed to load account');
      const result = await res.json();
      setAccount(result.data || result);
    } catch (error) {
      console.error('Failed to load bank account:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const res = await fetch(`/api/bank-transactions?bank_account_id=${id}&limit=50`);
      if (!res.ok) throw new Error('Failed to load transactions');
      const result = await res.json();
      setTransactions(result.data || []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, 'USD');
  };

  const calculateBalance = () => {
    return transactions.reduce((balance, transaction) => {
      return balance + (transaction.transaction_type === 'credit' ? transaction.amount : -transaction.amount);
    }, 0);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${account?.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(true);
      const res = await fetch(`/api/bank-accounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      alert('Bank account deleted successfully');
      window.location.href = '/dashboard/bank/accounts';
    } catch (error) {
      console.error('Failed to delete bank account:', error);
      alert('Failed to delete bank account. It may have associated transactions.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a5f]"></div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Bank account not found</p>
        <Link href="/dashboard/bank/accounts" className="btn-primary mt-4">
          Back to Accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/bank/accounts" className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{account.name}</h1>
            <p className="text-gray-500 mt-1">{account.bank_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/bank/accounts/${id}/edit`}
            className="btn-ghost p-2"
          >
            <PencilIcon className="w-5 h-5" />
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-ghost p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Account Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Account Type</label>
            <p className="text-base text-gray-900 capitalize">{account.account_type}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Currency</label>
            <p className="text-base text-gray-900">{account.currency}</p>
          </div>

          {account.routing_number && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Routing Number</label>
              <p className="text-base text-gray-900">{account.routing_number}</p>
            </div>
          )}

          {account.wire_routing_number && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Wire Routing Number</label>
              <p className="text-base text-gray-900">{account.wire_routing_number}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              account.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {account.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Primary Account</label>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              account.is_primary ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {account.is_primary ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Current Balance</p>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(calculateBalance())}</p>
          </div>
          <BanknotesIcon className="w-12 h-12 text-gray-300" />
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Recent Transactions</h3>
          <Link href="/dashboard/bank/transactions" className="text-sm text-[#1e3a5f] hover:underline">
            View All
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <BanknotesIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(transaction.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{transaction.description}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{transaction.reference_number}</td>
                    <td className={`px-6 py-4 text-sm font-medium text-right ${
                      transaction.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.transaction_type === 'credit' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        transaction.is_reconciled ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {transaction.is_reconciled ? 'Reconciled' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

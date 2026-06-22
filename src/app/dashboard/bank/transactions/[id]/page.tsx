'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  BanknotesIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface BankTransaction {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  transaction_type: string;
  description: string;
  amount: number;
  reference_number: string;
  is_reconciled: boolean;
  created_at: string;
  bank_accounts?: {
    id: string;
    name: string;
    bank_name: string;
  };
}

export default function TransactionDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [transaction, setTransaction] = useState<BankTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadTransaction();
  }, [id]);

  const loadTransaction = async () => {
    try {
      const res = await fetch(`/api/bank-transactions?id=${id}`);
      if (!res.ok) throw new Error('Failed to load transaction');
      const result = await res.json();
      const tx = (result.data || [])[0] || result.data || result;
      setTransaction(tx);
    } catch (error) {
      console.error('Failed to load transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      const res = await fetch(`/api/bank-transactions?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      alert('Transaction deleted successfully');
      router.push('/dashboard/bank/transactions');
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      alert('Failed to delete transaction. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, 'USD');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a5f]"></div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Transaction not found</p>
        <Link href="/dashboard/bank/transactions" className="btn-primary mt-4">
          Back to Transactions
        </Link>
      </div>
    );
  }

  const isIncoming = transaction.amount > 0 || transaction.transaction_type === 'deposit' || transaction.transaction_type === 'transfer_in';

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/bank/transactions" className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transaction Details</h1>
            <p className="text-gray-500 mt-1">{formatDate(transaction.transaction_date)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-ghost p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Transaction Amount Card */}
      <div className={`bg-white rounded-xl shadow-sm border-2 p-8 text-center ${
        isIncoming ? 'border-green-200' : 'border-red-200'
      }`}>
        <div className={`inline-flex p-4 rounded-full mb-4 ${
          isIncoming ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {isIncoming ? (
            <ArrowUpIcon className={`w-8 h-8 ${isIncoming ? 'text-green-600' : 'text-red-600'}`} />
          ) : (
            <ArrowDownIcon className="w-8 h-8 text-red-600" />
          )}
        </div>
        <p className="text-sm text-gray-500 mb-2">Transaction Amount</p>
        <p className={`text-4xl font-bold ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>
          {isIncoming ? '+' : '-'}
          {formatCurrency(Math.abs(transaction.amount))}
        </p>
        <p className="text-sm text-gray-500 mt-2 capitalize">
          {transaction.transaction_type.replace('_', ' ')}
        </p>
      </div>

      {/* Transaction Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Transaction Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Bank Account</label>
            <p className="text-base text-gray-900">
              {transaction.bank_accounts?.name || 'N/A'}
            </p>
            {transaction.bank_accounts?.bank_name && (
              <p className="text-sm text-gray-500">{transaction.bank_accounts.bank_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Transaction Date</label>
            <p className="text-base text-gray-900">{formatDate(transaction.transaction_date)}</p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-500 mb-1">Description</label>
            <p className="text-base text-gray-900">{transaction.description || 'No description'}</p>
          </div>

          {transaction.reference_number && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Reference Number</label>
              <p className="text-base text-gray-900 font-mono">{transaction.reference_number}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Reconciliation Status</label>
            <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
              transaction.is_reconciled
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {transaction.is_reconciled ? 'Reconciled' : 'Unreconciled'}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Created</label>
            <p className="text-base text-gray-900">
              {new Date(transaction.created_at).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href={`/dashboard/bank/accounts/${transaction.bank_account_id}`}
          className="btn-secondary flex-1 justify-center"
        >
          <BanknotesIcon className="w-5 h-5 mr-2" />
          View Account
        </Link>
      </div>
    </div>
  );
}

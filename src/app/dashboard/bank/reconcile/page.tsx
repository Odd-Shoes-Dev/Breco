'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

interface BankAccount {
  id: string;
  name: string;
  account_number_encrypted: any;
  bank_name: string;
  account_type: string;
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

export default function ReconcilePage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [statementBalance, setStatementBalance] = useState<number>(0);
  const [statementDate, setStatementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadBankAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      loadTransactions();
    }
  }, [selectedAccount]);

  const loadBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      setBankAccounts(data || []);
    } catch (error) {
      console.error('Failed to load bank accounts:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('bank_account_id', selectedAccount)
        .eq('is_reconciled', false)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTransaction = (transactionId: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedTransactions(newSelected);
  };

  const calculateDifference = () => {
    const selectedAmount = transactions
      .filter(t => selectedTransactions.has(t.id))
      .reduce((sum, t) => {
        return sum + (t.transaction_type === 'credit' ? t.amount : -t.amount);
      }, 0);

    return statementBalance - selectedAmount;
  };

  const handleReconcile = async () => {
    if (selectedTransactions.size === 0) {
      alert('Please select at least one transaction to reconcile.');
      return;
    }

    const difference = calculateDifference();
    if (Math.abs(difference) > 0.01) {
      if (!confirm(`There is a difference of ${formatCurrency(difference)}. Do you want to continue anyway?`)) {
        return;
      }
    }

    try {
      setLoading(true);

      // Mark selected transactions as reconciled
      const { error } = await supabase
        .from('bank_transactions')
        .update({ 
          is_reconciled: true
        })
        .in('id', Array.from(selectedTransactions));

      if (error) throw error;

      alert('Reconciliation completed successfully!');
      setSelectedTransactions(new Set());
      await loadTransactions();
    } catch (error) {
      console.error('Failed to reconcile:', error);
      alert('Failed to complete reconciliation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, 'USD');
  };

  const currentAccount = bankAccounts.find(a => a.id === selectedAccount);
  const difference = calculateDifference();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/bank" className="btn-ghost p-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Reconciliation</h1>
          <p className="text-gray-500 mt-1">Match your bank statement with your records</p>
        </div>
      </div>

      {/* Reconciliation Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bank Account
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            >
              <option value="">Select an account...</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.account_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statement Date
            </label>
            <input
              type="date"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statement Balance
            </label>
            <input
              type="number"
              step="0.01"
              value={statementBalance}
              onChange={(e) => setStatementBalance(Number(e.target.value))}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            />
          </div>
        </div>
      </div>

      {selectedAccount && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <p className="text-sm text-gray-600 mb-1">Statement Balance</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(statementBalance)}</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <p className="text-sm text-gray-600 mb-1">Selected Items</p>
              <p className="text-2xl font-bold text-blue-600">{selectedTransactions.size}</p>
            </div>

            <div className={`bg-white rounded-lg shadow-sm border p-4 ${
              Math.abs(difference) < 0.01 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}>
              <p className="text-sm text-gray-600 mb-1">Difference</p>
              <p className={`text-2xl font-bold ${
                Math.abs(difference) < 0.01 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(difference)}
              </p>
            </div>
          </div>

          {/* Transactions List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                Unreconciled Transactions ({transactions.length})
              </h3>
              <button
                onClick={handleReconcile}
                disabled={loading || selectedTransactions.size === 0}
                className="btn-primary"
              >
                <CheckCircleIcon className="w-5 h-5 mr-2" />
                Reconcile Selected
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12">
                <BanknotesIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No unreconciled transactions</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTransactions(new Set(transactions.map(t => t.id)));
                            } else {
                              setSelectedTransactions(new Set());
                            }
                          }}
                          checked={selectedTransactions.size === transactions.length && transactions.length > 0}
                          className="w-4 h-4 text-[#52b53b] border-gray-300 rounded focus:ring-[#1e3a5f]"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className={`hover:bg-gray-50 cursor-pointer ${
                          selectedTransactions.has(transaction.id) ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => toggleTransaction(transaction.id)}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedTransactions.has(transaction.id)}
                            onChange={() => toggleTransaction(transaction.id)}
                            className="w-4 h-4 text-[#52b53b] border-gray-300 rounded focus:ring-[#1e3a5f]"
                          />
                        </td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


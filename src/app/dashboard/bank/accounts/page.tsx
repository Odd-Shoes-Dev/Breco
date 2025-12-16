'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  PlusIcon,
  BanknotesIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import type { BankAccount } from '@/types/database';

export default function BankAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active');

  useEffect(() => {
    loadAccounts();
  }, [filter]);

  const loadAccounts = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('bank_accounts')
        .select('*')
        .order('name');

      if (filter === 'active') {
        query = query.eq('is_active', true);
      } else if (filter === 'inactive') {
        query = query.eq('is_active', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Go back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bank Accounts</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your company's bank accounts
            </p>
          </div>
        </div>
        <Link href="/dashboard/bank/accounts/new" className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Account
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'active'
              ? 'bg-[#1e3a5f] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setFilter('inactive')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'inactive'
              ? 'bg-[#1e3a5f] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Inactive
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-[#1e3a5f] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
      </div>

      {/* Accounts Grid */}
      <div className="card">
        {accounts.length === 0 ? (
          <div className="text-center py-12">
            <BanknotesIcon className="w-16 h-16 text-gray-400 mx-auto" />
            <h3 className="text-lg font-medium text-gray-900 mt-4">No bank accounts found</h3>
            <p className="text-gray-500 mt-2">
              {filter === 'active' && 'No active bank accounts. Add one to get started.'}
              {filter === 'inactive' && 'No inactive bank accounts.'}
              {filter === 'all' && 'No bank accounts set up yet.'}
            </p>
            {filter !== 'inactive' && (
              <Link href="/dashboard/bank/accounts/new" className="btn-primary mt-4 inline-flex">
                <PlusIcon className="w-5 h-5 mr-2" />
                Add Bank Account
              </Link>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {accounts.map((account) => (
              <Link
                key={account.id}
                href={`/dashboard/bank/accounts/${account.id}`}
                className="block p-6 border border-gray-200 rounded-lg hover:border-[#1e3a5f] hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {account.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{account.bank_name}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Type:</span>
                    <span className="text-gray-900 font-medium capitalize">
                      {account.account_type.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Currency:</span>
                    <span className="text-gray-900 font-medium">{account.currency}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  {account.is_primary && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                      Primary
                    </span>
                  )}
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    account.is_active
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {account.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { MagnifyingGlassIcon, BookOpenIcon } from '@heroicons/react/24/outline';

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  account_subtype: string;
  normal_balance: string;
  is_active: boolean;
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch =
      account.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      filterType === 'all' || account.account_type === filterType;

    return matchesSearch && matchesType;
  });

  const groupedAccounts = filteredAccounts.reduce((groups, account) => {
    const type = account.account_type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(account);
    return groups;
  }, {} as Record<string, Account[]>);

  const formatAccountType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      asset: 'bg-blue-100 text-blue-800',
      liability: 'bg-red-100 text-red-800',
      equity: 'bg-purple-100 text-purple-800',
      revenue: 'bg-green-100 text-green-800',
      expense: 'bg-orange-100 text-orange-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="loading"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <BookOpenIcon className="w-8 h-8 text-[#1e3a5f]" />
          <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
        </div>
        <p className="text-gray-500">
          Reference guide for all accounting categories and their account numbers
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How to Use Account Numbers</h3>
        <p className="text-sm text-blue-700">
          When creating bills, expenses, or recording transactions, select the account number that best describes what you're paying for. 
          For example, use <strong>5110</strong> for Gorilla Permits, <strong>6100</strong> for Salaries, or <strong>7510</strong> for Fuel.
        </p>
      </div>

      {/* Search & Filter */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by account number or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input"
            >
              <option value="all">All Account Types</option>
              <option value="asset">Assets</option>
              <option value="liability">Liabilities</option>
              <option value="equity">Equity</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expenses</option>
            </select>
          </div>
        </div>
      </div>

      {/* Accounts by Type */}
      <div className="space-y-6">
        {Object.entries(groupedAccounts).map(([type, typeAccounts]) => (
          <div key={type} className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h2 className="card-title">{formatAccountType(type)}</h2>
                <span className={`badge ${getTypeColor(type)}`}>
                  {typeAccounts.length} accounts
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-32">Account #</th>
                    <th>Account Name</th>
                    <th className="w-40">Subtype</th>
                    <th className="w-32 text-center">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {typeAccounts.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <span className="font-mono font-semibold text-[#1e3a5f]">
                          {account.code}
                        </span>
                      </td>
                      <td className="font-medium">{account.name}</td>
                      <td className="text-sm text-gray-600">
                        {formatAccountType(account.account_subtype)}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${
                          account.normal_balance === 'debit' 
                            ? 'badge-info' 
                            : 'badge-success'
                        }`}>
                          {account.normal_balance === 'debit' ? 'DR' : 'CR'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {filteredAccounts.length === 0 && (
        <div className="text-center py-12">
          <BookOpenIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No accounts found matching your search</p>
        </div>
      )}

      {/* Quick Reference Guide */}
      <div className="card bg-gray-50">
        <div className="card-body">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Reference Guide</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">📊 Common Expense Accounts:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><strong>5100-5500:</strong> Tour & Safari Costs (permits, accommodation, guides)</li>
                <li><strong>6100-6700:</strong> Operating Expenses (salaries, rent, insurance)</li>
                <li><strong>7000-7300:</strong> Marketing & Advertising</li>
                <li><strong>7500-7550:</strong> Fleet Expenses (fuel, servicing, insurance)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">💰 Common Revenue Accounts:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><strong>4100-4140:</strong> Tour Revenue (safaris, permits)</li>
                <li><strong>4200-4220:</strong> Car Hire Revenue</li>
                <li><strong>4300:</strong> Accommodation Commissions</li>
                <li><strong>4400:</strong> Airport Transfers</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpenIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface JournalEntry {
  id: string;
  entry_date: string;
  entry_number: string;
  description: string;
  reference: string;
  source: string;
  status: 'draft' | 'posted' | 'void';
  is_posted: boolean;
  lines: Array<{
    id: string;
    account_code: string;
    account_name: string;
    debit_amount: number;
    credit_amount: number;
    description: string;
  }>;
}

export default function GeneralLedgerPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    search: '',
    showPostedOnly: false,
  });

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/journal-entries');
      const result = await response.json();
      setEntries(result || []); // API returns data directly, not wrapped in { data: ... }
    } catch (error) {
      console.error('Failed to fetch entries:', error);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoid = async (id: string, entryNumber: string) => {
    if (!confirm(`Are you sure you want to void journal entry ${entryNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/journal-entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to void entry');
      }

      await fetchEntries(); // Refresh the list
    } catch (error) {
      console.error('Error voiding entry:', error);
      alert(error instanceof Error ? error.message : 'Failed to void entry');
    }
  };

  const handleDelete = async (id: string, entryNumber: string) => {
    if (!confirm(`Are you sure you want to delete journal entry ${entryNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/journal-entries/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete entry');
      }

      await fetchEntries(); // Refresh the list
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete entry');
    }
  };

  const toggleEntry = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredEntries = entries.filter((entry) => {
    if (filters.showPostedOnly && entry.status !== 'posted') return false;
    if (filters.startDate && entry.entry_date < filters.startDate) return false;
    if (filters.endDate && entry.entry_date > filters.endDate) return false;
    if (
      filters.search &&
      !entry.description.toLowerCase().includes(filters.search.toLowerCase()) &&
      !entry.entry_number.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">General Ledger</h1>
          <p className="text-sm sm:text-base text-gray-600">Journal entries and transactions</p>
        </div>
        <Link
          href="/dashboard/journal-entries/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          New Journal Entry
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search entries..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            />
          </div>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showPostedOnly}
              onChange={(e) => setFilters((f) => ({ ...f, showPostedOnly: e.target.checked }))}
              className="rounded border-gray-300 text-[#52b53b] focus:ring-[#52b53b]"
            />
            <span className="text-sm text-gray-700">Posted only</span>
          </label>
        </div>
      </div>

      {/* Entries List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 sm:gap-3">
            <BookOpenIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[#52b53b]" />
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">Journal Entries</h2>
            <span className="text-xs sm:text-sm text-gray-500">
              {filteredEntries.length} entries
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f] mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading entries...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpenIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No journal entries found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredEntries.map((entry) => {
              const isExpanded = expandedEntries.has(entry.id);
              const totalDebit = entry.lines?.reduce((sum, l) => sum + (l.debit_amount || 0), 0) || 0;
              const totalCredit = entry.lines?.reduce((sum, l) => sum + (l.credit_amount || 0), 0) || 0;

              return (
                <div key={entry.id}>
                  <button
                    onClick={() => toggleEntry(entry.id)}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    {isExpanded ? (
                      <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm sm:text-base font-medium text-gray-900">
                          {entry.entry_number}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                            entry.is_posted
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          )}
                        >
                          {entry.is_posted ? 'Posted' : 'Draft'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{entry.description}</p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 tabular-nums">
                        {formatCurrency(totalDebit)}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(entry.entry_date)}</p>
                    </div>
                  </button>

                  {/* Action Buttons */}
                  <div className="px-4 sm:px-6 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                    {entry.status === 'draft' && (
                      <>
                        <Link
                          href={`/dashboard/journal-entries/${entry.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PencilIcon className="w-3 h-3" />
                          Edit
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(entry.id, entry.entry_number);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded"
                        >
                          <TrashIcon className="w-3 h-3" />
                          Delete
                        </button>
                      </>
                    )}
                    {entry.status === 'posted' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVoid(entry.id, entry.entry_number);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 rounded"
                      >
                        <XCircleIcon className="w-3 h-3" />
                        Void
                      </button>
                    )}
                    {entry.status === 'void' && (
                      <span className="text-xs text-gray-400">Voided - No actions available</span>
                    )}
                  </div>

                  {/* Expanded Lines */}
                  {isExpanded && entry.lines && entry.lines.length > 0 && (
                    <div className="px-4 sm:px-6 pb-3 sm:pb-4">
                      <div className="ml-4 sm:ml-8 bg-gray-50 rounded-lg overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-xs sm:text-sm font-medium text-gray-600">
                                Account
                              </th>
                              <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-xs sm:text-sm font-medium text-gray-600">
                                Description
                              </th>
                              <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-right text-xs sm:text-sm font-medium text-gray-600">
                                Debit
                              </th>
                              <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-right text-xs sm:text-sm font-medium text-gray-600">
                                Credit
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {entry.lines.map((line) => (
                              <tr key={line.id}>
                                <td className="px-2 sm:px-4 py-1.5 sm:py-2">
                                  <span className="font-mono text-xs text-gray-500 mr-1 sm:mr-2 block sm:inline">
                                    {line.account_code}
                                  </span>
                                  <span className="text-xs sm:text-sm">{line.account_name}</span>
                                </td>
                                <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600">{line.description}</td>
                                <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-right text-xs sm:text-sm tabular-nums">
                                  {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : ''}
                                </td>
                                <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-right text-xs sm:text-sm tabular-nums">
                                  {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-100 font-medium">
                            <tr>
                              <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm" colSpan={2}>
                                Total
                              </td>
                              <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-right text-xs sm:text-sm tabular-nums">
                                {formatCurrency(totalDebit)}
                              </td>
                              <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-right text-xs sm:text-sm tabular-nums">
                                {formatCurrency(totalCredit)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {entry.reference && (
                        <p className="ml-4 sm:ml-8 mt-2 text-xs text-gray-500">
                          Reference: {entry.reference}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


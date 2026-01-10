'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  LockClosedIcon,
  LockOpenIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface FiscalPeriod {
  id: string;
  name: string;
  level: 'annual' | 'quarterly' | 'monthly' | 'weekly' | 'daily';
  start_date: string;
  end_date: string;
  status: 'open' | 'closed' | 'locked';
  closed_by?: string;
  closed_at?: string;
}

export default function FiscalPeriodsPage() {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadPeriods();
  }, []);

  const loadPeriods = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fiscal_periods')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      setPeriods(data || []);
    } catch (error) {
      console.error('Error loading periods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClosePeriod = async (periodId: string, periodName: string) => {
    if (!confirm(`Are you sure you want to close "${periodName}"?\n\nThis will prevent any modifications to transactions dated within this period.`)) {
      return;
    }

    try {
      setActionLoading(periodId);
      const response = await fetch('/api/fiscal-periods/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_id: periodId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to close period');
      }

      await loadPeriods();
      alert(`Period "${periodName}" has been closed successfully.`);
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReopenPeriod = async (periodId: string, periodName: string) => {
    if (!confirm(`Are you sure you want to reopen "${periodName}"?\n\nThis will allow modifications to transactions within this period again.`)) {
      return;
    }

    try {
      setActionLoading(periodId);
      const response = await fetch('/api/fiscal-periods/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_id: periodId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reopen period');
      }

      await loadPeriods();
      alert(`Period "${periodName}" has been reopened successfully.`);
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="badge badge-green flex items-center gap-1">
          <LockOpenIcon className="w-4 h-4" />
          Open
        </span>;
      case 'closed':
        return <span className="badge badge-yellow flex items-center gap-1">
          <LockClosedIcon className="w-4 h-4" />
          Closed
        </span>;
      case 'locked':
        return <span className="badge badge-red flex items-center gap-1">
          <LockClosedIcon className="w-4 h-4" />
          Locked
        </span>;
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };

  const getLevelBadge = (level: string) => {
    const colors = {
      annual: 'badge-blue',
      quarterly: 'badge-purple',
      monthly: 'badge-gray',
      weekly: 'badge-gray',
      daily: 'badge-gray',
    };
    return <span className={`badge ${colors[level as keyof typeof colors]}`}>{level}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-breco-navy"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fiscal Periods</h1>
        <p className="text-gray-600 mt-1">
          Manage period locking to prevent modifications to historical financial data
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">About Period Locking</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Open</strong> - Transactions can be created and modified</li>
          <li>• <strong>Closed</strong> - No new transactions or modifications allowed (can be reopened)</li>
          <li>• <strong>Locked</strong> - Permanently closed (requires admin override)</li>
          <li>• Closing a period ensures financial statements remain unchanged after reporting</li>
        </ul>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Period Name</th>
              <th>Type</th>
              <th>Date Range</th>
              <th>Status</th>
              <th>Closed Date</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.id}>
                <td className="font-medium">{period.name}</td>
                <td>{getLevelBadge(period.level)}</td>
                <td className="whitespace-nowrap">
                  {formatDate(period.start_date)} - {formatDate(period.end_date)}
                </td>
                <td>{getStatusBadge(period.status)}</td>
                <td className="text-sm text-gray-600">
                  {period.closed_at 
                    ? formatDate(period.closed_at) 
                    : '-'
                  }
                </td>
                <td className="text-right">
                  {period.status === 'open' ? (
                    <button
                      onClick={() => handleClosePeriod(period.id, period.name)}
                      disabled={actionLoading === period.id}
                      className="btn-secondary btn-sm flex items-center gap-1 ml-auto"
                    >
                      {actionLoading === period.id ? (
                        'Closing...'
                      ) : (
                        <>
                          <LockClosedIcon className="w-4 h-4" />
                          Close Period
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReopenPeriod(period.id, period.name)}
                      disabled={actionLoading === period.id}
                      className="btn-ghost btn-sm flex items-center gap-1 ml-auto text-blue-600 hover:text-blue-700"
                    >
                      {actionLoading === period.id ? (
                        'Reopening...'
                      ) : (
                        <>
                          <LockOpenIcon className="w-4 h-4" />
                          Reopen
                        </>
                      )}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {periods.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No fiscal periods found. Create fiscal periods to start using period locking.
          </div>
        )}
      </div>
    </div>
  );
}

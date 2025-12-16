'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarIcon,
  PlusIcon,
  EnvelopeIcon,
  ClockIcon,
  DocumentTextIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  PencilIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import { formatDate } from '@/lib/utils';

interface ScheduledReport {
  id: string;
  reportType: string;
  reportName: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfQuarter?: number;
  time: string;
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
  isActive: boolean;
  createdAt: string;
  lastRun?: string;
  nextRun: string;
  runCount: number;
}

export default function ScheduledReportsPage() {
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchScheduledReports();
  }, []);

  const fetchScheduledReports = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/reports/scheduled');
      const data = await response.json();
      setSchedules(data);
    } catch (error) {
      console.error('Failed to fetch scheduled reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSchedule = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/reports/scheduled/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        await fetchScheduledReports();
      }
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) {
      return;
    }

    try {
      const response = await fetch(`/api/reports/scheduled/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchScheduledReports();
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const runNow = async (id: string) => {
    try {
      const response = await fetch(`/api/reports/scheduled/${id}/run`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Report has been queued for immediate delivery!');
      }
    } catch (error) {
      console.error('Failed to run report:', error);
    }
  };

  const getFrequencyDisplay = (schedule: ScheduledReport) => {
    const { frequency, dayOfWeek, dayOfMonth, time } = schedule;
    
    const timeStr = new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    switch (frequency) {
      case 'daily':
        return `Daily at ${timeStr}`;
      case 'weekly':
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `Weekly on ${weekdays[dayOfWeek || 0]} at ${timeStr}`;
      case 'monthly':
        return `Monthly on the ${dayOfMonth}${getOrdinalSuffix(dayOfMonth || 1)} at ${timeStr}`;
      case 'quarterly':
        return `Quarterly at ${timeStr}`;
      default:
        return frequency;
    }
  };

  const getOrdinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const getStatusBadge = (isActive: boolean, nextRun: string) => {
    if (!isActive) {
      return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Paused</span>;
    }
    
    const next = new Date(nextRun);
    const now = new Date();
    
    if (next < now) {
      return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Pending</span>;
    }
    
    return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Active</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/dashboard/reports" className="btn-ghost p-1.5 sm:p-2">
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scheduled Reports</h1>
            <p className="text-gray-600">Manage automatic report delivery schedules</p>
          </div>
        </div>
        <Link
          href="/dashboard/reports/scheduled/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Schedule Report
        </Link>
      </div>

      {/* Schedules List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-breco-navy mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading scheduled reports...</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="p-6 text-center">
            <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Scheduled Reports</h3>
            <p className="text-gray-500 mb-4">
              Get started by scheduling your first automatic report delivery.
            </p>
            <Link
              href="/dashboard/reports/scheduled/new"
              className="btn-primary inline-flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Schedule Your First Report
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Report
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipients
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Run
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {schedule.reportName}
                          </div>
                          <div className="text-sm text-gray-500 capitalize">
                            {schedule.format.toUpperCase()} Format
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {getFrequencyDisplay(schedule)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                        <div className="text-sm text-gray-900">
                          {schedule.recipients.length} recipient{schedule.recipients.length !== 1 ? 's' : ''}
                          <div className="text-xs text-gray-500">
                            {schedule.recipients.slice(0, 2).join(', ')}
                            {schedule.recipients.length > 2 && ` +${schedule.recipients.length - 2} more`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(schedule.isActive, schedule.nextRun)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {schedule.isActive ? (
                        <div>
                          <div>{formatDate(schedule.nextRun)}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(schedule.nextRun).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Paused</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSchedule(schedule.id, schedule.isActive)}
                          className={`p-1 rounded-lg ${
                            schedule.isActive
                              ? 'text-gray-600 hover:bg-gray-100'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={schedule.isActive ? 'Pause' : 'Resume'}
                        >
                          {schedule.isActive ? (
                            <PauseIcon className="w-4 h-4" />
                          ) : (
                            <PlayIcon className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => runNow(schedule.id)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Run Now"
                        >
                          <ClockIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteSchedule(schedule.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {schedules.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <CalendarIcon className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Schedules</p>
                <p className="text-2xl font-bold text-gray-900">{schedules.length}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <PlayIcon className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">
                  {schedules.filter(s => s.isActive).length}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <EnvelopeIcon className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Reports Sent</p>
                <p className="text-2xl font-bold text-gray-900">
                  {schedules.reduce((sum, s) => sum + s.runCount, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

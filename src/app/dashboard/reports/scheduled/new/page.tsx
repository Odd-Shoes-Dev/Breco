'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  CalendarIcon,
  EnvelopeIcon,
  ClockIcon,
  DocumentTextIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { formatDate } from '@/lib/utils';

interface ScheduleFormData {
  reportType: string;
  reportName: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6, Sunday = 0
  dayOfMonth?: number; // 1-31
  monthOfQuarter?: number; // 1-3
  time: string; // HH:MM format
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
  parameters: {
    startDate?: string;
    endDate?: string;
    customerType?: string;
    sortBy?: string;
  };
  isActive: boolean;
}

const reportTypes = [
  { value: 'profit-loss', label: 'Profit & Loss Statement', category: 'Financial' },
  { value: 'balance-sheet', label: 'Balance Sheet', category: 'Financial' },
  { value: 'cash-flow', label: 'Cash Flow Statement', category: 'Financial' },
  { value: 'trial-balance', label: 'Trial Balance', category: 'Financial' },
  { value: 'ar-aging', label: 'Accounts Receivable Aging', category: 'Receivables' },
  { value: 'sales-by-customer', label: 'Sales by Customer', category: 'Sales' },
  { value: 'sales-by-product', label: 'Sales by Product', category: 'Sales' },
  { value: 'ap-aging', label: 'Accounts Payable Aging', category: 'Payables' },
  { value: 'purchases-by-vendor', label: 'Purchases by Vendor', category: 'Purchases' },
  { value: 'tax-summary', label: 'Tax Summary', category: 'Tax' },
];

const frequencies = [
  { value: 'daily', label: 'Daily', description: 'Every day' },
  { value: 'weekly', label: 'Weekly', description: 'Every week' },
  { value: 'monthly', label: 'Monthly', description: 'Every month' },
  { value: 'quarterly', label: 'Quarterly', description: 'Every quarter' },
];

const weekdays = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export default function NewScheduledReportPage() {
  const [formData, setFormData] = useState<ScheduleFormData>({
    reportType: '',
    reportName: '',
    frequency: 'monthly',
    time: '09:00',
    recipients: [''],
    format: 'pdf',
    parameters: {},
    isActive: true,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleReportTypeChange = (reportType: string) => {
    const report = reportTypes.find(r => r.value === reportType);
    setFormData(prev => ({
      ...prev,
      reportType,
      reportName: report ? `${report.label} - ${prev.frequency.charAt(0).toUpperCase() + prev.frequency.slice(1)}` : '',
    }));
  };

  const handleFrequencyChange = (frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly') => {
    const report = reportTypes.find(r => r.value === formData.reportType);
    setFormData(prev => ({
      ...prev,
      frequency,
      reportName: report ? `${report.label} - ${frequency.charAt(0).toUpperCase() + frequency.slice(1)}` : '',
      dayOfWeek: frequency === 'weekly' ? 1 : undefined,
      dayOfMonth: frequency === 'monthly' ? 1 : undefined,
      monthOfQuarter: frequency === 'quarterly' ? 1 : undefined,
    }));
  };

  const addRecipient = () => {
    setFormData(prev => ({
      ...prev,
      recipients: [...prev.recipients, ''],
    }));
  };

  const removeRecipient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.filter((_, i) => i !== index),
    }));
  };

  const updateRecipient = (index: number, email: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.map((recipient, i) => i === index ? email : recipient),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/reports/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          recipients: formData.recipients.filter(email => email.trim() !== ''),
        }),
      });

      if (response.ok) {
        setShowSuccess(true);
        setTimeout(() => {
          window.location.href = '/dashboard/reports/scheduled';
        }, 2000);
      } else {
        throw new Error('Failed to create scheduled report');
      }
    } catch (error) {
      console.error('Failed to create scheduled report:', error);
      alert('Failed to create scheduled report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Schedule Created!</h2>
          <p className="text-gray-600 mb-4">Your report has been scheduled successfully.</p>
          <p className="text-sm text-gray-500">Redirecting to scheduled reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/reports/scheduled" className="btn-ghost p-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule New Report</h1>
          <p className="text-gray-600">Set up automatic report delivery to your email</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Report Selection */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Selection</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
              <select
                value={formData.reportType}
                onChange={(e) => handleReportTypeChange(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
                required
              >
                <option value="">Select a report...</option>
                {Object.entries(
                  reportTypes.reduce((acc, report) => {
                    if (!acc[report.category]) acc[report.category] = [];
                    acc[report.category].push(report);
                    return acc;
                  }, {} as Record<string, typeof reportTypes>)
                ).map(([category, reports]) => (
                  <optgroup key={category} label={category}>
                    {reports.map(report => (
                      <option key={report.value} value={report.value}>
                        {report.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Name</label>
              <input
                type="text"
                value={formData.reportName}
                onChange={(e) => setFormData(prev => ({ ...prev, reportName: e.target.value }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
                placeholder="Enter a name for this scheduled report"
                required
              />
            </div>
          </div>
        </div>

        {/* Schedule Settings */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
              <select
                value={formData.frequency}
                onChange={(e) => handleFrequencyChange(e.target.value as any)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
              >
                {frequencies.map(freq => (
                  <option key={freq.value} value={freq.value}>
                    {freq.label} - {freq.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
              />
            </div>

            {formData.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Day of Week</label>
                <select
                  value={formData.dayOfWeek || 1}
                  onChange={(e) => setFormData(prev => ({ ...prev, dayOfWeek: parseInt(e.target.value) }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
                >
                  {weekdays.map((day, index) => (
                    <option key={index} value={index}>{day}</option>
                  ))}
                </select>
              </div>
            )}

            {formData.frequency === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Day of Month</label>
                <select
                  value={formData.dayOfMonth || 1}
                  onChange={(e) => setFormData(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Email Settings */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Recipients</label>
              {formData.recipients.map((recipient, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="email"
                    value={recipient}
                    onChange={(e) => updateRecipient(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
                    placeholder="Enter email address"
                    required={index === 0}
                  />
                  {formData.recipients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRecipient(index)}
                      className="px-3 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addRecipient}
                className="text-sm text-breco-navy font-medium hover:underline"
              >
                + Add another recipient
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
              <select
                value={formData.format}
                onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value as any }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
              >
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
                <option value="csv">CSV</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link
            href="/dashboard/reports/scheduled"
            className="btn-ghost px-6 py-2"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary px-6 py-2 disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Schedule'}
          </button>
        </div>
      </form>
    </div>
  );
}

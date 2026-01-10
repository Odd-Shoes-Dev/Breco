'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

type SalesPeriod = 'daily' | 'weekly' | 'monthly';

export default function RecordCafeSalesPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    period: 'daily' as SalesPeriod,
    food_sales: 0,
    beverage_sales: 0,
    catering_sales: 0,
    payment_method: 'cash',
    notes: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const totalSales = formData.food_sales + formData.beverage_sales + formData.catering_sales;
      
      if (totalSales <= 0) {
        setError('Please enter at least one sales amount');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch('/api/cafe/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          total: totalSales,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to record sales');
      }

      router.push('/dashboard/cafe');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const totalSales = formData.food_sales + formData.beverage_sales + formData.catering_sales;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/cafe"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Record Cafe Sales</h1>
          <p className="text-gray-600">Enter daily, weekly, or monthly revenue</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <BanknotesIcon className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-gray-900">Sales Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sale Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="sale_date"
                value={formData.sale_date}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period <span className="text-red-500">*</span>
              </label>
              <select
                name="period"
                value={formData.period}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="daily">Daily Sales</option>
                <option value="weekly">Weekly Sales</option>
                <option value="monthly">Monthly Sales</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Food Sales (USD)
              </label>
              <input
                type="number"
                name="food_sales"
                value={formData.food_sales}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beverage Sales (USD)
              </label>
              <input
                type="number"
                name="beverage_sales"
                value={formData.beverage_sales}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catering Sales (USD)
              </label>
              <input
                type="number"
                name="catering_sales"
                value={formData.catering_sales}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                name="payment_method"
                value={formData.payment_method}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit_card">Credit Card</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="Additional notes about these sales..."
              />
            </div>
          </div>

          {/* Total Display */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total Sales</span>
              <span className="text-2xl font-bold text-green-600">
                ${totalSales.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Link
            href="/dashboard/cafe"
            className="btn-secondary"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || totalSales <= 0}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Recording...' : 'Record Sales'}
          </button>
        </div>
      </form>
    </div>
  );
}

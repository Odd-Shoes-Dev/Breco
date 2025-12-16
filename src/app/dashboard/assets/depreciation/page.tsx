'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CalendarIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface Asset {
  id: string;
  name: string;
  asset_number: string;
  purchase_price: number;
  accumulated_depreciation: number;
  book_value: number;
  useful_life_months: number;
  depreciation_method: string;
  depreciation_start_date: string;
  currency: string;
}

export default function DepreciationPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fixed_assets')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyDepreciation = (asset: Asset) => {
    if (asset.depreciation_method === 'straight_line') {
      const depreciableAmount = asset.purchase_price - 0; // residual value
      return depreciableAmount / asset.useful_life_months;
    }
    return 0;
  };

  const runDepreciation = async () => {
    if (!confirm(`Run depreciation for ${selectedMonth}? This will create depreciation entries for all active assets.`)) {
      return;
    }

    setProcessing(true);
    setSuccess(false);

    try {
      const depreciationDate = `${selectedMonth}-01`;
      
      for (const asset of assets) {
        const monthlyDepreciation = calculateMonthlyDepreciation(asset);
        
        if (monthlyDepreciation > 0) {
          // Update accumulated depreciation
          const newAccumulatedDepreciation = asset.accumulated_depreciation + monthlyDepreciation;
          
          await supabase
            .from('fixed_assets')
            .update({
              accumulated_depreciation: newAccumulatedDepreciation,
            })
            .eq('id', asset.id);

          // Create depreciation entry
          await supabase
            .from('depreciation_entries')
            .insert({
              asset_id: asset.id,
              depreciation_date: depreciationDate,
              amount: monthlyDepreciation,
            });
        }
      }

      setSuccess(true);
      await loadAssets(); // Reload to show updated values
    } catch (error) {
      console.error('Failed to run depreciation:', error);
      alert('Failed to run depreciation. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return currencyFormatter(amount, currency as any);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/assets" className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Run Depreciation</h1>
            <p className="text-gray-500 mt-1">Calculate and record monthly depreciation</p>
          </div>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-6 h-6 text-green-500" />
            <div>
              <h3 className="text-sm font-semibold text-green-800">Depreciation Run Complete</h3>
              <p className="text-sm text-green-600 mt-1">
                Successfully processed depreciation for {assets.length} asset(s)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Depreciation Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CalendarIcon className="w-4 h-4 inline mr-1" />
              Depreciation Period
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Assets to Process</p>
            <p className="text-2xl font-bold text-gray-900">{assets.length}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Depreciation</p>
            <p className="text-sm text-gray-500">(in asset currencies)</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={runDepreciation}
            disabled={processing || loading || assets.length === 0}
            className="btn-primary inline-flex items-center gap-2"
          >
            <ArrowPathIcon className={`w-5 h-5 ${processing ? 'animate-spin' : ''}`} />
            {processing ? 'Processing...' : 'Run Depreciation'}
          </button>
        </div>
      </div>

      {/* Assets Preview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Assets to Depreciate</h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-breco-navy"></div>
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No active assets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Asset
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accumulated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Book Value
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monthly Depreciation
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{asset.name}</p>
                        <p className="text-xs text-gray-500">{asset.asset_number}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      {formatCurrency(asset.purchase_price, asset.currency)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-red-600">
                      {formatCurrency(asset.accumulated_depreciation, asset.currency)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(asset.book_value, asset.currency)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-orange-600">
                      {formatCurrency(calculateMonthlyDepreciation(asset), asset.currency)}
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


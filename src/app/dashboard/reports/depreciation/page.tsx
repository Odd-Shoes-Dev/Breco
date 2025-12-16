'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BuildingOfficeIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ClockIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface AssetDepreciation {
  assetId: string;
  assetNumber: string;
  assetName: string;
  category: string;
  purchaseDate: string;
  purchasePrice: number;
  depreciationMethod: string;
  usefulLifeMonths: number;
  residualValue: number;
  currentBookValue: number;
  accumulatedDepreciation: number;
  annualDepreciation: number;
  monthlyDepreciation: number;
  remainingLifeMonths: number;
  status: string;
  location: string;
  depreciationSchedule?: Array<{
    year: number;
    beginningValue: number;
    depreciation: number;
    accumulatedDepreciation: number;
    endingValue: number;
  }>;
}

interface DepreciationData {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalAssets: number;
    totalOriginalCost: number;
    totalCurrentValue: number;
    totalAccumulatedDepreciation: number;
    monthlyDepreciationExpense: number;
    annualDepreciationExpense: number;
  };
  assets: AssetDepreciation[];
  byCategory: Record<string, {
    count: number;
    cost: number;
    accumulated: number;
    bookValue: number;
  }>;
}

export default function DepreciationSchedulePage() {
  const [data, setData] = useState<DepreciationData | null>(null);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('purchaseDate');
  const [isLoading, setIsLoading] = useState(false);
  const [showSchedule, setShowSchedule] = useState<string | null>(null);

  const fetchDepreciationData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/depreciation?startDate=${startDate}&endDate=${endDate}&category=${category}&sortBy=${sortBy}`
      );
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch depreciation data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepreciationData();
  }, [startDate, endDate, category, sortBy]);

  const exportToPDF = async () => {
    if (!data) return;

    try {
      // Open the export API route in a new window
      const url = `/api/reports/depreciation/export?data=${encodeURIComponent(JSON.stringify(data))}`;
      const printWindow = window.open(url, '_blank');
      
      if (printWindow) {
        // Wait for the page to load before triggering print
        printWindow.addEventListener('load', () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        });
      }
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  const getAssetTypeColor = (type: string) => {
    switch (type) {
      case 'Equipment':
        return 'text-blue-600 bg-blue-50';
      case 'Furniture':
        return 'text-green-600 bg-green-50';
      case 'Vehicle':
        return 'text-red-600 bg-red-50';
      case 'Building':
        return 'text-purple-600 bg-purple-50';
      case 'Technology':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getDepreciationMethodColor = (method: string) => {
    switch (method) {
      case 'Straight-line':
        return 'text-blue-600 bg-blue-50';
      case 'Declining Balance':
        return 'text-orange-600 bg-orange-50';
      case 'Units of Production':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/dashboard/reports" className="btn-ghost p-1.5 sm:p-2">
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Asset Depreciation Schedule</h1>
            <p className="text-sm sm:text-base text-gray-600">Track asset depreciation and book values</p>
          </div>
        </div>
        <button
          onClick={exportToPDF}
          disabled={!data}
          className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownTrayIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Export PDF</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Asset Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="all">All Categories</option>
              <option value="Equipment">Equipment</option>
              <option value="Furniture">Furniture</option>
              <option value="Vehicle">Vehicle</option>
              <option value="Building">Building</option>
              <option value="Technology">Technology</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="purchaseDate">Purchase Date</option>
              <option value="assetName">Asset Name</option>
              <option value="category">Asset Category</option>
              <option value="purchasePrice">Original Cost</option>
              <option value="bookValue">Book Value</option>
              <option value="annualDepreciation">Annual Depreciation</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchDepreciationData}
              disabled={isLoading}
              className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-breco-navy text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-breco-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Refresh Report'}
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-breco-navy mx-auto"></div>
          <p className="text-gray-500 mt-4 text-sm sm:text-base">Loading depreciation data...</p>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <BuildingOfficeIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Assets</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{data?.summary?.totalAssets || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CurrencyDollarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Original Cost</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.totalOriginalCost || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ChartBarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Book Value</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.totalCurrentValue || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ClockIcon className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Accumulated</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.totalAccumulatedDepreciation || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CalendarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Annual Dep.</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.annualDepreciationExpense || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CogIcon className="w-6 h-6 sm:w-8 sm:h-8 text-gray-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Monthly Dep.</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(data?.summary?.monthlyDepreciationExpense || 0)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Asset Type Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-4">Asset Category Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {Object.entries(data?.byCategory || {}).map(([category, stats]) => {
                const colorMap: Record<string, string> = {
                  'Equipment': 'blue',
                  'Furniture': 'green',
                  'Vehicle': 'red',
                  'Building': 'purple',
                  'Technology': 'orange'
                };
                const color = colorMap[category] || 'gray';
                
                return (
                  <div key={category} className={`text-center p-4 rounded-lg bg-${color}-50 border border-${color}-200`}>
                    <BuildingOfficeIcon className={`w-8 h-8 text-${color}-500 mx-auto mb-2`} />
                    <p className={`text-sm font-medium text-${color}-600`}>{category}</p>
                    <p className={`text-lg font-bold text-${color}-700`}>{stats.count}</p>
                    <p className={`text-sm text-${color}-600`}>{formatCurrency(stats.bookValue)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Assets Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <BuildingOfficeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Asset Depreciation Details</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Asset Name
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Purchase Date
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Original Cost
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Accumulated Dep.
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Book Value
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Annual Dep.
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.assets?.length || 0) === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">
                        No assets found for the selected period
                      </td>
                    </tr>
                  ) : (
                    (data?.assets || []).map((asset) => (
                      <tr key={asset.assetId} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">{asset.assetName}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={cn(
                            'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                            getAssetTypeColor(asset.category)
                          )}>
                            {asset.category}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={cn(
                            'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                            getDepreciationMethodColor(asset.depreciationMethod)
                          )}>
                            {asset.depreciationMethod}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700">
                          {formatDate(asset.purchaseDate)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-medium text-gray-900">
                          {formatCurrency(asset.purchasePrice)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-red-600">
                          {formatCurrency(asset.accumulatedDepreciation)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-medium text-gray-900">
                          {formatCurrency(asset.currentBookValue)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-700">
                          {formatCurrency(asset.annualDepreciation)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                          <button
                            onClick={() => setShowSchedule(showSchedule === asset.assetId ? null : asset.assetId)}
                            className="text-breco-navy hover:text-breco-navy/80 text-xs font-medium"
                          >
                            Schedule
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Depreciation Schedule Detail Modal */}
          {showSchedule && data?.assets && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-auto">
                <div className="p-6">
                  {(() => {
                    const asset = data.assets.find(a => a.assetId === showSchedule);
                    if (!asset) return null;
                    
                    return (
                      <>
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{asset.assetName}</h3>
                            <p className="text-sm text-gray-600">Depreciation Schedule</p>
                          </div>
                          <button
                            onClick={() => setShowSchedule(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Purchase Price</p>
                            <p className="text-sm font-semibold text-gray-900">{formatCurrency(asset.purchasePrice)}</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Useful Life</p>
                            <p className="text-sm font-semibold text-gray-900">{(asset.usefulLifeMonths / 12).toFixed(1)} years</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Salvage Value</p>
                            <p className="text-sm font-semibold text-gray-900">{formatCurrency(asset.residualValue)}</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Method</p>
                            <p className="text-sm font-semibold text-gray-900">{asset.depreciationMethod}</p>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Beginning Value</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Depreciation</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Accumulated Dep.</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ending Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {asset.depreciationSchedule?.map((schedule: any, index: number) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm text-gray-900">{schedule.year}</td>
                                  <td className="px-4 py-2 text-sm text-right tabular-nums text-gray-900">{formatCurrency(schedule.beginningValue)}</td>
                                  <td className="px-4 py-2 text-sm text-right tabular-nums text-red-600">{formatCurrency(schedule.depreciation)}</td>
                                  <td className="px-4 py-2 text-sm text-right tabular-nums text-red-600">{formatCurrency(schedule.accumulatedDepreciation)}</td>
                                  <td className="px-4 py-2 text-sm text-right tabular-nums text-gray-900">{formatCurrency(schedule.endingValue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <BuildingOfficeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-sm sm:text-base">Loading depreciation data...</p>
        </div>
      )}
    </div>
  );
}

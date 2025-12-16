'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  ArrowLeftIcon,
  BuildingLibraryIcon,
  PrinterIcon,
  PencilIcon,
  TrashIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase/client';

interface FixedAsset {
  id: string;
  asset_number: string;
  name: string;
  description: string | null;
  category_id: string | null;
  purchase_date: string;
  purchase_price: number;
  vendor_id: string | null;
  serial_number: string | null;
  depreciation_method: string;
  useful_life_months: number;
  residual_value: number;
  depreciation_start_date: string;
  accumulated_depreciation: number;
  book_value: number;
  status: string;
  disposal_date: string | null;
  disposal_price: number | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  asset_categories?: {
    name: string;
  };
  vendors?: {
    name: string;
  };
}

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [asset, setAsset] = useState<FixedAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadAssetDetails();
    }
  }, [params.id]);

  const loadAssetDetails = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('fixed_assets')
        .select(`
          *,
          asset_categories (name),
          vendors (name)
        `)
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setAsset(data);
    } catch (error) {
      console.error('Failed to load asset:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return currencyFormatter(num, 'USD');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'disposed':
        return 'bg-red-100 text-red-800';
      case 'fully_depreciated':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDepreciationMethodLabel = (method: string) => {
    switch (method) {
      case 'straight_line':
        return 'Straight Line';
      case 'reducing_balance':
        return 'Reducing Balance';
      case 'units_of_production':
        return 'Units of Production';
      default:
        return method;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = async () => {
    if (!confirm('Permanently delete this asset? This action cannot be undone.')) return;
    
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('fixed_assets')
        .delete()
        .eq('id', params.id);

      if (error) throw error;

      router.push('/dashboard/assets');
    } catch (error: any) {
      console.error('Failed to delete asset:', error);
      alert(error.message || 'Failed to delete asset');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-breco-navy"></div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Asset not found</p>
        <Link href="/dashboard/assets" className="btn-primary mt-4">
          Back to Assets
        </Link>
      </div>
    );
  }

  const depreciationRate = asset.useful_life_months > 0 
    ? ((asset.purchase_price - asset.residual_value) / asset.useful_life_months) 
    : 0;

  const monthsUsed = Math.floor(
    (new Date().getTime() - new Date(asset.depreciation_start_date).getTime()) 
    / (1000 * 60 * 60 * 24 * 30)
  );

  const remainingLife = Math.max(0, asset.useful_life_months - monthsUsed);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/assets"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Asset #: {asset.asset_number}</h1>
            <p className="text-gray-600">Asset Details</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="btn-secondary">
            <PrinterIcon className="w-5 h-5 mr-2" />
            Print
          </button>
          
          <Link 
            href={`/dashboard/assets/${params.id}/edit`}
            className="btn-secondary inline-flex items-center"
          >
            <PencilIcon className="w-5 h-5 mr-2" />
            Edit
          </Link>
          
          <button 
            onClick={handleDelete} 
            disabled={actionLoading}
            className="btn-secondary text-red-600 hover:bg-red-50"
          >
            <TrashIcon className="w-5 h-5 mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Asset Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BuildingLibraryIcon className="w-8 h-8 text-breco-navy" />
                <h2 className="text-3xl font-bold text-gray-900">{asset.name}</h2>
              </div>
              <p className="text-gray-600">Asset #: {asset.asset_number}</p>
              {asset.serial_number && (
                <p className="text-gray-600">Serial: {asset.serial_number}</p>
              )}
            </div>
            <div className="text-right">
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(asset.status)}`}>
                {asset.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Main Details */}
        <div className="grid md:grid-cols-2 gap-6 p-6 border-b border-gray-200">
          {/* Asset Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <TagIcon className="w-4 h-4" />
              ASSET INFORMATION
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Category:</span>
                <span className="font-medium text-gray-900">
                  {asset.asset_categories?.name || 'Uncategorized'}
                </span>
              </div>
              {asset.location && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Location:</span>
                  <span className="font-medium text-gray-900">{asset.location}</span>
                </div>
              )}
              {asset.vendors?.name && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Vendor:</span>
                  <span className="font-medium text-gray-900">{asset.vendors.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Purchase Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              PURCHASE DETAILS
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Purchase Date:</span>
                <span className="font-medium text-gray-900">{formatDate(asset.purchase_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Purchase Price:</span>
                <span className="font-medium text-gray-900">{formatCurrency(asset.purchase_price)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {asset.description && (
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">DESCRIPTION</h3>
            <p className="text-gray-900">{asset.description}</p>
          </div>
        )}

        {/* Depreciation Details */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <ChartBarIcon className="w-4 h-4" />
            DEPRECIATION DETAILS
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Method</p>
              <p className="font-medium text-gray-900">{getDepreciationMethodLabel(asset.depreciation_method)}</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Useful Life</p>
              <p className="font-medium text-gray-900">{asset.useful_life_months} months</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Residual Value</p>
              <p className="font-medium text-gray-900">{formatCurrency(asset.residual_value)}</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Start Date</p>
              <p className="font-medium text-gray-900">{formatDate(asset.depreciation_start_date)}</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Monthly Depreciation</p>
              <p className="font-medium text-gray-900">{formatCurrency(depreciationRate)}</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Remaining Life</p>
              <p className="font-medium text-gray-900">{remainingLife} months</p>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-6 bg-gray-50">
          <div className="flex justify-end">
            <div className="w-full md:w-96 space-y-3">
              <div className="flex justify-between text-gray-700">
                <span>Purchase Price</span>
                <span className="font-medium">{formatCurrency(asset.purchase_price)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Accumulated Depreciation</span>
                <span className="font-medium text-red-600">-{formatCurrency(asset.accumulated_depreciation)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t-2 border-gray-300">
                <span className="font-bold text-gray-900 text-lg">Book Value</span>
                <span className="font-bold text-gray-900 text-2xl">
                  {formatCurrency(asset.book_value)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Disposal Information */}
        {asset.disposal_date && (
          <div className="p-6 border-t border-gray-200 bg-red-50">
            <h3 className="text-sm font-semibold text-red-800 mb-3">DISPOSAL INFORMATION</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-red-600 mb-1">Disposal Date</p>
                <p className="font-medium text-red-900">{formatDate(asset.disposal_date)}</p>
              </div>
              {asset.disposal_price !== null && (
                <div>
                  <p className="text-xs text-red-600 mb-1">Disposal Price</p>
                  <p className="font-medium text-red-900">{formatCurrency(asset.disposal_price)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {asset.notes && (
          <div className="p-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">NOTES</h3>
            <p className="text-gray-600 whitespace-pre-line">{asset.notes}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">
            <p>Created: {new Date(asset.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

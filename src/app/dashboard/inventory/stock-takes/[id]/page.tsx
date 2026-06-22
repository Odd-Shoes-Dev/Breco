'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  CheckIcon,
  XMarkIcon,
  PencilIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';

interface StockTake {
  id: string;
  reference_number: string;
  stock_take_date: string;
  location_id: string;
  type: string;
  status: string;
  counted_by: string;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  inventory_locations: {
    id: string;
    name: string;
    type: string;
  };
  user_profiles: {
    full_name: string;
  };
}

interface StockTakeLine {
  id: string;
  product_id: string;
  expected_quantity: number;
  counted_quantity: number;
  variance: number;
  notes: string | null;
  products: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
}

export default async function StockTakeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StockTakeDetailPageClient stockTakeId={id} />;
}

function StockTakeDetailPageClient({ stockTakeId }: { stockTakeId: string }) {
  const router = useRouter();
  const [stockTake, setStockTake] = useState<StockTake | null>(null);
  const [lines, setLines] = useState<StockTakeLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadStockTake();
  }, [stockTakeId]);

  const loadStockTake = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/stock-takes/${stockTakeId}`);
      if (!res.ok) throw new Error('Failed to load stock take');
      const result = await res.json();
      setStockTake(result.stockTake || result);
      setLines(result.lines || []);
    } catch (error) {
      console.error('Failed to load stock take:', error);
      toast.error('Failed to load stock take');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm('Approve this stock take? This will update inventory quantities.')) return;

    try {
      setUpdating(true);
      const res = await fetch(`/api/stock-takes/${stockTakeId}/approve`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to approve stock take');
      }
      toast.success('Stock take approved and inventory updated');
      loadStockTake();
    } catch (error: any) {
      console.error('Error approving stock take:', error);
      toast.error(error.message || 'Failed to approve stock take');
    } finally {
      setUpdating(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('Reject this stock take? This will mark it as cancelled.')) return;

    try {
      setUpdating(true);
      const res = await fetch(`/api/stock-takes/${stockTakeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      toast.success('Stock take rejected');
      loadStockTake();
    } catch (error: any) {
      console.error('Error rejecting stock take:', error);
      toast.error(error.message || 'Failed to reject stock take');
    } finally {
      setUpdating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stockTake) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Stock take not found</p>
      </div>
    );
  }

  const totalVariance = lines.reduce((sum, line) => sum + Math.abs(line.variance), 0);
  const varianceLines = lines.filter((line) => line.variance !== 0).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{stockTake.reference_number}</h1>
            <p className="text-gray-500 mt-1">Stock Take Details</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <PrinterIcon className="w-5 h-5" />
            Print
          </button>
          {stockTake.status === 'draft' && (
            <>
              <button
                onClick={() => router.push(`/dashboard/inventory/stock-takes/${stockTakeId}/edit`)}
                className="btn-secondary flex items-center gap-2"
              >
                <PencilIcon className="w-5 h-5" />
                Edit
              </button>
              <button
                onClick={handleReject}
                className="btn-secondary text-red-600 flex items-center gap-2"
                disabled={updating}
              >
                <XMarkIcon className="w-5 h-5" />
                Reject
              </button>
              <button
                onClick={handleApprove}
                className="btn-primary flex items-center gap-2"
                disabled={updating}
              >
                <CheckIcon className="w-5 h-5" />
                {updating ? 'Approving...' : 'Approve'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4 print:hidden">
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            stockTake.status === 'completed'
              ? 'bg-green-100 text-green-800'
              : stockTake.status === 'cancelled'
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {stockTake.status.toUpperCase()}
        </span>
        {stockTake.status === 'completed' && stockTake.approved_at && (
          <span className="text-sm text-gray-600">
            Approved on {new Date(stockTake.approved_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-600">Total Products</div>
            <div className="text-2xl font-bold text-gray-900">{lines.length}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-600">With Variance</div>
            <div className="text-2xl font-bold text-orange-600">{varianceLines}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-600">Total Variance</div>
            <div className={`text-2xl font-bold ${totalVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {totalVariance.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-600">Accuracy</div>
            <div className="text-2xl font-bold text-blue-600">
              {((1 - varianceLines / lines.length) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Stock Take Details */}
      <div className="card">
        <div className="card-body">
          <h2 className="text-lg font-semibold mb-4">Details</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-gray-600">Reference Number</label>
              <p className="font-medium">{stockTake.reference_number}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Stock Take Date</label>
              <p className="font-medium">
                {new Date(stockTake.stock_take_date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Location</label>
              <p className="font-medium">
                {stockTake.inventory_locations.name} ({stockTake.inventory_locations.type})
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Type</label>
              <p className="font-medium capitalize">{stockTake.type}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Counted By</label>
              <p className="font-medium">{stockTake.user_profiles.full_name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Created Date</label>
              <p className="font-medium">
                {new Date(stockTake.created_at).toLocaleDateString()}
              </p>
            </div>
            {stockTake.notes && (
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">Notes</label>
                <p className="font-medium">{stockTake.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Count Lines */}
      <div className="card">
        <div className="card-body">
          <h2 className="text-lg font-semibold mb-4">Count Details</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Expected</th>
                  <th>Counted</th>
                  <th>Variance</th>
                  <th>% Diff</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const percentDiff =
                    line.expected_quantity > 0
                      ? ((line.variance / line.expected_quantity) * 100).toFixed(1)
                      : '0';
                  return (
                    <tr key={line.id} className={line.variance !== 0 ? 'bg-yellow-50' : ''}>
                      <td className="font-medium">{line.products.name}</td>
                      <td className="text-sm text-gray-600">{line.products.sku}</td>
                      <td>
                        {line.expected_quantity} {line.products.unit}
                      </td>
                      <td>
                        {line.counted_quantity} {line.products.unit}
                      </td>
                      <td>
                        <span
                          className={`font-medium ${
                            line.variance > 0
                              ? 'text-green-600'
                              : line.variance < 0
                              ? 'text-red-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {line.variance > 0 ? '+' : ''}
                          {line.variance}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`font-medium ${
                            parseFloat(percentDiff) > 0
                              ? 'text-green-600'
                              : parseFloat(percentDiff) < 0
                              ? 'text-red-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {parseFloat(percentDiff) > 0 ? '+' : ''}
                          {percentDiff}%
                        </span>
                      </td>
                      <td className="text-sm text-gray-600">{line.notes || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block,
          .print\\:block * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

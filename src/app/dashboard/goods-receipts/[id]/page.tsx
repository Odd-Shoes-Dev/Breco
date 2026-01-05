'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';

interface GoodsReceipt {
  id: string;
  gr_number: string;
  received_date: string;
  status: string;
  notes: string | null;
  inspection_notes: string | null;
  purchase_orders: {
    po_number: string;
    vendors: {
      name: string;
      company_name: string | null;
    };
  };
}

interface GRLine {
  id: string;
  description: string;
  quantity_received: number;
  unit_cost: number;
  line_total: number;
  purchase_order_lines: {
    quantity_ordered: number;
    quantity_received: number;
  };
}

export default async function GoodsReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GoodsReceiptDetailPageClient grId={id} />;
}

function GoodsReceiptDetailPageClient({ grId }: { grId: string }) {
  const router = useRouter();
  const [goodsReceipt, setGoodsReceipt] = useState<GoodsReceipt | null>(null);
  const [lines, setLines] = useState<GRLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [inspectionNotes, setInspectionNotes] = useState('');

  useEffect(() => {
    loadGoodsReceipt();
  }, [grId]);

  const loadGoodsReceipt = async () => {
    try {
      setLoading(true);

      const { data: grData, error: grError } = await supabase
        .from('goods_receipts')
        .select(`
          *,
          purchase_orders (
            po_number,
            vendors (
              name,
              company_name
            )
          )
        `)
        .eq('id', grId)
        .single();

      if (grError) throw grError;
      setGoodsReceipt(grData);
      setInspectionNotes(grData.inspection_notes || '');

      const { data: linesData, error: linesError } = await supabase
        .from('goods_receipt_lines')
        .select(`
          *,
          purchase_order_lines (
            quantity_ordered,
            quantity_received
          )
        `)
        .eq('goods_receipt_id', grId)
        .order('id');

      if (linesError) throw linesError;
      setLines(linesData || []);
    } catch (error) {
      console.error('Failed to load goods receipt:', error);
      toast.error('Failed to load goods receipt');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: 'inspected' | 'accepted' | 'rejected' | 'returned') => {
    if (!goodsReceipt) return;

    try {
      setUpdating(true);

      const response = await fetch(`/api/goods-receipts/${grId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          inspection_notes: inspectionNotes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update status');
      }

      toast.success(`Goods receipt ${newStatus}`);
      loadGoodsReceipt();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(error.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!goodsReceipt) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Goods receipt not found</p>
        <Link href="/dashboard/goods-receipts" className="btn-primary mt-4">
          Back to Goods Receipts
        </Link>
      </div>
    );
  }

  const total = lines.reduce((sum, line) => sum + line.line_total, 0);

  const statusColor: Record<string, string> = {
    received: 'bg-blue-100 text-blue-800',
    inspected: 'bg-yellow-100 text-yellow-800',
    accepted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    returned: 'bg-gray-100 text-gray-800',
  };

  const canInspect = goodsReceipt.status === 'received';
  const canAccept = goodsReceipt.status === 'inspected' || goodsReceipt.status === 'received';
  const canReject = goodsReceipt.status === 'inspected' || goodsReceipt.status === 'received';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/goods-receipts" className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{goodsReceipt.gr_number}</h1>
            <p className="text-gray-500 mt-1">
              PO: {goodsReceipt.purchase_orders.po_number}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor[goodsReceipt.status]}`}>
            {goodsReceipt.status.charAt(0).toUpperCase() + goodsReceipt.status.slice(1)}
          </span>
          <button className="btn-secondary flex items-center gap-2">
            <PrinterIcon className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Receipt Details</h2>
        </div>
        <div className="card-body">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Vendor</h3>
              <p className="mt-1">
                {goodsReceipt.purchase_orders.vendors.company_name ||
                  goodsReceipt.purchase_orders.vendors.name}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500">Received Date</h3>
              <p className="mt-1">
                {new Date(goodsReceipt.received_date).toLocaleDateString()}
              </p>
            </div>

            {goodsReceipt.notes && (
              <div className="md:col-span-2">
                <h3 className="text-sm font-medium text-gray-500">Delivery Notes</h3>
                <p className="mt-1 text-gray-700">{goodsReceipt.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Received Items</h2>
        </div>
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="text-right">Ordered</th>
                  <th className="text-right">Received Now</th>
                  <th className="text-right">Unit Cost</th>
                  <th className="text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.description}</td>
                    <td className="text-right">{line.purchase_order_lines.quantity_ordered}</td>
                    <td className="text-right">{line.quantity_received}</td>
                    <td className="text-right">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(line.unit_cost)}
                    </td>
                    <td className="text-right">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(line.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="text-right font-semibold">
                    Total:
                  </td>
                  <td className="text-right font-semibold">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Inspection Section */}
      {canInspect && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Inspection</h2>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="label">Inspection Notes</label>
              <textarea
                value={inspectionNotes}
                onChange={(e) => setInspectionNotes(e.target.value)}
                className="input"
                rows={4}
                placeholder="Document condition, damages, discrepancies..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => updateStatus('inspected')}
                disabled={updating}
                className="btn-primary flex items-center gap-2"
              >
                <CheckCircleIcon className="w-4 h-4" />
                Mark as Inspected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Acceptance Section */}
      {goodsReceipt.status !== 'received' && goodsReceipt.inspection_notes && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Inspection Notes</h2>
          </div>
          <div className="card-body">
            <p className="text-gray-700 whitespace-pre-wrap">{goodsReceipt.inspection_notes}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      {(canAccept || canReject) && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Actions</h2>
          </div>
          <div className="card-body">
            <p className="text-gray-600 mb-4">
              Accept the goods to update inventory, or reject/return if there are issues.
            </p>
            <div className="flex gap-3">
              {canAccept && (
                <button
                  onClick={() => {
                    if (confirm('Accept these goods? Inventory will be updated.')) {
                      updateStatus('accepted');
                    }
                  }}
                  disabled={updating}
                  className="btn-primary flex items-center gap-2"
                >
                  <CheckCircleIcon className="w-4 h-4" />
                  Accept Goods
                </button>
              )}

              {canReject && (
                <button
                  onClick={() => {
                    if (confirm('Reject these goods? They will NOT be added to inventory.')) {
                      updateStatus('rejected');
                    }
                  }}
                  disabled={updating}
                  className="btn-secondary text-red-600 border-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <XCircleIcon className="w-4 h-4" />
                  Reject Goods
                </button>
              )}

              {canReject && (
                <button
                  onClick={() => {
                    if (confirm('Mark for return to vendor?')) {
                      updateStatus('returned');
                    }
                  }}
                  disabled={updating}
                  className="btn-secondary flex items-center gap-2"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Return to Vendor
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PrinterIcon,
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

interface PurchaseOrder {
  id: string;
  po_number: string;
  order_date: string;
  expected_date: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  currency: string;
  status: string;
  shipping_address: string | null;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  received_date: string | null;
  vendors?: {
    id: string;
    name: string;
    company_name: string | null;
    email: string;
    phone: string | null;
  };
}

interface POLine {
  id: string;
  line_number: number;
  description: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  line_total: number;
  products?: {
    name: string;
    sku: string | null;
  } | null;
}

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [lines, setLines] = useState<POLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadPO();
  }, [params.id]);

  const loadPO = async () => {
    try {
      setLoading(true);
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (
            id,
            name,
            company_name,
            email,
            phone
          )
        `)
        .eq('id', params.id)
        .single();

      if (poError) throw poError;
      setPO(poData);

      const { data: linesData, error: linesError } = await supabase
        .from('purchase_order_lines')
        .select(`
          *,
          products (
            name,
            sku
          )
        `)
        .eq('purchase_order_id', params.id)
        .order('line_number');

      if (linesError) throw linesError;
      setLines(linesData || []);
    } catch (error) {
      console.error('Failed to load PO:', error);
      toast.error('Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm('Approve this purchase order?')) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/purchase-orders/${params.id}/approve`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve');
      }

      toast.success('Purchase order approved');
      loadPO();
    } catch (error: any) {
      console.error('Error approving PO:', error);
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this purchase order? This action cannot be undone.')) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/purchase-orders/${params.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel');
      }

      toast.success('Purchase order cancelled');
      router.push('/dashboard/purchase-orders');
    } catch (error: any) {
      console.error('Error cancelling PO:', error);
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceiveGoods = () => {
    router.push(`/dashboard/goods-receipts/new?po_id=${params.id}`);
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, po?.currency as any || 'USD');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      draft: 'badge-gray',
      sent: 'badge-info',
      approved: 'badge-success',
      partial: 'badge-warning',
      received: 'badge-success',
      cancelled: 'badge-error',
    };
    return badges[status] || 'badge-gray';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-breco-navy"></div>
      </div>
    );
  }

  if (!po) {
    return <div>Purchase order not found</div>;
  }

  const canApprove = po.status === 'draft' || po.status === 'sent';
  const canReceive = po.status === 'approved' || po.status === 'partial';
  const canEdit = po.status === 'draft';
  const canCancel = po.status !== 'received' && po.status !== 'cancelled';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/purchase-orders" className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Purchase Order {po.po_number}
            </h1>
            <p className="text-gray-500 mt-1">{po.vendors?.company_name || po.vendors?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary">
            <PrinterIcon className="w-5 h-5 mr-2" />
            Print
          </button>
          {canEdit && (
            <Link 
              href={`/dashboard/purchase-orders/${params.id}/edit`}
              className="btn-secondary"
            >
              <PencilIcon className="w-5 h-5 mr-2" />
              Edit
            </Link>
          )}
          {canReceive && (
            <button onClick={handleReceiveGoods} className="btn-primary">
              <TruckIcon className="w-5 h-5 mr-2" />
              Receive Goods
            </button>
          )}
          {canApprove && (
            <button 
              onClick={handleApprove} 
              disabled={actionLoading}
              className="btn-primary"
            >
              <CheckCircleIcon className="w-5 h-5 mr-2" />
              Approve
            </button>
          )}
          {canCancel && (
            <button 
              onClick={handleCancel}
              disabled={actionLoading}
              className="btn-secondary text-red-600 hover:bg-red-50"
            >
              <XCircleIcon className="w-5 h-5 mr-2" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(po.status)}`}>
              {po.status.toUpperCase()}
            </span>
          </div>
          {po.approved_at && (
            <div className="text-sm text-gray-500">
              Approved on {formatDate(po.approved_at)}
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Order Information</h2>
        </div>
        <div className="card-body">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">Vendor Details</h3>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">{po.vendors?.company_name || po.vendors?.name}</span>
                </p>
                {po.vendors?.email && (
                  <p className="text-sm text-gray-600">{po.vendors.email}</p>
                )}
                {po.vendors?.phone && (
                  <p className="text-sm text-gray-600">{po.vendors.phone}</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">Order Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Order Date:</span>
                  <span className="font-medium">{formatDate(po.order_date)}</span>
                </div>
                {po.expected_date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Expected Date:</span>
                    <span className="font-medium">{formatDate(po.expected_date)}</span>
                  </div>
                )}
                {po.received_date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Received Date:</span>
                    <span className="font-medium">{formatDate(po.received_date)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Currency:</span>
                  <span className="font-medium">{po.currency}</span>
                </div>
              </div>
            </div>
          </div>

          {po.shipping_address && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Shipping Address</h3>
              <p className="text-sm text-gray-600 whitespace-pre-line">{po.shipping_address}</p>
            </div>
          )}

          {po.notes && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-line">{po.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Line Items</h2>
        </div>
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th className="text-right">Ordered</th>
                  <th className="text-right">Received</th>
                  <th className="text-right">Unit Cost</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.line_number}</td>
                    <td>
                      <div>
                        {line.products?.name || line.description}
                        {line.products?.sku && (
                          <div className="text-xs text-gray-500">SKU: {line.products.sku}</div>
                        )}
                      </div>
                    </td>
                    <td className="text-right">{line.quantity_ordered}</td>
                    <td className="text-right">{line.quantity_received || 0}</td>
                    <td className="text-right">{formatCurrency(line.unit_cost)}</td>
                    <td className="text-right font-medium">{formatCurrency(line.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(po.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span className="font-medium">{formatCurrency(po.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span>{formatCurrency(po.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface PurchaseOrder {
  id: string;
  po_number: string;
  order_date: string;
  vendors: {
    name: string;
    company_name: string | null;
  } | null;
}

interface POLine {
  id: string;
  line_number: number;
  description: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost: number;
  product_id: string | null;
}

interface GRLine {
  id: string;
  po_line_id: string;
  product_id: string | null;
  description: string;
  quantity_to_receive: number;
  unit_cost: number;
}

export default function NewGoodsReceiptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poId = searchParams.get('po_id');

  const [loading, setLoading] = useState(false);
  const [loadingPO, setLoadingPO] = useState(true);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poLines, setPOLines] = useState<POLine[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  const [formData, setFormData] = useState({
    po_id: poId || '',
    received_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [lines, setLines] = useState<GRLine[]>([]);

  useEffect(() => {
    loadApprovedPOs();
  }, []);

  useEffect(() => {
    if (formData.po_id) {
      loadPODetails(formData.po_id);
    }
  }, [formData.po_id]);

  const loadApprovedPOs = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          order_date,
          vendor_id,
          vendors (
            name,
            company_name
          )
        `)
        .in('status', ['approved', 'partial'])
        .order('order_date', { ascending: false });

      if (error) throw error;
      
      // Transform vendors from array to single object
      const transformedData = (data || []).map(po => ({
        ...po,
        vendors: Array.isArray(po.vendors) ? po.vendors[0] : po.vendors
      }));
      
      setPurchaseOrders(transformedData);
    } catch (error) {
      console.error('Failed to load POs:', error);
      toast.error('Failed to load purchase orders');
    }
  };

  const loadPODetails = async (po_id: string) => {
    try {
      setLoadingPO(true);
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (
            name,
            company_name
          )
        `)
        .eq('id', po_id)
        .single();

      if (poError) throw poError;
      setSelectedPO(poData);

      const { data: linesData, error: linesError } = await supabase
        .from('purchase_order_lines')
        .select('*')
        .eq('purchase_order_id', po_id)
        .order('line_number');

      if (linesError) throw linesError;

      const linesWithRemaining = (linesData || []).map(line => ({
        ...line,
        quantity_remaining: line.quantity_ordered - (line.quantity_received || 0),
      }));

      setPOLines(linesWithRemaining);

      // Auto-populate GR lines with remaining quantities
      const grLines = linesWithRemaining
        .filter(line => line.quantity_remaining > 0)
        .map(line => ({
          id: Math.random().toString(),
          po_line_id: line.id,
          product_id: line.product_id,
          description: line.description,
          quantity_to_receive: line.quantity_remaining,
          unit_cost: line.unit_cost,
        }));

      setLines(grLines);
    } catch (error) {
      console.error('Failed to load PO details:', error);
      toast.error('Failed to load PO details');
    } finally {
      setLoadingPO(false);
    }
  };

  const handleLineChange = (index: number, field: keyof GRLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.po_id) {
      toast.error('Please select a purchase order');
      return;
    }

    if (lines.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/goods-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          po_id: formData.po_id,
          received_date: formData.received_date,
          notes: formData.notes,
          lines: lines.map(line => ({
            po_line_id: line.po_line_id,
            product_id: line.product_id,
            quantity_received: line.quantity_to_receive,
            unit_cost: line.unit_cost,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create goods receipt');
      }

      toast.success('Goods receipt created successfully');
      router.push(`/dashboard/goods-receipts/${result.id}`);
    } catch (error: any) {
      console.error('Error creating GR:', error);
      toast.error(error.message || 'Failed to create goods receipt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/goods-receipts" className="btn-ghost p-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Goods Receipt</h1>
          <p className="text-gray-500 mt-1">Receive goods from a purchase order</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* GR Details */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Receipt Information</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">
                  Purchase Order <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.po_id}
                  onChange={(e) => setFormData({ ...formData, po_id: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select purchase order...</option>
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} - {po.vendors?.company_name || po.vendors?.name || 'Unknown Vendor'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  Received Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.received_date}
                  onChange={(e) => setFormData({ ...formData, received_date: e.target.value })}
                  className="input"
                  required
                />
              </div>
            </div>

            {selectedPO && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Vendor Details</h3>
                <p className="text-sm text-gray-600">
                  {selectedPO.vendors?.company_name || selectedPO.vendors?.name}
                </p>
              </div>
            )}

            <div>
              <label className="label">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input"
                rows={3}
                placeholder="Delivery notes, damages, etc..."
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        {formData.po_id && !loadingPO && (
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">Items to Receive</h2>
            </div>
            <div className="card-body">
              {lines.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  All items from this PO have been received
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th className="w-32">Ordered</th>
                        <th className="w-32">Received</th>
                        <th className="w-32">Remaining</th>
                        <th className="w-32">Receive Now</th>
                        <th className="w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, index) => {
                        const poLine = poLines.find(pl => pl.id === line.po_line_id);
                        return (
                          <tr key={line.id}>
                            <td>{line.description}</td>
                            <td>{poLine?.quantity_ordered || 0}</td>
                            <td>{poLine?.quantity_received || 0}</td>
                            <td>{poLine?.quantity_remaining || 0}</td>
                            <td>
                              <input
                                type="number"
                                value={line.quantity_to_receive}
                                onChange={(e) => handleLineChange(index, 'quantity_to_receive', parseFloat(e.target.value) || 0)}
                                className="input text-sm"
                                min="0"
                                max={poLine?.quantity_remaining || 0}
                                step="0.01"
                                required
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => removeLine(index)}
                                className="btn-ghost text-red-600 p-1"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/dashboard/goods-receipts" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={loading || lines.length === 0} className="btn-primary">
            {loading ? 'Creating...' : 'Create Goods Receipt'}
          </button>
        </div>
      </form>
    </div>
  );
}

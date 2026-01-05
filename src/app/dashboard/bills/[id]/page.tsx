'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PrinterIcon,
  CreditCardIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase/client';
import { printBill } from '@/lib/pdf/bill';
import { formatCurrency as currencyFormatter } from '@/lib/currency';

interface BillLine {
  id: string;
  description: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  tax_rate: number;
  tax_amount: number;
}

interface BillPayment {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference: string;
  notes: string;
}

interface Bill {
  id: string;
  bill_number: string;
  vendor_id: string;
  bill_date: string;
  due_date: string;
  vendor_invoice_number: string | null;
  notes: string | null;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  status: string;
  vendors?: {
    name: string;
    email: string;
    company_name: string;
    phone: string;
    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
  };
}

export default function BillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [bill, setBill] = useState<Bill | null>(null);
  const [lines, setLines] = useState<BillLine[]>([]);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadBillDetails();
    }
  }, [params.id]);

  const loadBillDetails = async () => {
    try {
      setLoading(true);

      // Fetch bill with vendor
      const { data: billData, error: billError } = await supabase
        .from('bills')
        .select(`
          *,
          vendors (
            name,
            email,
            company_name,
            phone,
            address_line1,
            address_line2,
            city,
            state,
            zip_code,
            country
          )
        `)
        .eq('id', params.id)
        .single();

      if (billError) throw billError;
      setBill(billData);

      // Fetch bill lines
      const { data: linesData, error: linesError } = await supabase
        .from('bill_lines')
        .select('*')
        .eq('bill_id', params.id)
        .order('line_number');

      if (linesError) throw linesError;
      setLines(linesData || []);

      // Fetch bill payments
      const paymentsResponse = await fetch(`/api/bills/${params.id}/payments`);
      if (paymentsResponse.ok) {
        const paymentsResult = await paymentsResponse.json();
        setPayments(paymentsResult.data || []);
      }
    } catch (error) {
      console.error('Failed to load bill:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    const currency = bill?.currency || 'USD';
    return currencyFormatter(num, currency as any);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'badge-gray',
      pending_approval: 'badge-warning',
      approved: 'badge-info',
      partial: 'badge-info',
      paid: 'badge-success',
      overdue: 'badge-error',
      void: 'badge-gray',
    };
    return styles[status] || 'badge-gray';
  };

  const handlePrint = () => {
    if (bill && lines) {
      printBill({
        bill,
        vendor: bill.vendors || {},
        lines,
      });
    }
  };

  const handleApprove = async () => {
    if (!confirm('Approve this bill for payment?')) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`/api/bills/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      
      // Reload bill
      await loadBillDetails();
    } catch (error: any) {
      console.error('Failed to approve bill:', error);
      alert(error.message || 'Failed to approve bill');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!confirm('Void this bill? This action cannot be undone.')) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`/api/bills/${params.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      router.push('/dashboard/bills');
    } catch (error: any) {
      console.error('Failed to void bill:', error);
      alert(error.message || 'Failed to void bill');
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Permanently delete this bill? This action cannot be undone.')) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`/api/bills/${params.id}?action=delete`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      router.push('/dashboard/bills');
    } catch (error: any) {
      console.error('Failed to delete bill:', error);
      alert(error.message || 'Failed to delete bill');
      setActionLoading(false);
    }
  };

  const handleChangeToDraft = async () => {
    if (!confirm('Change this bill back to draft status? This will allow you to edit it.')) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`/api/bills/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      // Reload bill
      await loadBillDetails();
    } catch (error: any) {
      console.error('Failed to change bill status:', error);
      alert(error.message || 'Failed to change bill status');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="loading"></div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Bill not found</p>
        <Link href="/dashboard/bills" className="btn-primary mt-4">
          Back to Bills
        </Link>
      </div>
    );
  }

  const balanceDue = parseFloat(bill.total as any) - parseFloat(bill.amount_paid as any);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 print:hidden">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/dashboard/bills"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{bill.bill_number}</h1>
            <p className="text-sm md:text-base text-gray-600">Bill Details</p>
          </div>
        </div>
        
        {/* Action Buttons - Mobile Optimized */}
        <div className="flex flex-wrap gap-2">
          <button onClick={handlePrint} className="btn-secondary text-sm">
            <PrinterIcon className="w-4 h-4 md:w-5 md:h-5 md:mr-2" />
            <span className="hidden md:inline">Print</span>
          </button>
          
          <Link href={`/dashboard/bills/${params.id}/edit`} className="btn-secondary text-sm">
            <PencilIcon className="w-4 h-4 md:w-5 md:h-5 md:mr-2" />
            <span className="hidden md:inline">Edit</span>
          </Link>
          
          {bill.status === 'draft' && (
            <>
              <button 
                onClick={handleApprove} 
                disabled={actionLoading}
                className="btn-secondary text-sm"
              >
                <CheckIcon className="w-4 h-4 md:w-5 md:h-5 md:mr-2" />
                <span className="hidden md:inline">Approve</span>
              </button>
              <button 
                onClick={handleDelete} 
                disabled={actionLoading}
                className="btn-secondary text-red-600 hover:bg-red-50 text-sm"
              >
                <TrashIcon className="w-4 h-4 md:w-5 md:h-5 md:mr-2" />
                <span className="hidden md:inline">Delete</span>
              </button>
            </>
          )}

          {['approved', 'partial', 'overdue'].includes(bill.status) && balanceDue > 0 && (
            <>
              <Link href={`/dashboard/bills/${params.id}/payment`} className="btn-primary text-sm flex-1 md:flex-none justify-center">
                <CreditCardIcon className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                Record Payment
              </Link>
              <button 
                onClick={handleVoid} 
                disabled={actionLoading}
                className="btn-secondary text-red-600 hover:bg-red-50 text-sm"
              >
                <XMarkIcon className="w-4 h-4 md:w-5 md:h-5 md:mr-2" />
                <span className="hidden md:inline">Void</span>
              </button>
            </>
          )}

          {bill.status === 'approved' && (
            <button 
              onClick={handleChangeToDraft} 
              disabled={actionLoading}
              className="btn-secondary text-sm"
            >
              <PencilIcon className="w-4 h-4 md:w-5 md:h-5 md:mr-2" />
              <span className="hidden md:inline">Change to Draft</span>
            </button>
          )}

          {bill.status === 'paid' && (
            <button 
              onClick={handleVoid} 
              disabled={actionLoading}
              className="btn-secondary text-red-600 hover:bg-red-50 text-sm"
            >
              <XMarkIcon className="w-4 h-4 md:w-5 md:h-5 md:mr-2" />
              <span className="hidden md:inline">Void</span>
            </button>
          )}
        </div>
      </div>

      {/* Bill Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header Section */}
        <div className="p-4 md:p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">BILL</h2>
              <p className="text-sm md:text-base text-gray-600">Bill #: {bill.bill_number}</p>
              {bill.vendor_invoice_number && (
                <p className="text-sm md:text-base text-gray-600">Vendor Invoice: {bill.vendor_invoice_number}</p>
              )}
            </div>
            <div className="self-start">
              <span className={`badge ${getStatusBadge(bill.status)} text-sm md:text-lg px-3 py-1 md:px-4 md:py-2`}>
                {bill.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Vendor & Date Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 p-4 md:p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-2 uppercase">Vendor</h3>
            <p className="font-medium text-gray-900 text-sm md:text-base">
              {bill.vendors?.company_name || bill.vendors?.name}
            </p>
            {(bill.vendors?.address_line1 || bill.vendors?.city) && (
              <div className="text-xs md:text-sm text-gray-600 mt-1">
                {bill.vendors.address_line1 && <p>{bill.vendors.address_line1}</p>}
                {bill.vendors.address_line2 && <p>{bill.vendors.address_line2}</p>}
                {(bill.vendors.city || bill.vendors.state || bill.vendors.zip_code) && (
                  <p>
                    {bill.vendors.city}{bill.vendors.city && bill.vendors.state ? ', ' : ''}{bill.vendors.state} {bill.vendors.zip_code}
                  </p>
                )}
                {bill.vendors.country && bill.vendors.country !== 'USA' && (
                  <p>{bill.vendors.country}</p>
                )}
              </div>
            )}
            {bill.vendors?.email && (
              <p className="text-xs md:text-sm text-gray-600 mt-1">{bill.vendors.email}</p>
            )}
            {bill.vendors?.phone && (
              <p className="text-xs md:text-sm text-gray-600">{bill.vendors.phone}</p>
            )}
          </div>
          <div>
            <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-2 uppercase md:hidden">Date Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs md:text-sm text-gray-600">Bill Date</p>
                <p className="font-medium text-sm md:text-base">{formatDate(bill.bill_date)}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-600">Due Date</p>
                <p className="font-medium text-sm md:text-base">{formatDate(bill.due_date)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="p-4 md:p-6 border-b border-gray-200">
          <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-4 uppercase">Line Items</h3>
          
          {/* Mobile View */}
          <div className="md:hidden space-y-3">
            {lines.map((line) => (
              <div key={line.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-gray-900 flex-1 pr-2">{line.description}</p>
                  <p className="font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(line.line_total)}</p>
                </div>
                <div className="flex gap-4 text-xs text-gray-600">
                  <span>Qty: {parseFloat(line.quantity as any)}</span>
                  <span>•</span>
                  <span>Unit: {formatCurrency(line.unit_cost)}</span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Unit Cost
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{line.description}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {parseFloat(line.quantity as any)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(line.unit_cost)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(line.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="p-4 md:p-6 bg-gray-50">
          <div className="flex justify-end">
            <div className="w-full md:w-80 space-y-2 text-sm md:text-base">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(bill.subtotal)}</span>
              </div>
              {parseFloat(bill.tax_amount as any) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">{formatCurrency(bill.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-300">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-semibold text-gray-900 text-base md:text-lg">
                  {formatCurrency(bill.total)}
                </span>
              </div>
              {parseFloat(bill.amount_paid as any) > 0 && (
                <div className="flex justify-between text-[#52b53b]">
                  <span>Paid</span>
                  <span>-{formatCurrency(bill.amount_paid)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-300">
                <span className="font-semibold">Balance Due</span>
                <span className="font-semibold text-base md:text-lg">
                  {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {bill.notes && (
          <div className="p-4 md:p-6 border-t border-gray-200">
            <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-2 uppercase">Notes</h3>
            <p className="text-sm md:text-base text-gray-700 whitespace-pre-wrap">{bill.notes}</p>
          </div>
        )}
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:break-inside-avoid">
          <div className="p-4 md:p-6 bg-gray-50 border-b border-gray-200">
            <h2 className="text-base md:text-lg font-semibold text-gray-900">Payment History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {payment.reference || payment.payment_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                      {payment.payment_method.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                      {formatCurrency(payment.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

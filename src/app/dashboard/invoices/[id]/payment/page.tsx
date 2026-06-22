'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency as currencyFormatter, SupportedCurrency } from '@/lib/currency';
import { Button, Card, CardHeader, CardTitle, CardBody, Input, Select, Textarea, LoadingSpinner } from '@/components/ui';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  amount_paid: number;
  customer_id: string;
  currency?: SupportedCurrency;
  customer: {
    name: string | null;
  } | null;
}

export default function RecordPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'bank_transfer',
    reference_number: '',
    notes: '',
  });

  useEffect(() => {
    fetchInvoice();
  }, [params.id]);

  const fetchInvoice = async () => {
    try {
      const res = await fetch(`/api/invoices/${params.id}`, { cache: 'no-store' });
      const data = await res.json();

      const customerData = data.customer;
      setInvoice({
        id: data.id,
        invoice_number: data.invoice_number,
        total: data.total,
        amount_paid: data.amount_paid,
        customer_id: data.customer_id,
        customer: Array.isArray(customerData)
          ? customerData[0] ?? null
          : customerData ?? null,
      });

      const balanceDue = Number(data.total) - Number(data.amount_paid);
      setFormData(prev => ({
        ...prev,
        amount: balanceDue.toFixed(2),
      }));
    } catch (error) {
      console.error('Error fetching invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const balanceDue = Number(invoice!.total) - Number(invoice!.amount_paid);
      if (amount > balanceDue) {
        throw new Error(`Amount cannot exceed balance due (${formatCurrency(balanceDue)})`);
      }

      const res = await fetch(`/api/invoices/${params.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_date: formData.payment_date,
          amount,
          payment_method: formData.payment_method,
          reference_number: formData.reference_number || null,
          notes: formData.notes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');

      router.push(`/dashboard/invoices/${params.id}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, invoice?.currency || 'USD');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Invoice not found</p>
        <Link href="/dashboard/invoices">
          <Button variant="outline" className="mt-4">
            Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  const balanceDue = Number(invoice.total) - Number(invoice.amount_paid);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/invoices/${params.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Record Payment</h1>
          <p className="text-gray-500">Invoice {invoice.invoice_number}</p>
        </div>
      </div>

      {/* Invoice Summary */}
      <Card className="mb-6">
        <CardBody className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Customer</p>
              <p className="font-medium">{invoice.customer?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Invoice Total</p>
              <p className="font-medium">{formatCurrency(Number(invoice.total))}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Amount Paid</p>
              <p className="font-medium text-green-600">{formatCurrency(Number(invoice.amount_paid))}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Balance Due</p>
              <p className="font-semibold text-red-600">{formatCurrency(balanceDue)}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Payment Date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
              />

              <Input
                label="Amount"
                type="number"
                step="0.01"
                min="0.01"
                max={balanceDue}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <Select
              label="Payment Method"
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              options={[
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'check', label: 'Check' },
                { value: 'cash', label: 'Cash' },
                { value: 'credit_card', label: 'Credit Card' },
                { value: 'stripe', label: 'Stripe' },
                { value: 'other', label: 'Other' },
              ]}
              required
            />

            <Input
              label="Reference Number"
              placeholder="Check number, transaction ID, etc."
              value={formData.reference_number}
              onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
            />

            <Textarea
              label="Notes"
              rows={3}
              placeholder="Optional payment notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? 'Recording...' : 'Record Payment'}
              </Button>
              <Link href={`/dashboard/invoices/${params.id}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

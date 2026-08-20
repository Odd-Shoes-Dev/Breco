'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PrinterIcon,
  TrashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface PaymentApplication {
  id: string;
  amount_applied: number;
  invoice: {
    id: string;
    invoice_number: string;
    invoice_date: string;
    total: number;
    amount_paid: number;
    status: string;
  } | null;
}

interface Receipt {
  id: string;
  payment_number: string;
  customer_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  currency: string;
  notes: string | null;
  created_at: string;
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
  } | null;
  deposit_account: {
    account_name: string;
    bank_name: string | null;
  } | null;
  payment_applications: PaymentApplication[] | null;
}

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchReceipt();
  }, [params.id]);

  const fetchReceipt = async () => {
    try {
      const res = await fetch(`/api/receipts/${params.id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch receipt');
      const data = await res.json();
      setReceipt({
        ...data,
        amount: Number(data.amount) || 0,
      });
    } catch (error) {
      console.error('Error fetching receipt:', error);
      toast.error('Failed to load receipt');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, (receipt?.currency || 'USD') as any);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePrint = () => {
    if (!receipt) return;

    const applications = receipt.payment_applications || [];

    const printHTML = `
      <html>
        <head>
          <title>Receipt #${receipt.payment_number} - Breco Safaris Ltd</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #111827;
              background: white;
              padding: 40px;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 30px;
              border-bottom: 3px solid #1e3a5f;
              padding-bottom: 20px;
            }
            .company-section { display: flex; align-items: center; }
            .logo { width: 200px; height: 200px; margin-right: 20px; border-radius: 8px; object-fit: contain; }
            .company-info h1 { font-size: 24px; font-weight: bold; color: #1e3a5f; margin-bottom: 4px; }
            .company-info .address { font-size: 12px; color: #6b7280; margin-bottom: 2px; }
            .receipt-header { text-align: right; }
            .receipt-header h2 { font-size: 32px; font-weight: bold; color: #1e3a5f; margin-bottom: 4px; }
            .receipt-header .number { font-size: 14px; color: #6b7280; }
            .paid-badge {
              display: inline-block; padding: 6px 16px; border-radius: 12px;
              font-size: 13px; font-weight: 700; text-transform: uppercase;
              margin-top: 8px; background: #e8f5e9; color: #2e7d32;
            }
            .receipt-details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 25px 0; }
            .section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb; }
            .section h3 { font-size: 12px; font-weight: bold; color: #6b7280; margin-bottom: 10px; text-transform: uppercase; }
            .section p { font-size: 14px; color: #111827; margin-bottom: 4px; }
            .section .label { font-size: 12px; color: #6b7280; }
            .section .value { font-size: 14px; color: #111827; font-weight: 500; }
            .items-table { width: 100%; border-collapse: collapse; margin: 25px 0; }
            .items-table thead { background: #f1f8e9; }
            .items-table th { text-align: left; padding: 12px; font-size: 12px; font-weight: bold; color: #2e7d32; text-transform: uppercase; border-bottom: 2px solid #1e3a5f; }
            .items-table th.text-right { text-align: right; }
            .items-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
            .items-table td.text-right { text-align: right; }
            .totals-section { margin: 30px 0; padding: 20px; border: 2px solid #1e3a5f; border-radius: 8px; background: #f1f8e9; display: flex; justify-content: flex-end; }
            .totals-box { min-width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
            .total-row.total { border-top: 2px solid #1e3a5f; margin-top: 10px; padding-top: 15px; font-size: 20px; font-weight: bold; color: #1e3a5f; }
            .notes-section { margin: 25px 0; padding: 20px; background: #f1f8e9; border-radius: 8px; border-left: 4px solid #1e3a5f; }
            .notes-section h3 { font-size: 12px; font-weight: bold; color: #1e3a5f; margin-bottom: 10px; text-transform: uppercase; }
            .notes-section p { font-size: 14px; color: #111827; white-space: pre-wrap; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #6b7280; }
            .thank-you { text-align: center; margin: 30px 0; padding: 20px; font-size: 18px; font-weight: 600; color: #1e3a5f; }
            @media print { body { padding: 20px; } @page { margin: 0.5in; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-section">
              <img src="/assets/logo.jpg" alt="Breco Safaris Logo" class="logo" />
              <div class="company-info">
                <h1>Breco Safaris Ltd</h1>
                <p class="address">Kampala Road Plot 14 Eagen House, Russel Street</p>
                <p class="address">P.O.Box 144011, Kampala, Uganda</p>
                <p class="address">Tel: +256 782 884 933 | +256 772 891 729 | +256 775 766 578</p>
                <p class="address">Email: brecosafaris@gmail.com | Website: www.brecosafaris.com</p>
                <p class="address">URA TIN: 1014756280 | URSB Reg. No: 80020001634842</p>
              </div>
            </div>
            <div class="receipt-header">
              <h2>RECEIPT</h2>
              <p class="number">#${receipt.payment_number}</p>
              <span class="paid-badge">✓ RECEIVED</span>
            </div>
          </div>

          <div class="receipt-details">
            <div class="section">
              <h3>Received From</h3>
              <p><strong>${receipt.customer?.name || 'N/A'}</strong></p>
              ${receipt.customer?.email ? `<p>${receipt.customer.email}</p>` : ''}
              ${receipt.customer?.phone ? `<p>${receipt.customer.phone}</p>` : ''}
              ${receipt.customer?.address_line1 ? `<p style="margin-top: 8px;">${receipt.customer.address_line1}</p>` : ''}
              ${receipt.customer?.city ? `<p>${[receipt.customer.city, receipt.customer.state, receipt.customer.zip_code].filter(Boolean).join(', ')}</p>` : ''}
            </div>
            <div class="section">
              <h3>Payment Details</h3>
              <p><span class="label">Payment Date:</span> <span class="value">${formatDate(receipt.payment_date)}</span></p>
              <p><span class="label">Payment Method:</span> <span class="value">${receipt.payment_method.replace('_', ' ')}</span></p>
              ${receipt.reference_number ? `<p><span class="label">Reference:</span> <span class="value">${receipt.reference_number}</span></p>` : ''}
              ${receipt.deposit_account ? `<p><span class="label">Deposited To:</span> <span class="value">${receipt.deposit_account.account_name}</span></p>` : ''}
            </div>
          </div>

          ${applications.length > 0 ? `
          <table class="items-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Invoice Date</th>
                <th class="text-right">Amount Applied</th>
              </tr>
            </thead>
            <tbody>
              ${applications.map(app => `
                <tr>
                  <td>${app.invoice?.invoice_number || '-'}</td>
                  <td>${app.invoice ? formatDate(app.invoice.invoice_date) : '-'}</td>
                  <td class="text-right"><strong>${formatCurrency(Number(app.amount_applied))}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ` : ''}

          <div class="totals-section">
            <div class="totals-box">
              <div class="total-row total">
                <span>AMOUNT RECEIVED</span>
                <span>${formatCurrency(receipt.amount)}</span>
              </div>
            </div>
          </div>

          <div class="thank-you">Thank you for your business!</div>

          ${receipt.notes ? `
          <div class="notes-section">
            <h3>Notes</h3>
            <p>${receipt.notes}</p>
          </div>
          ` : ''}

          <div class="footer">
            <p>This is a computer-generated receipt. No signature required.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this receipt?')) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/receipts/${params.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete receipt');

      toast.success('Receipt deleted successfully');
      router.push('/dashboard/receipts');
    } catch (error) {
      console.error('Error deleting receipt:', error);
      toast.error('Failed to delete receipt');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Receipt not found</p>
        <Link href="/dashboard/receipts" className="btn-primary mt-4">
          Back to Receipts
        </Link>
      </div>
    );
  }

  const applications = receipt.payment_applications || [];
  const totalApplied = applications.reduce((sum, app) => sum + Number(app.amount_applied || 0), 0);
  const unapplied = receipt.amount - totalApplied;

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/dashboard/receipts" className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                Receipt {receipt.payment_number}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-green-100 text-green-800 w-fit">
                <CheckCircleIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                RECEIVED
              </span>
            </div>
            <p className="text-sm sm:text-base text-gray-500 mt-1 truncate">{receipt.customer?.name || 'N/A'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="btn-secondary text-sm">
            <PrinterIcon className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-ghost text-red-600 hover:bg-red-50 p-2 disabled:opacity-50"
          >
            <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Payment Received Box */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              <h3 className="text-base sm:text-lg font-semibold text-green-900">Payment Received</h3>
            </div>
            <p className="text-sm sm:text-base text-green-700">
              Payment of <span className="font-bold text-lg sm:text-xl">{formatCurrency(receipt.amount)}</span> received on {formatDate(receipt.payment_date)}
            </p>
            <p className="text-xs sm:text-sm text-green-600 mt-1">
              Time: {formatTime(receipt.created_at)}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs sm:text-sm text-green-700">Payment Method</p>
            <p className="font-semibold text-sm sm:text-base text-green-900 capitalize">
              {receipt.payment_method.replace('_', ' ')}
            </p>
            {receipt.reference_number && (
              <p className="text-xs sm:text-sm text-green-600 mt-1">Ref: {receipt.reference_number}</p>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Customer Information</h3>
          </div>
          <div className="card-body space-y-3">
            <div>
              <p className="text-sm text-gray-500">Customer Name</p>
              <p className="font-medium">{receipt.customer?.name || 'N/A'}</p>
            </div>
            {receipt.customer?.email && (
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{receipt.customer.email}</p>
              </div>
            )}
            {receipt.customer?.phone && (
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{receipt.customer.phone}</p>
              </div>
            )}
            {(receipt.customer?.address_line1 || receipt.customer?.city) && (
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">
                  {receipt.customer?.address_line1}
                  {receipt.customer?.address_line2 && <br />}
                  {receipt.customer?.address_line2}
                  {(receipt.customer?.city || receipt.customer?.state || receipt.customer?.zip_code) && <br />}
                  {[receipt.customer?.city, receipt.customer?.state, receipt.customer?.zip_code].filter(Boolean).join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Payment Details</h3>
          </div>
          <div className="card-body space-y-3">
            <div>
              <p className="text-sm text-gray-500">Payment Number</p>
              <p className="font-medium">{receipt.payment_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Payment Date</p>
              <p className="font-medium">{formatDate(receipt.payment_date)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Recorded At</p>
              <p className="font-medium">{formatTime(receipt.created_at)}</p>
            </div>
            {receipt.deposit_account && (
              <div>
                <p className="text-sm text-gray-500">Deposited To</p>
                <p className="font-medium">{receipt.deposit_account.account_name}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Applied Invoices */}
      {applications.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title text-base sm:text-lg">Applied To Invoices</h3>
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="table min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs sm:text-sm">Invoice</th>
                  <th className="text-left text-xs sm:text-sm">Invoice Date</th>
                  <th className="text-left text-xs sm:text-sm">Status</th>
                  <th className="text-right text-xs sm:text-sm">Amount Applied</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td className="text-xs sm:text-sm">
                      {app.invoice ? (
                        <Link href={`/dashboard/invoices/${app.invoice.id}`} className="text-blue-600 hover:underline">
                          {app.invoice.invoice_number}
                        </Link>
                      ) : '-'}
                    </td>
                    <td className="text-xs sm:text-sm">{app.invoice ? formatDate(app.invoice.invoice_date) : '-'}</td>
                    <td className="text-xs sm:text-sm capitalize">{app.invoice?.status || '-'}</td>
                    <td className="text-right font-medium text-xs sm:text-sm">{formatCurrency(Number(app.amount_applied))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Summary */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title text-base sm:text-lg">Payment Summary</h3>
        </div>
        <div className="card-body">
          <div className="flex justify-end">
            <div className="w-full sm:w-80 space-y-2 sm:space-y-3">
              <div className="flex justify-between text-sm sm:text-base text-gray-600">
                <span>Amount Received</span>
                <span className="font-semibold text-gray-900">{formatCurrency(receipt.amount)}</span>
              </div>
              {applications.length > 0 && (
                <div className="flex justify-between text-sm sm:text-base text-gray-600">
                  <span>Applied to Invoices</span>
                  <span>{formatCurrency(totalApplied)}</span>
                </div>
              )}
              {applications.length > 0 && Math.abs(unapplied) > 0.01 && (
                <div className="flex justify-between pt-2 sm:pt-3 border-t border-gray-200 text-sm sm:text-base">
                  <span className="font-semibold">Unapplied Balance</span>
                  <span className="font-semibold">{formatCurrency(unapplied)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {receipt.notes && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Notes</h3>
          </div>
          <div className="card-body">
            <p className="text-gray-700 whitespace-pre-wrap">{receipt.notes}</p>
          </div>
        </div>
      )}

      {/* Company Info Footer */}
      <div className="card bg-gray-50">
        <div className="card-body text-center text-sm text-gray-600">
          <p className="font-semibold text-gray-900">Breco Safaris Ltd</p>
          <p>Kampala Road Plot 14 Eagen House, Russel Street, P.O.Box 144011, Kampala, Uganda</p>
          <p>Tel: +256 782 884 933, +256 772 891 729 • Email: brecosafaris@gmail.com</p>
          <p>URA TIN: 1014756280 • URSB Reg. No: 80020001634842</p>
          <p className="mt-2 text-xs">This is an official receipt for accounting purposes.</p>
        </div>
      </div>
    </div>
  );
}

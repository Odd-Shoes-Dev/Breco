'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button, Card, CardHeader, CardTitle, CardBody, Badge, LoadingSpinner } from '@/components/ui';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  ArrowLeftIcon,
  PrinterIcon,
  PencilIcon,
  EnvelopeIcon,
  CreditCardIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  booking_id: string | null;
  invoice_date: string;
  due_date: string;
  status: string;
  currency: 'USD' | 'EUR' | 'GBP' | 'UGX';
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  notes: string | null;
  po_number: string | null;
  document_type: 'invoice' | 'quotation' | 'proforma' | 'receipt';
  quotation_number: string | null;
  proforma_number: string | null;
  receipt_number: string | null;
  customer?: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
  };
}

interface LineItem {
  id: string;
  line_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  inventory_item_id: string | null;
}

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [relatedBooking, setRelatedBooking] = useState<any | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoice();
  }, [params.id]);

  const fetchInvoice = async () => {
    try {
      // Fetch invoice with customer
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('id', params.id)
        .single();

      if (invoiceError) throw invoiceError;
      
      // Parse numeric fields that come as strings from Supabase
      const parsedInvoice = {
        ...invoiceData,
        subtotal: parseFloat(invoiceData.subtotal || 0),
        tax_amount: parseFloat(invoiceData.tax_amount || 0),
        discount_amount: parseFloat(invoiceData.discount_amount || 0),
        total_amount: parseFloat(invoiceData.total || 0),
        amount_paid: parseFloat(invoiceData.amount_paid || 0),
        tax_rate: parseFloat(invoiceData.tax_rate || 0),
      };
      
      setInvoice(parsedInvoice);

      // Fetch line items
      const { data: itemsData } = await supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', params.id)
        .order('line_number');

      // Parse line item numeric fields
      const parsedItems = (itemsData || []).map(item => {
        const quantity = parseFloat(item.quantity || 0);
        const unitPrice = parseFloat(item.unit_price || 0);
        const lineTotal = parseFloat(item.line_total || 0);
        const discountAmount = parseFloat(item.discount_amount || 0);
        const taxAmount = parseFloat(item.tax_amount || 0);
        
        // Calculate amount if line_total is 0 (legacy data)
        const calculatedAmount = lineTotal || (quantity * unitPrice - discountAmount + taxAmount);
        
        return {
          ...item,
          quantity,
          unit_price: unitPrice,
          line_total: lineTotal,
          amount: calculatedAmount,
        };
      });

      setLineItems(parsedItems);

      // Fetch payments through payment_applications
      const { data: paymentsData } = await supabase
        .from('payment_applications')
        .select(`
          *,
          payment:payments_received(*)
        `)
        .eq('invoice_id', params.id)
        .order('created_at', { ascending: false });

      // Parse payment numeric fields and flatten the structure
      const parsedPayments = (paymentsData || []).map(app => ({
        id: app.payment.id,
        payment_number: app.payment.payment_number,
        payment_date: app.payment.payment_date,
        amount: parseFloat(app.amount_applied || 0),
        payment_method: app.payment.payment_method,
        reference_number: app.payment.reference_number,
        notes: app.payment.notes,
      }));

      setPayments(parsedPayments);

      // Fetch related booking if booking_id exists
      if (parsedInvoice.booking_id) {
        const { data: bookingData } = await supabase
          .from('bookings')
          .select(`
            id,
            booking_number,
            booking_type,
            status,
            travel_start_date,
            travel_end_date,
            num_adults,
            num_children,
            total,
            amount_paid,
            currency,
            tour_package:tour_packages (id, name, package_code, duration_days, duration_nights),
            hotel:hotels (id, name, star_rating),
            vehicle:vehicles!bookings_assigned_vehicle_id_fkey (id, vehicle_type, registration_number)
          `)
          .eq('id', parsedInvoice.booking_id)
          .single();

        if (bookingData) {
          setRelatedBooking(bookingData);
        }
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    const currency = invoice?.currency || 'USD';
    return currencyFormatter(amount, currency as any);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
      draft: 'default',
      sent: 'info',
      partial: 'warning',
      paid: 'success',
      overdue: 'error',
      cancelled: 'default',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const handlePrint = () => {
    if (!invoice) return;

    const printHTML = `
      <html>
        <head>
          <title>Invoice #${invoice.invoice_number} - Breco Safaris Ltd</title>
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
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 20px;
            }
            .company-section {
              display: flex;
              align-items: center;
            }
            .logo { 
              width: 200px; 
              height: 200px; 
              margin-right: 20px;
              border-radius: 8px;
              object-fit: contain;
            }
            .company-info h1 { 
              font-size: 24px; 
              font-weight: bold; 
              color: #1e3a5f;
              margin-bottom: 8px;
            }
            .company-info .address { 
              font-size: 11px; 
              color: #6b7280;
              margin-bottom: 3px;
              line-height: 1.5;
            }
            .invoice-header { 
              text-align: right;
            }
            .invoice-header h2 { 
              font-size: 28px; 
              font-weight: bold; 
              color: #1e3a5f;
              margin-bottom: 4px;
            }
            .invoice-header .number { 
              font-size: 14px; 
              color: #6b7280;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
              margin-top: 8px;
            }
            .status-draft { background: #f3f4f6; color: #374151; }
            .status-sent { background: #dbeafe; color: #1e40af; }
            .status-partial { background: #fef3c7; color: #92400e; }
            .status-paid { background: #d1fae5; color: #065f46; }
            .status-overdue { background: #fee2e2; color: #991b1b; }
            .invoice-details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin: 25px 0;
            }
            .section {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 15px;
              background: #f9fafb;
            }
            .section h3 {
              font-size: 12px;
              font-weight: bold;
              color: #6b7280;
              margin-bottom: 10px;
              text-transform: uppercase;
            }
            .section p {
              font-size: 14px;
              color: #111827;
              margin-bottom: 4px;
            }
            .section .label {
              font-size: 12px;
              color: #6b7280;
            }
            .section .value {
              font-size: 14px;
              color: #111827;
              font-weight: 500;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 25px 0;
            }
            .items-table thead {
              background: #f9fafb;
            }
            .items-table th {
              text-align: left;
              padding: 12px;
              font-size: 12px;
              font-weight: bold;
              color: #6b7280;
              text-transform: uppercase;
              border-bottom: 2px solid #e5e7eb;
            }
            .items-table th.text-right {
              text-align: right;
            }
            .items-table td {
              padding: 12px;
              border-bottom: 1px solid #e5e7eb;
            }
            .items-table td.text-right {
              text-align: right;
            }
            .totals-section {
              margin: 30px 0;
              padding: 20px;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              display: flex;
              justify-content: flex-end;
            }
            .totals-box {
              min-width: 300px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
            }
            .total-row.subtotal {
              color: #6b7280;
            }
            .total-row.total {
              border-top: 2px solid #111827;
              margin-top: 10px;
              padding-top: 15px;
              font-size: 18px;
              font-weight: bold;
            }
            .total-row.balance-due {
              font-size: 18px;
              font-weight: bold;
              color: #dc2626;
            }
            .total-row.paid {
              color: #16a34a;
            }
            .notes-section {
              margin: 25px 0;
              padding: 20px;
              background: #f9fafb;
              border-radius: 8px;
            }
            .notes-section h3 {
              font-size: 12px;
              font-weight: bold;
              color: #6b7280;
              margin-bottom: 10px;
              text-transform: uppercase;
            }
            .notes-section p {
              font-size: 14px;
              color: #111827;
              white-space: pre-wrap;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              font-size: 11px;
              color: #6b7280;
            }
            @media print {
              body { padding: 20px; }
              @page { margin: 0.5in; }
            }
          </style>
        </head>
        <body>
          <!-- Header -->
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
            <div class="invoice-header">
              <h2>${invoice.document_type === 'quotation' ? 'QUOTATION' : invoice.document_type === 'proforma' ? 'PROFORMA INVOICE' : 'INVOICE'}</h2>
              <p class="number">#${invoice.document_type === 'quotation' ? invoice.quotation_number : invoice.document_type === 'proforma' ? invoice.proforma_number : invoice.invoice_number}</p>
              <span class="status-badge status-${invoice.status}">${invoice.status.toUpperCase()}</span>
            </div>
          </div>

          <!-- Customer and Date Info -->
          <div class="invoice-details">
            <!-- Customer -->
            <div class="section">
              <h3>Bill To</h3>
              <p><strong>${invoice.customer?.name || 'N/A'}</strong></p>
              ${invoice.customer?.email ? `<p>${invoice.customer.email}</p>` : ''}
              ${invoice.customer?.phone ? `<p>${invoice.customer.phone}</p>` : ''}
              ${invoice.customer?.address ? `<p style="margin-top: 8px;">${invoice.customer.address}</p>` : ''}
              ${invoice.customer?.city ? `<p>${[invoice.customer.city, invoice.customer.state, invoice.customer.zip_code].filter(Boolean).join(', ')}</p>` : ''}
            </div>

            <!-- Invoice Details -->
            <div class="section">
              <h3>Invoice Details</h3>
              <p><span class="label">Invoice Date:</span> <span class="value">${formatDate(invoice.invoice_date)}</span></p>
              <p><span class="label">Due Date:</span> <span class="value">${formatDate(invoice.due_date)}</span></p>
              ${invoice.po_number ? `<p><span class="label">PO Number:</span> <span class="value">${invoice.po_number}</span></p>` : ''}
            </div>
          </div>

          <!-- Line Items -->
          <table class="items-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th class="text-right">Quantity</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItems.map(item => `
                <tr>
                  <td>${item.line_number}</td>
                  <td>${item.description}</td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">${formatCurrency(Number(item.unit_price))}</td>
                  <td class="text-right"><strong>${formatCurrency(Number(item.amount))}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Totals -->
          <div class="totals-section">
            <div class="totals-box">
              <div class="total-row subtotal">
                <span>Subtotal</span>
                <span>${formatCurrency(Number(invoice.subtotal))}</span>
              </div>
              ${Number(invoice.discount_amount) > 0 ? `
              <div class="total-row subtotal" style="color: #16a34a;">
                <span>Discount</span>
                <span>-${formatCurrency(Number(invoice.discount_amount))}</span>
              </div>
              ` : ''}
              <div class="total-row subtotal">
                <span>Tax (${invoice.tax_rate}%)</span>
                <span>${formatCurrency(Number(invoice.tax_amount))}</span>
              </div>
              <div class="total-row total">
                <span>TOTAL</span>
                <span>${formatCurrency(Number(invoice.total_amount))}</span>
              </div>
              ${Number(invoice.amount_paid) > 0 ? `
              <div class="total-row paid">
                <span>Amount Paid</span>
                <span>-${formatCurrency(Number(invoice.amount_paid))}</span>
              </div>
              <div class="total-row balance-due">
                <span>BALANCE DUE</span>
                <span>${formatCurrency(Number(invoice.total_amount) - Number(invoice.amount_paid))}</span>
              </div>
              ` : ''}
            </div>
          </div>

          <!-- Notes -->
          ${invoice.notes ? `
          <div class="notes-section">
            <h3>Notes</h3>
            <p>${invoice.notes}</p>
          </div>
          ` : ''}

          <!-- Footer -->
          <div class="footer">
            <p>This is a computer-generated document. No signature required.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;

    // Open print dialog in new window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.focus();

      // Wait a moment for content to load, then show print dialog
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleMarkAsSent = async () => {
    setActionLoading('send');
    try {
      const response = await fetch(`/api/invoices/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update invoice');
      }
      
      fetchInvoice();
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      alert(error.message || 'Failed to update invoice');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!confirm('Mark this invoice as paid? This will create accounting journal entries.')) return;
    
    setActionLoading('paid');
    try {
      const response = await fetch(`/api/invoices/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update invoice');
      }
      
      alert('Invoice marked as paid! Journal entry created.');
      fetchInvoice();
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      alert(error.message || 'Failed to mark as paid');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendEmail = async () => {
    if (!invoice?.customer?.email) {
      alert('Customer does not have an email address');
      return;
    }

    setActionLoading('email');
    try {
      const response = await fetch(`/api/invoices/${params.id}/send`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      alert(data.message || 'Invoice sent successfully!');
      fetchInvoice();
    } catch (error: any) {
      console.error('Error sending invoice:', error);
      alert(error.message || 'Failed to send invoice email');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    
    setActionLoading('delete');
    try {
      await supabase
        .from('invoices')
        .delete()
        .eq('id', params.id);
      
      router.push('/dashboard/invoices');
    } catch (error) {
      console.error('Error deleting invoice:', error);
      setActionLoading(null);
    }
  };

  const handleCopyPaymentLink = () => {
    const paymentUrl = `${window.location.origin}/pay?invoice=${params.id}`;
    navigator.clipboard.writeText(paymentUrl);
    alert('Payment link copied to clipboard!');
  };

  const handleConvertToInvoice = async () => {
    if (!invoice) return;
    
    const docType = invoice.document_type === 'quotation' ? 'quotation' : 'proforma invoice';
    if (!confirm(`Convert this ${docType} to a regular invoice? This action cannot be undone.`)) {
      return;
    }

    setActionLoading('convert');
    try {
      const endpoint = invoice.document_type === 'quotation' 
        ? `/api/quotations/${params.id}/convert`
        : `/api/proformas/${params.id}/convert`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to convert');
      }

      alert(`${docType.charAt(0).toUpperCase() + docType.slice(1)} converted to invoice successfully!`);
      // Refresh the page to show updated data
      window.location.reload();
    } catch (error: any) {
      console.error('Convert error:', error);
      alert(error.message || `Failed to convert ${docType}`);
    } finally {
      setActionLoading(null);
    }
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

  const balanceDue = Number(invoice.total_amount) - Number(invoice.amount_paid);

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/invoices">
            <Button variant="ghost" size="sm" className="p-2">
              <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                Invoice {invoice.invoice_number}
              </h1>
              {getStatusBadge(invoice.status)}
            </div>
            <p className="text-sm sm:text-base text-gray-500 mt-0.5 sm:mt-1 truncate">
              {invoice.customer?.name}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {invoice.customer?.email && (
            <Button 
              variant="success" 
              size="sm" 
              onClick={handleSendEmail}
              disabled={actionLoading === 'email'}
              className="text-xs sm:text-sm"
            >
              <EnvelopeIcon className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">{actionLoading === 'email' ? 'Sending...' : 'Send Email'}</span>
              <span className="sm:hidden">Send</span>
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={handlePrint} className="text-xs sm:text-sm">
            <PrinterIcon className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
            <span className="hidden sm:inline">Print / PDF</span>
          </Button>
          
          {/* Convert to Invoice button for Quotations and Proformas */}
          {(invoice.document_type === 'quotation' || invoice.document_type === 'proforma') && 
           invoice.status !== 'converted' && invoice.status !== 'posted' && (
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleConvertToInvoice}
              disabled={actionLoading === 'convert'}
              className="text-xs sm:text-sm bg-[#52b53b] hover:bg-[#52b53b]/90"
            >
              <ArrowPathIcon className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">
                {actionLoading === 'convert' ? 'Converting...' : 'Convert to Invoice'}
              </span>
              <span className="sm:hidden">Convert</span>
            </Button>
          )}
          
          {invoice.status === 'draft' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleMarkAsSent}
              disabled={actionLoading === 'send'}
              className="text-xs sm:text-sm"
            >
              <CheckCircleIcon className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Mark as Sent</span>
            </Button>
          )}
          
          {(invoice.status === 'sent' || invoice.status === 'partial') && invoice.document_type === 'invoice' && (
            <Button 
              variant="success" 
              size="sm" 
              onClick={handleMarkAsPaid}
              disabled={actionLoading === 'paid'}
              className="text-xs sm:text-sm"
            >
              <CheckCircleIcon className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">{actionLoading === 'paid' ? 'Processing...' : 'Mark as Paid'}</span>
            </Button>
          )}
          
          {balanceDue > 0 && invoice.status !== 'draft' && (
            <Button variant="outline" size="sm" onClick={handleCopyPaymentLink} className="text-xs sm:text-sm">
              <CreditCardIcon className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Copy Payment Link</span>
            </Button>
          )}
          
          <Link href={`/dashboard/invoices/${params.id}/edit`}>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm">
              <PencilIcon className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </Link>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDelete}
            disabled={actionLoading === 'delete'}
            className="text-red-600 hover:bg-red-50 text-xs sm:text-sm p-2 sm:px-3"
          >
            <TrashIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Invoice Date</p>
                  <p className="font-medium">{formatDate(invoice.invoice_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Due Date</p>
                  <p className="font-medium">{formatDate(invoice.due_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">PO Number</p>
                  <p className="font-medium">{invoice.po_number || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium capitalize">{invoice.status}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Line Items</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 sm:py-3 px-2 text-xs sm:text-sm font-medium text-gray-500">#</th>
                      <th className="text-left py-2 sm:py-3 px-2 text-xs sm:text-sm font-medium text-gray-500">Description</th>
                      <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm font-medium text-gray-500">Qty</th>
                      <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm font-medium text-gray-500 hidden sm:table-cell">Unit Price</th>
                      <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm font-medium text-gray-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2 sm:py-3 px-2 text-xs sm:text-sm text-gray-500">{item.line_number}</td>
                        <td className="py-2 sm:py-3 px-2 text-xs sm:text-sm">{item.description}</td>
                        <td className="py-2 sm:py-3 px-2 text-right text-xs sm:text-sm">{item.quantity}</td>
                        <td className="py-2 sm:py-3 px-2 text-right text-xs sm:text-sm hidden sm:table-cell">{formatCurrency(Number(item.unit_price))}</td>
                        <td className="py-2 sm:py-3 px-2 text-right font-medium text-xs sm:text-sm">{formatCurrency(Number(item.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t space-y-1.5 sm:space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(Number(invoice.subtotal))}</span>
                </div>
                {Number(invoice.discount_amount) > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-green-600">-{formatCurrency(Number(invoice.discount_amount))}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Tax ({invoice.tax_rate}%)</span>
                  <span>{formatCurrency(Number(invoice.tax_amount))}</span>
                </div>
                <div className="flex justify-between text-base sm:text-lg font-semibold pt-1.5 sm:pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(Number(invoice.total_amount))}</span>
                </div>
                {Number(invoice.amount_paid) > 0 && (
                  <>
                    <div className="flex justify-between text-xs sm:text-sm text-green-600">
                      <span>Amount Paid</span>
                      <span>-{formatCurrency(Number(invoice.amount_paid))}</span>
                    </div>
                    <div className="flex justify-between text-base sm:text-lg font-semibold text-red-600">
                      <span>Balance Due</span>
                      <span>{formatCurrency(balanceDue)}</span>
                    </div>
                  </>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Notes */}
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                <p className="font-medium">{invoice.customer?.name}</p>
                {invoice.customer?.email && (
                  <p className="text-sm text-gray-500">{invoice.customer.email}</p>
                )}
                {invoice.customer?.phone && (
                  <p className="text-sm text-gray-500">{invoice.customer.phone}</p>
                )}
                {invoice.customer?.address && (
                  <p className="text-sm text-gray-500 mt-2">
                    {invoice.customer.address}
                    {invoice.customer.city && <br />}
                    {[invoice.customer.city, invoice.customer.state, invoice.customer.zip_code]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
              </div>
              <Link href={`/dashboard/customers/${invoice.customer_id}`}>
                <Button variant="outline" size="sm" className="mt-4 w-full">
                  View Customer
                </Button>
              </Link>
            </CardBody>
          </Card>
          {/* Related Booking */}
          {relatedBooking && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DocumentDuplicateIcon className="h-5 w-5 text-gray-400" />
                  Related Booking
                </CardTitle>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Booking Number</p>
                    <p className="font-semibold text-gray-900">{relatedBooking.booking_number}</p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${relatedBooking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : ''}
                      ${relatedBooking.status === 'deposit_paid' ? 'bg-yellow-100 text-yellow-800' : ''}
                      ${relatedBooking.status === 'fully_paid' ? 'bg-green-100 text-green-800' : ''}
                      ${relatedBooking.status === 'completed' ? 'bg-green-500 text-white' : ''}
                      ${relatedBooking.status === 'cancelled' ? 'bg-gray-200 text-gray-600' : ''}
                      ${!['confirmed', 'deposit_paid', 'fully_paid', 'completed', 'cancelled'].includes(relatedBooking.status) ? 'bg-gray-100 text-gray-800' : ''}
                    `}>
                      {relatedBooking.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Type</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">{relatedBooking.booking_type}</p>
                  </div>

                  {/* Tour Package Details */}
                  {relatedBooking.tour_package && (
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Tour Package</p>
                      <p className="text-sm font-semibold text-gray-900">{relatedBooking.tour_package.name}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {relatedBooking.tour_package.duration_days} days, {relatedBooking.tour_package.duration_nights} nights
                      </p>
                    </div>
                  )}

                  {/* Hotel Details */}
                  {relatedBooking.hotel && (
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Hotel</p>
                      <p className="text-sm font-semibold text-gray-900">{relatedBooking.hotel.name}</p>
                      {relatedBooking.hotel.star_rating && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-yellow-500 text-xs">
                            {'★'.repeat(relatedBooking.hotel.star_rating)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vehicle Details */}
                  {relatedBooking.vehicle && (
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Vehicle</p>
                      <p className="text-sm font-semibold text-gray-900">{relatedBooking.vehicle.vehicle_type}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{relatedBooking.vehicle.registration_number}</p>
                    </div>
                  )}

                  {/* Travel Dates */}
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-2">Travel Dates</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500 block">Start</span>
                        <span className="font-medium text-gray-900">
                          {new Date(relatedBooking.travel_start_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">End</span>
                        <span className="font-medium text-gray-900">
                          {new Date(relatedBooking.travel_end_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Guests */}
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Guests</p>
                    <p className="text-sm text-gray-900">
                      {relatedBooking.num_adults} Adult{relatedBooking.num_adults !== 1 ? 's' : ''}
                      {relatedBooking.num_children > 0 && `, ${relatedBooking.num_children} Child${relatedBooking.num_children !== 1 ? 'ren' : ''}`}
                    </p>
                  </div>

                  {/* Booking Financials */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total</span>
                        <span className="font-semibold text-gray-900">
                          {relatedBooking.currency} {relatedBooking.total.toFixed(2)}
                        </span>
                      </div>
                      {relatedBooking.amount_paid > 0 && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Paid</span>
                            <span className="font-semibold text-green-600">
                              {relatedBooking.currency} {relatedBooking.amount_paid.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Balance</span>
                            <span className="font-semibold text-amber-600">
                              {relatedBooking.currency} {(relatedBooking.total - relatedBooking.amount_paid).toFixed(2)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <Link href={`/dashboard/bookings/${relatedBooking.id}`}>
                    <Button variant="outline" size="sm" className="mt-4 w-full">
                      View Booking Details
                    </Button>
                  </Link>
                </div>
              </CardBody>
            </Card>
          )}
          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Amount</span>
                  <span className="font-medium">{formatCurrency(Number(invoice.total_amount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="font-medium text-green-600">{formatCurrency(Number(invoice.amount_paid))}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">Balance Due</span>
                  <span className={`font-semibold ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(balanceDue)}
                  </span>
                </div>
              </div>

              {balanceDue > 0 && invoice.status !== 'draft' && (
                <Link href={`/dashboard/invoices/${params.id}/payment`}>
                  <Button className="w-full mt-4">
                    <CreditCardIcon className="w-4 h-4 mr-2" />
                    Record Payment
                  </Button>
                </Link>
              )}

              {balanceDue === 0 && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg flex items-center gap-2 text-green-700">
                  <CheckCircleIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">Paid in Full</span>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Payment History */}
          {payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{formatCurrency(Number(payment.amount))}</p>
                        <p className="text-sm text-gray-500">{formatDate(payment.payment_date)}</p>
                        <p className="text-xs text-gray-400 capitalize">{payment.payment_method.replace('_', ' ')}</p>
                      </div>
                      {payment.reference_number && (
                        <span className="text-xs text-gray-500">#{payment.reference_number}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

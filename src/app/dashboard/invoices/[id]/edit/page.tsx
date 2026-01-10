'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter, convertCurrency } from '@/lib/currency';
import { CurrencySelect } from '@/components/ui';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Customer, Product, Invoice, InvoiceLine, InvoiceStatus } from '@/types/database';

interface InvoiceLineInput {
  id?: string;
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
}

interface InvoiceFormData {
  customer_id: string;
  invoice_date: string;
  due_date: string;
  payment_terms: number;
  po_number: string;
  notes: string;
  currency: string;
  lines: InvoiceLineInput[];
}

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [taxRate] = useState(0.0625); // MA sales tax

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    defaultValues: {
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      payment_terms: 30,
      lines: [
        {
          product_id: '',
          description: '',
          quantity: 1,
          unit_price: 0,
          discount_percent: 0,
          tax_rate: taxRate,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  const watchLines = watch('lines');
  const watchPaymentTerms = watch('payment_terms');
  const watchCurrency = watch('currency');

  useEffect(() => {
    loadData();
  }, [resolvedParams.id]);

  useEffect(() => {
    // Update due date when payment terms change
    const invoiceDate = watch('invoice_date');
    if (invoiceDate && watchPaymentTerms) {
      const due = new Date(invoiceDate);
      due.setDate(due.getDate() + watchPaymentTerms);
      setValue('due_date', due.toISOString().split('T')[0]);
    }
  }, [watchPaymentTerms]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load customers and products
      const [customersRes, productsRes] = await Promise.all([
        supabase.from('customers').select('*').eq('is_active', true).order('name'),
        supabase.from('products').select('*').eq('is_active', true).order('name'),
      ]);

      setCustomers(customersRes.data || []);
      setProducts(productsRes.data || []);

      // Load invoice data
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', resolvedParams.id)
        .single();

      if (invoiceError) throw invoiceError;

      // Load invoice lines
      const { data: linesData, error: linesError } = await supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', resolvedParams.id)
        .order('line_number');

      if (linesError) throw linesError;

      setInvoice(invoiceData);

      // Populate form with existing data
      const formData = {
        customer_id: invoiceData.customer_id,
        invoice_date: invoiceData.invoice_date,
        due_date: invoiceData.due_date,
        payment_terms: invoiceData.payment_terms,
        po_number: invoiceData.po_number || '',
        notes: invoiceData.notes || '',
        currency: invoiceData.currency || 'USD',
        lines: linesData.map((line: InvoiceLine) => ({
          id: line.id,
          product_id: line.product_id || '',
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_percent: line.discount_percent,
          tax_rate: line.tax_rate,
        })),
      };

      // Wait for state to update then reset form
      setTimeout(() => {
        reset(formData);
      }, 100);
    } catch (error) {
      console.error('Failed to load invoice data:', error);
      toast.error('Failed to load invoice data');
      router.push('/dashboard/invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleProductChange = async (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`lines.${index}.description`, product.name);
      
      // Check if currency conversion is needed
      const invoiceCurrency = watchCurrency || 'USD';
      const productCurrency = product.currency || 'USD';
      
      let convertedPrice = product.unit_price;
      
      if (productCurrency !== invoiceCurrency) {
        // Convert the product price to invoice currency
        const converted = await convertCurrency(
          supabase,
          product.unit_price,
          productCurrency as any,
          invoiceCurrency as any
        );
        
        if (converted !== null) {
          convertedPrice = converted;
        } else {
          // If conversion fails, show a warning
          toast.error(`Unable to convert from ${productCurrency} to ${invoiceCurrency}. Using original price.`);
        }
      }
      
      setValue(`lines.${index}.unit_price`, convertedPrice);
      setValue(`lines.${index}.tax_rate`, product.is_taxable ? taxRate : 0);
    }
  };

  const calculateLineTotal = (line: InvoiceLineInput) => {
    const subtotal = line.quantity * line.unit_price;
    const discount = subtotal * (line.discount_percent / 100);
    return subtotal - discount;
  };

  const calculateLineTax = (line: InvoiceLineInput) => {
    return calculateLineTotal(line) * line.tax_rate;
  };

  const calculateSubtotal = () => {
    return watchLines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
  };

  const calculateTax = () => {
    return watchLines.reduce((sum, line) => sum + calculateLineTax(line), 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, watchCurrency as any || 'USD');
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!invoice) return;

    // Show confirmation for paid status
    if (newStatus === 'paid') {
      if (!confirm('Mark this invoice as paid? This will create accounting journal entries.')) {
        return;
      }
    }

    setStatusChanging(true);
    try {
      const response = await fetch(`/api/invoices/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update invoice status');
      }

      // Update local invoice state
      setInvoice({ ...invoice, status: newStatus as InvoiceStatus });
      
      if (newStatus === 'paid' || newStatus === 'partial') {
        toast.success('Invoice status updated! Journal entry created.', { duration: 4000 });
      } else {
        toast.success('Invoice status updated successfully!');
      }

      // Reload invoice data to get fresh data
      loadData();
    } catch (error: any) {
      console.error('Error updating invoice status:', error);
      toast.error(error.message || 'Failed to update invoice status');
    } finally {
      setStatusChanging(false);
    }
  };

  const onSubmit = async (data: InvoiceFormData) => {
    if (data.lines.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    setSaving(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Calculate totals
      const subtotal = calculateSubtotal();
      const tax_amount = calculateTax();
      const total = calculateTotal();

      // Get AR account
      const { data: arAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('code', '1200')
        .single();

      // Update invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          customer_id: data.customer_id,
          invoice_date: data.invoice_date,
          due_date: data.due_date,
          payment_terms: data.payment_terms,
          po_number: data.po_number || null,
          notes: data.notes || null,
          currency: data.currency || 'USD',
          subtotal,
          tax_amount,
          total,
          ar_account_id: arAccount?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resolvedParams.id);

      if (invoiceError) throw invoiceError;

      // Delete existing invoice lines
      const { error: deleteError } = await supabase
        .from('invoice_lines')
        .delete()
        .eq('invoice_id', resolvedParams.id);

      if (deleteError) throw deleteError;

      // Create new invoice lines
      const invoiceLines = data.lines.map((line, index) => ({
        invoice_id: resolvedParams.id,
        line_number: index + 1,
        product_id: line.product_id || null,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_percent: line.discount_percent,
        discount_amount: (line.quantity * line.unit_price) * (line.discount_percent / 100),
        tax_rate: line.tax_rate,
        tax_amount: calculateLineTax(line),
        line_total: calculateLineTotal(line),
      }));

      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(invoiceLines);

      if (linesError) throw linesError;

      // If invoice was posted, we need to update the journal entry
      if (invoice?.journal_entry_id) {
        // This would require recalculating and updating the journal entry
        // For now, we'll just show a warning
        toast.success('Invoice updated successfully! Note: Journal entry may need manual adjustment.', {
          duration: 5000,
        });
      } else {
        toast.success('Invoice updated successfully!');
      }

      router.push(`/dashboard/invoices/${resolvedParams.id}`);
    } catch (error: any) {
      console.error('Failed to update invoice:', error);
      toast.error(error.message || 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-600">Invoice not found</p>
          <Link href="/dashboard/invoices" className="btn-primary mt-4">
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  // Check if invoice can be edited
  const canEdit = invoice.status === 'draft' || invoice.status === 'sent';
  
  if (!canEdit) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/invoices/${resolvedParams.id}`} className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cannot Edit Invoice</h1>
            <p className="text-gray-500 mt-1">This invoice cannot be edited because it has been {invoice.status}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center py-12">
            <p className="text-gray-600 mb-4">
              Only draft or sent invoices can be edited. This invoice has status: <strong>{invoice.status}</strong>
            </p>
            <Link href={`/dashboard/invoices/${resolvedParams.id}`} className="btn-primary">
              Back to Invoice
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/invoices/${resolvedParams.id}`} className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Invoice</h1>
            <p className="text-gray-500 mt-1">
              Invoice #{invoice.invoice_number}
            </p>
          </div>
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select
            value={invoice.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={statusChanging}
            className="input min-w-[140px]"
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="void">Void</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Customer and dates */}
        <div className="card">
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="form-group md:col-span-2">
                <label className="label">Customer *</label>
                <select
                  {...register('customer_id', { required: 'Customer is required' })}
                  className={`input ${errors.customer_id ? 'input-error' : ''}`}
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                {errors.customer_id && (
                  <p className="form-error">{errors.customer_id.message}</p>
                )}
              </div>

              <div className="form-group">
                <label className="label">Invoice Date *</label>
                <input
                  type="date"
                  {...register('invoice_date', { required: 'Invoice date is required' })}
                  className={`input ${errors.invoice_date ? 'input-error' : ''}`}
                />
              </div>

              <div className="form-group">
                <label className="label">Payment Terms</label>
                <select {...register('payment_terms', { valueAsNumber: true })} className="input">
                  <option value={15}>Net 15</option>
                  <option value={30}>Net 30</option>
                  <option value={45}>Net 45</option>
                  <option value={60}>Net 60</option>
                  <option value={0}>Due on Receipt</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label">Due Date *</label>
                <input
                  type="date"
                  {...register('due_date', { required: 'Due date is required' })}
                  className={`input ${errors.due_date ? 'input-error' : ''}`}
                />
              </div>

              <div className="form-group">
                <label className="label">PO Number</label>
                <input
                  type="text"
                  {...register('po_number')}
                  className="input"
                  placeholder="Optional"
                />
              </div>

              <div className="form-group">
                <label className="label">Currency *</label>
                <CurrencySelect
                  value={watchCurrency || 'USD'}
                  onChange={(e) => setValue('currency', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Line Items</h2>
          </div>
          <div className="card-body space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-12 gap-3 items-end p-4 bg-gray-50 rounded-lg"
              >
                <div className="col-span-12 md:col-span-2">
                  <label className="label text-xs">Product</label>
                  <select
                    {...register(`lines.${index}.product_id`)}
                    onChange={(e) => handleProductChange(index, e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">Custom item</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-12 md:col-span-3">
                  <label className="label text-xs">Description *</label>
                  <input
                    type="text"
                    {...register(`lines.${index}.description`, { required: true })}
                    className="input text-sm"
                    placeholder="Description"
                  />
                </div>

                <div className="col-span-4 md:col-span-1">
                  <label className="label text-xs">Qty</label>
                  <input
                    type="number"
                    step="1"
                    {...register(`lines.${index}.quantity`, { valueAsNumber: true, min: 1 })}
                    className="input text-sm"
                  />
                </div>

                <div className="col-span-4 md:col-span-2">
                  <label className="label text-xs">Unit Price</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register(`lines.${index}.unit_price`, { valueAsNumber: true, min: 0 })}
                    className="input text-sm"
                  />
                </div>

                <div className="col-span-4 md:col-span-1">
                  <label className="label text-xs">Disc %</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register(`lines.${index}.discount_percent`, { valueAsNumber: true, min: 0, max: 100 })}
                    className="input text-sm"
                  />
                </div>

                <div className="col-span-6 md:col-span-2">
                  <label className="label text-xs">Line Total</label>
                  <div className="input bg-gray-100 text-sm">
                    {formatCurrency(calculateLineTotal(watchLines[index] || {
                      quantity: 0,
                      unit_price: 0,
                      discount_percent: 0,
                    }))}
                  </div>
                </div>

                <div className="col-span-6 md:col-span-1 flex justify-end">
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="btn-ghost text-red-600 hover:bg-red-50 p-2"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                append({
                  product_id: '',
                  description: '',
                  quantity: 1,
                  unit_price: 0,
                  discount_percent: 0,
                  tax_rate: taxRate,
                })
              }
              className="btn-secondary"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Line
            </button>
          </div>
        </div>

        {/* Notes and totals */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-body">
              <label className="label">Notes</label>
              <textarea
                {...register('notes')}
                className="input min-h-[120px]"
                placeholder="Notes to appear on the invoice..."
              />
            </div>
          </div>

          <div className="card">
            <div className="card-body space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax (6.25%)</span>
                <span className="font-medium">{formatCurrency(calculateTax())}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">
                  {formatCurrency(calculateTotal())}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href={`/dashboard/invoices/${resolvedParams.id}`} className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { CurrencySelect } from '@/components/ui';
import { formatCurrency as currencyFormatter, convertCurrency } from '@/lib/currency';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Customer, Product, DocumentType } from '@/types/database';

interface InvoiceLineInput {
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
}

interface InvoiceFormData {
  customer_id: string;
  document_type: DocumentType;
  currency: 'USD' | 'EUR' | 'GBP' | 'UGX';
  invoice_date: string;
  due_date: string;
  payment_terms: number;
  po_number: string;
  notes: string;
  lines: InvoiceLineInput[];
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [taxRate] = useState(0.0625); // MA sales tax

  // Get query parameters from URL (for booking-generated invoices)
  const bookingId = searchParams.get('booking_id');
  const prefilledCustomerId = searchParams.get('customer_id');
  const prefilledCurrency = searchParams.get('currency') as 'USD' | 'EUR' | 'GBP' | 'UGX' | null;
  const prefilledDescription = searchParams.get('description');
  const prefilledAmount = searchParams.get('amount');
  const prefilledInvoiceType = searchParams.get('invoice_type');
  const prefilledDeposit = searchParams.get('deposit_amount');
  const prefilledBalance = searchParams.get('balance_amount');
  const prefilledDocType = searchParams.get('type') as DocumentType | null;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    defaultValues: {
      document_type: prefilledDocType || 'invoice',
      currency: prefilledCurrency || 'USD',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      payment_terms: 30,
      lines: [
        {
          product_id: '',
          description: prefilledDescription || '',
          quantity: 1,
          unit_price: prefilledAmount ? parseFloat(prefilledAmount) : 0,
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
  const watchCustomerId = watch('customer_id');
  const watchCurrency = watch('currency');

  useEffect(() => {
    loadData();
  }, []);

  // Pre-fill form when coming from booking page
  useEffect(() => {
    if (prefilledCustomerId && customers.length > 0) {
      setValue('customer_id', prefilledCustomerId);
    }
  }, [prefilledCustomerId, customers]);

  useEffect(() => {
    // Update due date when payment terms change
    const invoiceDate = watch('invoice_date');
    if (invoiceDate && watchPaymentTerms) {
      const due = new Date(invoiceDate);
      due.setDate(due.getDate() + watchPaymentTerms);
      setValue('due_date', due.toISOString().split('T')[0]);
    }
  }, [watchPaymentTerms, watch('invoice_date')]);

  useEffect(() => {
    // Auto-select customer's preferred currency
    if (watchCustomerId) {
      const customer = customers.find(c => c.id === watchCustomerId);
      if (customer && customer.currency) {
        setValue('currency', customer.currency as 'USD' | 'EUR' | 'GBP' | 'UGX');
      }
    }
  }, [watchCustomerId, customers]);

  const loadData = async () => {
    try {
      const [customersRes, productsRes] = await Promise.all([
        supabase.from('customers').select('*').eq('is_active', true).order('name'),
        supabase.from('products').select('*').eq('is_active', true).order('name'),
      ]);

      setCustomers(customersRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
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
    const currency = watchCurrency || 'USD';
    return currencyFormatter(amount, currency as any);
  };

  const onSubmit = async (data: InvoiceFormData) => {
    if (data.lines.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    setLoading(true);
    try {
      // Use the API route to create invoice with proper document type handling
      const payload = {
        ...data,
        ...(bookingId && { booking_id: bookingId }), // Include booking_id if present
      };

      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create invoice');
      }

      const result = await response.json();
      toast.success(`${data.document_type === 'quotation' ? 'Quotation' : data.document_type === 'proforma' ? 'Proforma Invoice' : 'Invoice'} created successfully!`);
      router.push(`/dashboard/invoices/${result.data.id}`);
    } catch (error: any) {
      console.error('Failed to create invoice:', error);
      toast.error(error.message || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/invoices" className="btn-ghost p-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Invoice</h1>
          <p className="text-gray-500 mt-1">Create a new customer invoice</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Booking Info Banner */}
        {bookingId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Creating invoice for Booking #{bookingId.substring(0, 8)}
                </p>
                <p className="text-xs text-blue-700 mt-0.5">
                  {prefilledInvoiceType === 'deposit' && `Deposit invoice (${prefilledDeposit})`}
                  {prefilledInvoiceType === 'balance' && `Balance invoice (${prefilledBalance})`}
                  {prefilledInvoiceType === 'full' && 'Full amount invoice'}
                </p>
              </div>
            </div>
          </div>
        )}

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

              <div className="form-group md:col-span-2">
                <label className="label">Document Type *</label>
                <select
                  {...register('document_type', { required: 'Document type is required' })}
                  className={`input ${errors.document_type ? 'input-error' : ''}`}
                >
                  <option value="invoice">Invoice</option>
                  <option value="quotation">Quotation</option>
                  <option value="proforma">Proforma Invoice</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Select the type of document to generate
                </p>
              </div>

              <div className="form-group">
                <label className="label">Currency *</label>
                <CurrencySelect
                  value={watch('currency') || 'USD'}
                  onChange={(e) => setValue('currency', e.target.value as any)}
                  name="currency"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Auto-selected from customer preference
                </p>
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
          <Link href="/dashboard/invoices" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}


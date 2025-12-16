'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { CurrencySelect } from '@/components/ui';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Customer, Product } from '@/types/database';

interface ReceiptLineInput {
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
}

interface ReceiptFormData {
  customer_id: string;
  receipt_date: string;
  payment_method: string;
  reference_invoice_number: string;
  notes: string;
  currency: string;
  lines: ReceiptLineInput[];
}

export default function NewReceiptPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [taxRate] = useState(0.0625); // MA sales tax

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReceiptFormData>({
    defaultValues: {
      receipt_date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
      currency: 'USD',
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
  const watchCurrency = watch('currency');
  const watchCustomerId = watch('customer_id');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [customersRes, productsRes] = await Promise.all([
        supabase.from('customers').select('*').eq('is_active', true).order('name'),
        supabase.from('products').select('*').eq('is_active', true).order('name'),
      ]);

      setCustomers(customersRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
    

  // Auto-select currency from customer
  useEffect(() => {
    if (watchCustomerId) {
      const customer = customers.find(c => c.id === watchCustomerId);
      if (customer?.currency) {
        setValue('currency', customer.currency);
      }
    }
  }, [watchCustomerId, customers, setValue]);  console.error('Failed to load data:', error);
    }
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`lines.${index}.description`, product.name);
      setValue(`lines.${index}.unit_price`, product.unit_price);
      setValue(`lines.${index}.tax_rate`, product.is_taxable ? taxRate : 0);
    }
  };

  const calculateLineTotal = (line: ReceiptLineInput) => {
    const subtotal = line.quantity * line.unit_price;
    const discount = subtotal * (line.discount_percent / 100);
    return subtotal - discount;
  };

  const calculateLineTax = (line: ReceiptLineInput) => {
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

  const onSubmit = async (data: ReceiptFormData) => {
    if (data.lines.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate receipt number
      const { data: receiptNumber, error: numError } = await supabase.rpc('generate_receipt_number');
      if (numError) throw numError;

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

      // Create receipt
      const { data: receipt, error: receiptError } = await supabase
        .from('invoices')
        .insert({
          receipt_number: receiptNumber,
          invoice_number: `TEMP-${Date.now()}`, // Temporary placeholder
          document_type: 'receipt',
          customer_id: data.customer_id,
          invoice_date: data.receipt_date,
          due_date: data.receipt_date, // Same as receipt date for receipts
          payment_terms: data.payment_method === 'cash' ? 0 : 30,
          notes: data.notes || null,
          currency: data.currency || 'USD',
          subtotal,
          tax_amount,
          discount_amount: 0,
          total,
          amount_paid: total, // Receipts are always fully paid
          status: 'paid',
          ar_account_id: arAccount?.id,
          created_by: user.id,
        })
        .select()
        .single();

      if (receiptError) throw receiptError;

      // Create receipt lines
      const receiptLines = data.lines.map((line, index) => ({
        invoice_id: receipt.id,
        line_number: index + 1,
        product_id: line.product_id || null,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_percent: line.discount_percent,
        discount_amount: calculateLineTotal(line) - (line.quantity * line.unit_price),
        tax_rate: line.tax_rate,
        tax_amount: calculateLineTax(line),
        line_total: calculateLineTotal(line),
      }));

      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(receiptLines);

      if (linesError) throw linesError;

      toast.success('Receipt created successfully!');
      router.push(`/dashboard/receipts/${receipt.id}`);
    } catch (error: any) {
      console.error('Failed to create receipt:', error);
      toast.error(error.message || 'Failed to create receipt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/receipts" className="btn-ghost p-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Receipt</h1>
          <p className="text-gray-500 mt-1">Create a payment receipt for customer</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Receipt Details */}
        <div className="card">
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="label">Receipt Date *</label>
                <input
                  type="date"
                  {...register('receipt_date', { required: 'Receipt date is required' })}
                  className={`input ${errors.receipt_date ? 'input-error' : ''}`}
                />
              </div>

              <div className="form-group">
                <label className="label">Payment Method *</label>
                <select {...register('payment_method')} className="input">
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="stripe">Stripe</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label">Currency *</label>
                <CurrencySelect
                  value={watchCurrency || 'USD'}
                  onChange={(e) => setValue('currency', e.target.value)}
                />
              </div>

              <div className="form-group md:col-span-2">
                <label className="label">Related Invoice Number (Optional)</label>
                <input
                  type="text"
                  {...register('reference_invoice_number')}
                  className="input"
                  placeholder="e.g., INV-2025-00001"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Reference the invoice this receipt is for (if applicable)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="card-title">Line Items</h3>
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
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Line
            </button>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium text-gray-700">Item {index + 1}</span>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="label text-sm">Product/Service</label>
                      <select
                        {...register(`lines.${index}.product_id`)}
                        onChange={(e) => handleProductChange(index, e.target.value)}
                        className="input input-sm"
                      >
                        <option value="">Select or enter manually</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} - {formatCurrency(product.unit_price)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="label text-sm">Description *</label>
                      <input
                        {...register(`lines.${index}.description`, { required: true })}
                        className="input input-sm"
                        placeholder="Item description"
                      />
                    </div>

                    <div className="form-group">
                      <label className="label text-sm">Quantity *</label>
                      <input
                        type="number"
                        step="0.01"
                        {...register(`lines.${index}.quantity`, { required: true, min: 0.01 })}
                        className="input input-sm"
                      />
                    </div>

                    <div className="form-group">
                      <label className="label text-sm">Unit Price *</label>
                      <input
                        type="number"
                        step="0.01"
                        {...register(`lines.${index}.unit_price`, { required: true, min: 0 })}
                        className="input input-sm"
                      />
                    </div>

                    <div className="form-group">
                      <label className="label text-sm">Discount %</label>
                      <input
                        type="number"
                        step="0.01"
                        {...register(`lines.${index}.discount_percent`)}
                        className="input input-sm"
                        placeholder="0.00"
                      />
                    </div>

                    <div className="form-group">
                      <label className="label text-sm">Tax Rate</label>
                      <input
                        type="number"
                        step="0.0001"
                        {...register(`lines.${index}.tax_rate`)}
                        className="input input-sm"
                        placeholder="0.0625"
                      />
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm text-gray-600">Line Total: </span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(calculateLineTotal(watchLines[index]) + calculateLineTax(watchLines[index]))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="card">
          <div className="card-body">
            <div className="flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-medium">{formatCurrency(calculateTax())}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="text-lg font-semibold text-green-600">Total Amount Paid:</span>
                  <span className="text-lg font-bold text-green-600">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <div className="card-body">
            <div className="form-group">
              <label className="label">Notes</label>
              <textarea
                {...register('notes')}
                rows={4}
                className="input"
                placeholder="Additional notes about this receipt..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard/receipts" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating...' : 'Create Receipt'}
          </button>
        </div>
      </form>
    </div>
  );
}


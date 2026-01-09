'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { CurrencySelect } from '@/components/ui';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createReceiptJournalEntry } from '@/lib/accounting/journal-entry-helpers';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Customer, Product } from '@/types/database';

interface ReceiptLineInput {
  product_id: string;
  product_name?: string; // For display only
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
  amount_paid: number;
  lines: ReceiptLineInput[];
}

interface CustomerInvoice {
  id: string;
  invoice_number: string;
  total: number;
  amount_paid: number;
  balance_due: number;
  invoice_date: string;
  status: string;
}

export default function NewReceiptPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [isManualInvoiceEntry, setIsManualInvoiceEntry] = useState(false);
  const [taxRate] = useState(0.0625); // MA sales tax
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    USD: 1,
    EUR: 1,
    GBP: 1,
    UGX: 1,
  });
  const [previousCurrency, setPreviousCurrency] = useState('USD');

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
      amount_paid: 0,
      lines: [
        {
          product_id: '',
          product_name: '',
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
    fetchExchangeRates();
  }, []);

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch('/api/exchange-rates');
      const result = await response.json();
      if (result.data && Array.isArray(result.data)) {
        // Convert array to object with currency codes as keys
        const ratesMap: Record<string, number> = {
          USD: 1, // Base currency
        };
        
        // Get the most recent rate for each currency
        const latestRates = result.data.reduce((acc: any, rate: any) => {
          if (!acc[rate.to_currency] || new Date(rate.effective_date) > new Date(acc[rate.to_currency].effective_date)) {
            acc[rate.to_currency] = rate;
          }
          return acc;
        }, {});
        
        // Build rates map (USD to each currency)
        Object.values(latestRates).forEach((rate: any) => {
          if (rate.from_currency === 'USD') {
            ratesMap[rate.to_currency] = parseFloat(rate.rate);
          }
        });
        
        console.log('Exchange rates loaded:', ratesMap);
        setExchangeRates(ratesMap);
      }
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
    }
  };

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

  const fetchCustomerInvoices = async (customerId: string) => {
    try {
      console.log('Fetching invoices for customer:', customerId);
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, total, amount_paid, invoice_date, status')
        .eq('customer_id', customerId)
        .eq('document_type', 'invoice')
        .in('status', ['sent', 'partial', 'overdue'])
        .order('invoice_date', { ascending: false })
        .limit(20);

      if (error) throw error;

      console.log('Fetched invoices:', data);

      const invoicesWithBalance = (data || []).map(inv => ({
        ...inv,
        balance_due: Number(inv.total) - Number(inv.amount_paid || 0),
      })).filter(inv => inv.balance_due > 0);

      console.log('Invoices with balance:', invoicesWithBalance);
      setCustomerInvoices(invoicesWithBalance);
    } catch (error) {
      console.error('Failed to fetch customer invoices:', error);
      setCustomerInvoices([]);
    }
  };

  // Auto-select currency from customer and load their invoices
  useEffect(() => {
    if (watchCustomerId) {
      const customer = customers.find(c => c.id === watchCustomerId);
      if (customer?.currency) {
        setValue('currency', customer.currency);
      }
      // Load customer's unpaid/partial invoices
      fetchCustomerInvoices(watchCustomerId);
    } else {
      setCustomerInvoices([]);
    }
  }, [watchCustomerId, customers, setValue]);

  const handleInvoiceSelect = async (invoiceNumber: string) => {
    if (!invoiceNumber || invoiceNumber === 'MANUAL') {
      // Clear line items for manual entry
      setValue('lines', [{
        product_id: '',
        product_name: '',
        description: '',
        quantity: 1,
        unit_price: 0,
        discount_percent: 0,
        tax_rate: taxRate,
      }]);
      setValue('amount_paid', 0);
      return;
    }

    try {
      // Fetch invoice with line items
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          total,
          amount_paid,
          subtotal,
          tax_amount,
          discount_amount,
          currency,
          invoice_lines (
            id,
            line_number,
            product_id,
            description,
            quantity,
            unit_price,
            discount_percent,
            discount_amount,
            tax_rate,
            tax_amount,
            line_total
          )
        `)
        .eq('invoice_number', invoiceNumber)
        .single();

      if (invoiceError) throw invoiceError;

      console.log('Fetched invoice details:', invoiceData);

      // Calculate balance due
      const balanceDue = Number(invoiceData.total) - Number(invoiceData.amount_paid || 0);

      // Update currency if different
      if (invoiceData.currency) {
        setValue('currency', invoiceData.currency);
      }

      // Populate line items from invoice
      const invoiceLines = (invoiceData.invoice_lines || [])
        .sort((a: any, b: any) => a.line_number - b.line_number)
        .map((line: any) => {
          // Look up product name if product_id exists
          let productName = '';
          if (line.product_id) {
            const product = products.find(p => p.id === line.product_id);
            productName = product?.name || '';
          }
          return {
            product_id: line.product_id || '',
            product_name: productName,
            description: line.description,
            quantity: Number(line.quantity),
            unit_price: Number(line.unit_price),
            discount_percent: Number(line.discount_percent || 0),
            tax_rate: Number(line.tax_rate || 0),
          };
        });

      if (invoiceLines.length > 0) {
        setValue('lines', invoiceLines);
      }

      // Set amount paid to balance due
      setValue('amount_paid', balanceDue);

      toast.success(`Loaded ${invoiceLines.length} item(s) from invoice`);
    } catch (error: any) {
      console.error('Failed to fetch invoice details:', error);
      toast.error('Failed to load invoice details');
    }
  };

  const handleProductChange = (index: number, productName: string) => {
    if (!productName) {
      // Manual entry - clear fields for user to enter
      setValue(`lines.${index}.product_id`, '');
      setValue(`lines.${index}.product_name`, '');
      setValue(`lines.${index}.description`, '');
      setValue(`lines.${index}.unit_price`, 0);
      setValue(`lines.${index}.tax_rate`, taxRate);
      return;
    }
    
    // Try to find product by name
    const product = products.find((p) => p.name === productName);
    if (product) {
      // Get current currency value directly from watch
      const currentCurrency = watch('currency') || 'USD';
      
      // Convert product price from USD to current currency
      const usdRate = exchangeRates['USD'] || 1;
      const currentRate = exchangeRates[currentCurrency] || 1;
      const conversionFactor = currentRate / usdRate;
      const convertedPrice = product.unit_price * conversionFactor;
      
      console.log('Product selected:', {
        product: product.name,
        basePrice: product.unit_price,
        currentCurrency,
        usdRate,
        currentRate,
        conversionFactor,
        convertedPrice: Math.round(convertedPrice * 100) / 100
      });
      
      setValue(`lines.${index}.product_id`, product.id);
      setValue(`lines.${index}.product_name`, product.name);
      setValue(`lines.${index}.description`, product.name);
      setValue(`lines.${index}.unit_price`, Math.round(convertedPrice * 100) / 100);
      setValue(`lines.${index}.tax_rate`, product.is_taxable ? taxRate : 0);
    } else {
      // If not found, treat as manual entry
      setValue(`lines.${index}.product_id`, '');
      setValue(`lines.${index}.product_name`, productName);
      setValue(`lines.${index}.description`, productName);
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
      
      // Use the amount paid from form, default to total if not specified
      const amountPaid = data.amount_paid && data.amount_paid > 0 ? data.amount_paid : total;
      
      // Determine status based on payment
      const status = amountPaid >= total ? 'paid' : 'partial';

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
          reference_invoice_number: data.reference_invoice_number || null,
          notes: data.notes || null,
          currency: data.currency || 'USD',
          subtotal,
          tax_amount,
          discount_amount: 0,
          total,
          amount_paid: amountPaid,
          status: status,
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

      // Create journal entry for receipt (Debit: Cash, Credit: AR)
      const journalResult = await createReceiptJournalEntry(
        supabase,
        {
          id: receipt.id,
          receipt_number: receipt.receipt_number,
          receipt_date: data.receipt_date,
          total,
          payment_method: data.payment_method,
        },
        user.id
      );

      if (!journalResult.success) {
        console.error('Failed to create journal entry for receipt:', journalResult.error);
        // Don't fail receipt creation, just log the error
      }

      // Update related invoice if reference exists and matches a system invoice
      if (data.reference_invoice_number && data.reference_invoice_number.trim() !== '') {
        try {
          // Check if this invoice exists in the system
          const { data: relatedInvoice, error: invoiceCheckError } = await supabase
            .from('invoices')
            .select('id, invoice_number, total, amount_paid, document_type')
            .eq('invoice_number', data.reference_invoice_number.trim())
            .eq('document_type', 'invoice')
            .single();

          if (!invoiceCheckError && relatedInvoice) {
            // Calculate new amount paid for the invoice
            const currentInvoiceAmountPaid = Number(relatedInvoice.amount_paid || 0);
            const paymentToApply = Number(amountPaid); // Use the amount_paid from receipt
            const newInvoiceAmountPaid = currentInvoiceAmountPaid + paymentToApply;
            const invoiceTotal = Number(relatedInvoice.total);

            // Round to avoid floating-point precision issues
            const roundedNewAmount = Math.round(newInvoiceAmountPaid * 100) / 100;
            const roundedTotal = Math.round(invoiceTotal * 100) / 100;

            // Determine new invoice status
            let newInvoiceStatus = 'partial';
            if (roundedNewAmount >= roundedTotal) {
              newInvoiceStatus = 'paid';
            }

            // Update the invoice
            const { error: updateError } = await supabase
              .from('invoices')
              .update({
                amount_paid: roundedNewAmount,
                status: newInvoiceStatus,
              })
              .eq('id', relatedInvoice.id);

            if (updateError) {
              console.error('Failed to update related invoice:', updateError);
              toast.error(`Receipt created but failed to update invoice ${data.reference_invoice_number}`);
            } else {
              console.log(`Updated invoice ${data.reference_invoice_number}: amount_paid = ${roundedNewAmount}, status = ${newInvoiceStatus}`);
            }
          } else {
            // Invoice not found in system - probably external invoice
            console.log(`Invoice ${data.reference_invoice_number} not found in system (likely external)`);
          }
        } catch (error) {
          console.error('Error updating related invoice:', error);
          // Don't fail receipt creation if invoice update fails
        }
      }

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
                  onChange={(e) => {
                    const newCurrency = e.target.value;
                    const oldCurrency = previousCurrency;
                    
                    console.log('Currency change:', { oldCurrency, newCurrency, exchangeRates });
                    
                    // Convert existing line items to new currency
                    if (oldCurrency !== newCurrency) {
                      const oldRate = exchangeRates[oldCurrency] || 1;
                      const newRate = exchangeRates[newCurrency] || 1;
                      const conversionFactor = newRate / oldRate;
                      
                      console.log('Conversion:', { oldRate, newRate, conversionFactor });
                      
                      // Convert all line items
                      watchLines.forEach((line, index) => {
                        const convertedUnitPrice = line.unit_price * conversionFactor;
                        setValue(`lines.${index}.unit_price`, Math.round(convertedUnitPrice * 100) / 100);
                      });
                      
                      setPreviousCurrency(newCurrency);
                    }
                    
                    setValue('currency', newCurrency);
                  }}
                />
              </div>

              <div className="form-group md:col-span-2">
                <label className="label">Related Invoice Number (Optional)</label>
                {!isManualInvoiceEntry ? (
                  <select
                    {...register('reference_invoice_number')}
                    onChange={(e) => {
                      const selectedValue = e.target.value;
                      if (selectedValue === 'MANUAL') {
                        setIsManualInvoiceEntry(true);
                        setValue('reference_invoice_number', '');
                        handleInvoiceSelect('');
                      } else {
                        handleInvoiceSelect(selectedValue);
                      }
                    }}
                    className="input"
                  >
                    <option value="">Select an invoice or leave blank</option>
                    {customerInvoices.length > 0 && (
                      <optgroup label="Unpaid Invoices">
                        {customerInvoices.map((invoice) => (
                          <option key={invoice.id} value={invoice.invoice_number}>
                            {invoice.invoice_number} - Balance: {formatCurrency(invoice.balance_due)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Manual Entry">
                      <option value="MANUAL">Type external invoice number...</option>
                    </optgroup>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      {...register('reference_invoice_number')}
                      className="input flex-1"
                      placeholder="e.g., EXT-INV-12345"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualInvoiceEntry(false);
                        setValue('reference_invoice_number', '');
                        handleInvoiceSelect('');
                      }}
                      className="btn-secondary whitespace-nowrap"
                    >
                      Select from List
                    </button>
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  {customerInvoices.length > 0 
                    ? `${customerInvoices.length} unpaid invoice(s) available - selecting one will auto-fill items`
                    : isManualInvoiceEntry 
                      ? 'Type external/physical invoice number and enter items manually below'
                      : 'Select customer first to see their invoices, or choose manual entry'}
                </p>
              </div>

              <div className="form-group">
                <label className="label">Amount Paid *</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('amount_paid', { min: 0 })}
                  className="input"
                  placeholder="0.00"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Leave empty or 0 to record full payment. Enter partial amount if not fully paid.
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
                  product_name: '',
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
                      <input
                        {...register(`lines.${index}.product_name`)}
                        list={`products-${index}`}
                        onChange={(e) => handleProductChange(index, e.target.value)}
                        className="input input-sm"
                        placeholder="Type or select a product"
                      />
                      <datalist id={`products-${index}`}>
                        {products.map((product) => (
                          <option key={product.id} value={product.name} />
                        ))}
                      </datalist>
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


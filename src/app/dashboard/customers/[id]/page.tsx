'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import type { Customer as CustomerType } from '@/types/database';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total: number;
  currency: string;
  status: string;
}

export default function CustomerDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerType | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadCustomer();
    loadInvoices();
  }, [id]);

  const loadCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setCustomer(data);
    } catch (error) {
      console.error('Failed to load customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, due_date, total, currency, status')
        .eq('customer_id', id)
        .order('invoice_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${customer?.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('Customer deleted successfully');
      router.push('/dashboard/customers');
    } catch (error) {
      console.error('Failed to delete customer:', error);
      alert('Failed to delete customer. They may have associated invoices.');
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return currencyFormatter(amount, currency as any);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a5f]"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Customer not found</p>
        <Link href="/dashboard/customers" className="btn-primary mt-4">
          Back to Customers
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link href="/dashboard/customers" className="btn-ghost p-2 flex-shrink-0">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{customer.name}</h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1 truncate">{customer.company_name || 'Individual Customer'}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end sm:justify-start">
          <Link
            href={`/dashboard/customers/${id}/edit`}
            className="btn-ghost p-2"
          >
            <PencilIcon className="w-5 h-5" />
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-ghost p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Status Badge */}
      <div>
        <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
          customer.is_active
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {customer.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Customer Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Contact Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5" />
            Contact Information
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {customer.email && (
              <div className="flex items-start gap-2 sm:gap-3">
                <EnvelopeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Primary Email</p>
                  <p className="text-sm sm:text-base text-gray-900 break-words">{customer.email}</p>
                </div>
              </div>
            )}
            {customer.email_2 && (
              <div className="flex items-start gap-2 sm:gap-3">
                <EnvelopeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Secondary Email</p>
                  <p className="text-sm sm:text-base text-gray-900 break-words">{customer.email_2}</p>
                </div>
              </div>
            )}
            {customer.email_3 && (
              <div className="flex items-start gap-2 sm:gap-3">
                <EnvelopeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Additional Email</p>
                  <p className="text-sm sm:text-base text-gray-900 break-words">{customer.email_3}</p>
                </div>
              </div>
            )}
            {customer.email_4 && (
              <div className="flex items-start gap-2 sm:gap-3">
                <EnvelopeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Fourth Email</p>
                  <p className="text-sm sm:text-base text-gray-900 break-words">{customer.email_4}</p>
                </div>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-start gap-2 sm:gap-3">
                <PhoneIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Phone</p>
                  <p className="text-sm sm:text-base text-gray-900">{customer.phone}</p>
                </div>
              </div>
            )}
            {(customer.address_line1 || customer.city) && (
              <div className="flex items-start gap-2 sm:gap-3">
                <MapPinIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Address</p>
                  <div className="text-sm sm:text-base text-gray-900">
                    {customer.address_line1 && <p>{customer.address_line1}</p>}
                    {customer.address_line2 && <p>{customer.address_line2}</p>}
                    {(customer.city || customer.state || customer.zip_code) && (
                      <p>
                        {customer.city}{customer.city && (customer.state || customer.zip_code) ? ', ' : ''}
                        {customer.state} {customer.zip_code}
                      </p>
                    )}
                    {customer.country && <p>{customer.country}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Account Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Account Summary</h2>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Current Balance</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatCurrency(customer.current_balance || 0)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-gray-200">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Payment Terms</p>
                <p className="text-sm sm:text-base font-medium text-gray-900">Net {customer.payment_terms} days</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Credit Limit</p>
                <p className="text-sm sm:text-base font-medium text-gray-900">
                  {customer.credit_limit ? formatCurrency(customer.credit_limit, customer.currency || 'USD') : 'Unlimited'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900">Recent Invoices</h3>
          <Link
            href={`/dashboard/invoices/new?customer_id=${id}`}
            className="btn-primary text-sm w-full sm:w-auto text-center"
          >
            New Invoice
          </Link>
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <p className="text-sm sm:text-base text-gray-500">No invoices yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Date</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Due Date</th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/dashboard/invoices/${invoice.id}`)}
                  >
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 font-medium">{invoice.invoice_number}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 hidden sm:table-cell">{formatDate(invoice.invoice_date)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 hidden md:table-cell">{formatDate(invoice.due_date)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(invoice.total, invoice.currency || 'USD')}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : invoice.status === 'overdue'
                          ? 'bg-red-100 text-red-800'
                          : invoice.status === 'partial'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <p className="text-xs text-gray-500">
          Customer since {formatDate(customer.created_at)}
        </p>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { PlusIcon, MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import type { Invoice, Customer } from '@/types/database';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<(Invoice & { customers: Customer })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadInvoices();
  }, [statusFilter, typeFilter]);

  const loadInvoices = async () => {
    try {
      let query = supabase
        .from('invoices')
        .select('*, customers(*)')
        .neq('document_type', 'receipt') // Exclude receipts
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (typeFilter !== 'all') {
        query = query.eq('document_type', typeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return currencyFormatter(amount, currency as any);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      draft: 'status-draft',
      sent: 'status-sent',
      partial: 'status-partial',
      paid: 'status-paid',
      overdue: 'status-overdue',
      void: 'status-void',
      cancelled: 'status-cancelled',
    };
    return classes[status] || 'badge-gray';
  };

  const getDocumentTypeBadge = (type: string) => {
    const config: Record<string, { label: string; class: string }> = {
      invoice: { label: 'Invoice', class: 'bg-blue-100 text-blue-800' },
      quotation: { label: 'Quote', class: 'bg-purple-100 text-purple-800' },
      proforma: { label: 'Proforma', class: 'bg-orange-100 text-orange-800' },
    };
    return config[type] || config.invoice;
  };

  const filteredInvoices = invoices.filter((invoice) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      invoice.invoice_number.toLowerCase().includes(query) ||
      invoice.customers?.name?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage customer invoices and payments</p>
        </div>
        <Link href="/dashboard/invoices/new" className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          New Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input w-auto"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="void">Void</option>
              </select>
            </div>

            {/* Document Type filter */}
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="input w-auto"
              >
                <option value="all">All Types</option>
                <option value="invoice">Invoices</option>
                <option value="quotation">Quotations</option>
                <option value="proforma">Proforma</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-breco-navy border-t-transparent rounded-full" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No invoices found</p>
            <Link href="/dashboard/invoices/new" className="btn-primary mt-4">
              Create Your First Invoice
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Type</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Due Date</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => {
                  const docType = getDocumentTypeBadge(invoice.document_type || 'invoice');
                  return (
                  <tr key={invoice.id}>
                    <td>
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="text-breco-navy hover:underline font-medium"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${docType.class}`}>
                        {docType.label}
                      </span>
                    </td>
                    <td>{invoice.customers?.name || 'Unknown'}</td>
                    <td>{formatDate(invoice.invoice_date)}</td>
                    <td>{formatDate(invoice.due_date)}</td>
                    <td className="font-medium">{formatCurrency(invoice.total, invoice.currency || 'USD')}</td>
                    <td className={invoice.balance_due > 0 ? 'text-red-600 font-medium' : ''}>
                      {formatCurrency(invoice.balance_due, invoice.currency || 'USD')}
                    </td>
                    <td>
                      <span className={getStatusBadge(invoice.status)}>
                        {invoice.status}
                      </span>
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
  );
}


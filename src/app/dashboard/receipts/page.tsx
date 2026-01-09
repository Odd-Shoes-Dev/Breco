'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { Invoice, Customer } from '@/types/database';

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<(Invoice & { customers: Customer; related_invoice_id?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalCount: 0,
    thisMonthCount: 0,
  });

  useEffect(() => {
    loadReceipts();
    loadStats();
  }, []);

  const loadReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, customers(*)')
        .eq('document_type', 'receipt')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch related invoice IDs for receipts that have reference numbers
      const receiptsWithInvoiceIds = await Promise.all(
        (data || []).map(async (receipt) => {
          const refNumber = (receipt as any).reference_invoice_number;
          if (refNumber) {
            const { data: invoiceData } = await supabase
              .from('invoices')
              .select('id')
              .eq('invoice_number', refNumber)
              .eq('document_type', 'invoice')
              .single();
            return { ...receipt, related_invoice_id: invoiceData?.id };
          }
          return receipt;
        })
      );
      
      setReceipts(receiptsWithInvoiceIds || []);
    } catch (error) {
      console.error('Failed to load receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/receipts/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
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

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredReceipts = receipts.filter((receipt) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      receipt.receipt_number?.toLowerCase().includes(query) ||
      receipt.customers?.name?.toLowerCase().includes(query) ||
      (receipt as any).reference_invoice_number?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receipts</h1>
          <p className="text-gray-500 mt-1">Payment receipts and confirmations</p>
        </div>
        <Link href="/dashboard/receipts/new" className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          New Receipt
        </Link>
      </div>

      {/* Search */}
      <div className="card">
        <div className="card-body">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search receipts by number, customer, or related invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
      </div>

      {/* Receipts table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-breco-navy border-t-transparent rounded-full" />
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">No receipts found</p>
            <Link href="/dashboard/receipts/new" className="btn-primary">
              Create Your First Receipt
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Customer</th>
                  <th>Related Invoice</th>
                  <th>Receipt Date</th>
                  <th>Amount Paid</th>
                  <th>Payment Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReceipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td>
                      <Link
                        href={`/dashboard/receipts/${receipt.id}`}
                        className="text-breco-navy hover:underline font-medium"
                      >
                        {receipt.receipt_number}
                      </Link>
                    </td>
                    <td>{receipt.customers?.name || 'Unknown'}</td>
                    <td>
                      {(receipt as any).reference_invoice_number ? (
                        receipt.related_invoice_id ? (
                          <Link
                            href={`/dashboard/invoices/${receipt.related_invoice_id}`}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            {(receipt as any).reference_invoice_number}
                          </Link>
                        ) : (
                          <span className="text-blue-600 text-sm">
                            {(receipt as any).reference_invoice_number}
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td>
                      <div>
                        <div className="font-medium">{formatDate(receipt.invoice_date)}</div>
                        <div className="text-sm text-gray-500">{formatTime(receipt.created_at)}</div>
                      </div>
                    </td>
                    <td className="font-medium text-green-600">
                      {formatCurrency(receipt.amount_paid || receipt.total, receipt.currency || 'USD')}
                    </td>
                    <td>
                      <span className="badge badge-success">
                        {receipt.payment_terms === 0 ? 'Cash' : 'Bank Transfer'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {!loading && filteredReceipts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <div className="card-body">
              <p className="text-sm text-gray-500">Total Receipts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.totalCount}
              </p>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <p className="text-sm text-gray-500">Total Amount Received (USD)</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(stats.totalAmount, 'USD')}
              </p>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <p className="text-sm text-gray-500">This Month</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.thisMonthCount}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import type { Vendor } from '@/types/database';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadVendors();
  }, [searchQuery, statusFilter, currentPage]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('vendors')
        .select('*', { count: 'exact' })
        .order('name');

      // Apply status filter
      if (statusFilter === 'active') {
        query = query.eq('is_active', true);
      } else if (statusFilter === 'inactive') {
        query = query.eq('is_active', false);
      }
      // 'all' shows both active and inactive

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setVendors(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Failed to load vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null, currency: string = 'USD') => {
    if (!amount) return currencyFormatter(0, currency as any);
    return currencyFormatter(amount, currency as any);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-gray-500 mt-1">Manage your supplier relationships</p>
        </div>
        <Link href="/dashboard/vendors/new" className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          New Vendor
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="input pl-10"
              />
            </div>
            <div className="w-full md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'active' | 'inactive' | 'all');
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
                <option value="all">All Vendors</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Vendors List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600" />
        </div>
      ) : vendors.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <BuildingOfficeIcon className="w-12 h-12 text-gray-400 mx-auto" />
            <p className="text-gray-500 mt-2">No vendors found.</p>
            <Link href="/dashboard/vendors/new" className="btn-primary mt-4 inline-flex">
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Your First Vendor
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Contact</th>
                  <th>Payment Terms</th>
                  <th>1099 Vendor</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>
                      <div>
                        <Link
                          href={`/dashboard/vendors/${vendor.id}`}
                          className="font-medium text-gray-900 hover:text-navy-600"
                        >
                          {vendor.name}
                        </Link>
                        {vendor.company_name && (
                          <p className="text-sm text-gray-500">{vendor.company_name}</p>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        {vendor.email && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                            <a href={`mailto:${vendor.email}`} className="text-gray-600 hover:text-navy-600">
                              {vendor.email}
                            </a>
                          </div>
                        )}
                        {vendor.phone && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <PhoneIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">{vendor.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {vendor.payment_terms ? `Net ${vendor.payment_terms}` : 'Not set'}
                    </td>
                    <td>
                      <span className={vendor.is_1099_vendor ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                        {vendor.is_1099_vendor ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${vendor.is_active ? 'badge-success' : 'badge-error'}`}>
                        {vendor.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/dashboard/vendors/${vendor.id}/edit`}
                        className="btn-ghost p-2"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden grid gap-4">
            {vendors.map((vendor) => (
              <div key={vendor.id} className="card">
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link
                        href={`/dashboard/vendors/${vendor.id}`}
                        className="font-semibold text-gray-900 hover:text-navy-600"
                      >
                        {vendor.name}
                      </Link>
                      {vendor.company_name && (
                        <p className="text-sm text-gray-500">{vendor.company_name}</p>
                      )}
                    </div>
                    <span className={`badge ${vendor.is_active ? 'badge-success' : 'badge-error'}`}>
                      {vendor.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {vendor.email && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">{vendor.email}</span>
                      </div>
                    )}
                    {vendor.phone && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <PhoneIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">{vendor.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                    <div>
                      <span className="text-gray-500">Payment Terms:</span>
                      <span className="ml-1.5 font-medium">
                        {vendor.payment_terms ? `Net ${vendor.payment_terms}` : 'Not set'}
                      </span>
                    </div>
                    <Link
                      href={`/dashboard/vendors/${vendor.id}/edit`}
                      className="text-navy-600 font-medium"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} vendors
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn-secondary disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn-secondary disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


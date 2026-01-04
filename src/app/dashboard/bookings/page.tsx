'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Booking, BookingStatus } from '@/types/breco';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  EyeIcon,
  PencilIcon,
  ChevronDownIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<BookingStatus, string> = {
  inquiry: 'bg-purple-100 text-purple-800',
  quote_sent: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-breco-navy text-white',
  deposit_paid: 'bg-breco-gold text-white',
  fully_paid: 'bg-green-100 text-green-800',
  in_progress: 'bg-breco-teal text-white',
  completed: 'bg-green-500 text-white',
  cancelled: 'bg-gray-200 text-gray-600',
  refunded: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  inquiry: 'Inquiry',
  quote_sent: 'Quote Sent',
  confirmed: 'Confirmed',
  deposit_paid: 'Deposit Paid',
  fully_paid: 'Fully Paid',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

interface BookingWithRelations extends Booking {
  customer?: { id: string; name: string; email: string | null };
  tour_package?: { id: string; name: string; package_code: string };
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await fetch('/api/bookings');
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch bookings');
      }
      
      setBookings(result.data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update status');
      }
      
      setBookings(prev => 
        prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b)
      );
      
      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  const filteredBookings = bookings.filter(booking => {
    // Search filter
    const matchesSearch = 
      booking.booking_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.customer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.tour_package?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    // Date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const travelDate = new Date(booking.travel_start_date);
    const matchesDate = 
      dateFilter === 'all' ||
      (dateFilter === 'upcoming' && travelDate >= today) ||
      (dateFilter === 'past' && travelDate < today);
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getDaysUntilTravel = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const travelDate = new Date(dateString);
    const diffTime = travelDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Stats
  const stats = {
    total: bookings.length,
    upcoming: bookings.filter(b => getDaysUntilTravel(b.travel_start_date) > 0 && !['cancelled', 'completed', 'refunded'].includes(b.status)).length,
    pendingPayment: bookings.filter(b => ['confirmed', 'deposit_paid'].includes(b.status) && b.balance_due > 0).length,
    totalRevenue: bookings.filter(b => !['cancelled', 'refunded'].includes(b.status)).reduce((sum, b) => sum + b.amount_paid, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-breco-navy"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-500 mt-1">Manage tour bookings and reservations</p>
        </div>
        <Link
          href="/dashboard/bookings/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          New Booking
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-breco-navy/10 rounded-lg">
              <CalendarDaysIcon className="w-6 h-6 text-breco-navy" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Bookings</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CalendarDaysIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.upcoming}</p>
              <p className="text-sm text-gray-500">Upcoming</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <CurrencyDollarIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingPayment}</p>
              <p className="text-sm text-gray-500">Pending Payment</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-breco-teal/20 rounded-lg">
              <CurrencyDollarIcon className="w-6 h-6 text-breco-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-sm text-gray-500">Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by booking #, customer, or tour..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-full lg:w-44"
            >
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="input w-full lg:w-36"
            >
              <option value="all">All Dates</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="card overflow-hidden">
        {filteredBookings.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarDaysIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
            <p className="text-gray-500 mb-4">Create your first booking to get started</p>
            <Link href="/dashboard/bookings/new" className="btn-primary inline-flex items-center gap-2">
              <PlusIcon className="w-5 h-5" />
              New Booking
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Tour</th>
                  <th>Travel Dates</th>
                  <th>Guests</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((booking) => {
                  const daysUntil = getDaysUntilTravel(booking.travel_start_date);
                  
                  return (
                    <tr key={booking.id}>
                      <td>
                        <div>
                          <p className="font-medium text-gray-900">{booking.booking_number}</p>
                          <p className="text-xs text-gray-500">
                            {formatDate(booking.booking_date)}
                          </p>
                        </div>
                      </td>
                      <td>
                        <div>
                          <p className="font-medium text-gray-900">{booking.customer?.name}</p>
                          <p className="text-xs text-gray-500">{booking.customer?.email}</p>
                        </div>
                      </td>
                      <td>
                        <div>
                          <p className="font-medium text-gray-900 line-clamp-1">
                            {booking.tour_package?.name || 'Custom Tour'}
                          </p>
                          {booking.tour_package && (
                            <p className="text-xs text-gray-500 font-mono">
                              {booking.tour_package.package_code}
                            </p>
                          )}
                        </div>
                      </td>
                      <td>
                        <div>
                          <p className="text-sm">
                            {formatDate(booking.travel_start_date)} - {formatDate(booking.travel_end_date)}
                          </p>
                          {daysUntil > 0 && !['cancelled', 'completed', 'refunded'].includes(booking.status) && (
                            <p className={`text-xs ${daysUntil <= 7 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                              {daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                            </p>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <UserGroupIcon className="w-4 h-4 text-gray-400" />
                          <span>{booking.num_adults + booking.num_children}</span>
                        </div>
                      </td>
                      <td className="font-medium">
                        {formatCurrency(booking.total, booking.currency)}
                      </td>
                      <td>
                        {booking.balance_due > 0 ? (
                          <span className="text-red-600 font-medium">
                            {formatCurrency(booking.balance_due, booking.currency)}
                          </span>
                        ) : (
                          <span className="text-green-600">Paid</span>
                        )}
                      </td>
                      <td>
                        <div className="relative group">
                          <button
                            className={`badge ${STATUS_COLORS[booking.status]} cursor-pointer flex items-center gap-1`}
                          >
                            {STATUS_LABELS[booking.status]}
                            <ChevronDownIcon className="w-3 h-3" />
                          </button>
                          <div className="absolute left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-10 hidden group-hover:block">
                            {Object.entries(STATUS_LABELS).map(([status, label]) => (
                              <button
                                key={status}
                                onClick={() => updateStatus(booking.id, status as BookingStatus)}
                                className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                  status === booking.status ? 'bg-gray-50 font-medium' : ''
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/bookings/${booking.id}`}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="View"
                          >
                            <EyeIcon className="w-5 h-5 text-gray-500" />
                          </Link>
                          <Link
                            href={`/dashboard/bookings/${booking.id}/edit`}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Edit"
                          >
                            <PencilIcon className="w-5 h-5 text-gray-500" />
                          </Link>
                        </div>
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


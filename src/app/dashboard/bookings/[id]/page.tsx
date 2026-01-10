'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import type { Booking, BookingStatus } from '@/types/breco';
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';

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
  customer?: { id: string; name: string; email: string | null; phone: string | null };
  tour_package?: { 
    id: string; 
    name: string; 
    package_code: string; 
    duration_days: number;
    duration_nights: number;
    image_url: string | null;
    description: string | null;
    base_price_usd: number;
  };
  hotel?: {
    id: string;
    name: string;
    star_rating: number | null;
    address: string | null;
    phone: string | null;
  };
  vehicle?: {
    id: string;
    vehicle_type: string;
    registration_number: string;
    seating_capacity: number;
    daily_rate_usd: number | null;
  };
}

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function BookingDetailPage({ params }: BookingDetailPageProps) {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<string>('');

  useEffect(() => {
    params.then((resolvedParams) => {
      setId(resolvedParams.id);
    });
  }, [params]);

  useEffect(() => {
    if (id) {
      fetchBooking();
    }
  }, [id]);

  async function fetchBooking() {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:customers (id, name, email, phone),
          tour_package:tour_packages (id, name, package_code, duration_days, duration_nights, image_url, description, base_price_usd),
          hotel:hotels (id, name, star_rating, address, phone),
          vehicle:vehicles!bookings_assigned_vehicle_id_fkey (id, vehicle_type, registration_number, seating_capacity, daily_rate_usd)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setBooking(data);
    } catch (error) {
      console.error('Error fetching booking:', error);
      toast.error('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: BookingStatus) {
    if (!booking) return;

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', booking.id);

      if (error) throw error;

      toast.success('Status updated successfully');
      fetchBooking();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  }

  async function handleDelete() {
    if (!booking) return;
    if (!confirm('Are you sure you want to delete this booking? This action cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.id);

      if (error) throw error;

      toast.success('Booking deleted successfully');
      router.push('/dashboard/bookings');
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast.error('Failed to delete booking');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-breco-navy border-t-transparent"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Booking not found</p>
        <Link href="/dashboard/bookings" className="btn-secondary">
          Back to Bookings
        </Link>
      </div>
    );
  }

  const totalTravelers = booking.num_adults + booking.num_children + booking.num_infants;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/bookings"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Booking #{booking.booking_number}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Created on {new Date(booking.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              STATUS_COLORS[booking.status]
            }`}
          >
            {STATUS_LABELS[booking.status]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-2 space-y-6">
          {/* Tour Package Information */}
          {booking.booking_type === 'tour' && booking.tour_package && (
            <div className="card overflow-hidden">
              <Link 
                href={`/dashboard/tours/${booking.tour_package.id}`}
                className="block group"
              >
                {booking.tour_package.image_url && (
                  <div className="relative h-56 w-full overflow-hidden bg-gray-100">
                    <img
                      src={booking.tour_package.image_url}
                      alt={booking.tour_package.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <h3 className="text-xl font-bold">{booking.tour_package.name}</h3>
                      <p className="text-sm text-gray-200">{booking.tour_package.package_code}</p>
                    </div>
                  </div>
                )}
                
                <div className="p-6">
                  {!booking.tour_package.image_url && (
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-900">{booking.tour_package.name}</h3>
                      <p className="text-sm text-gray-500">{booking.tour_package.package_code}</p>
                    </div>
                  )}
                  
                  {booking.tour_package.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {booking.tour_package.description}
                    </p>
                  )}
                  
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <span className="text-xs text-gray-500 block">Duration</span>
                      <p className="font-semibold text-gray-900 mt-1">
                        {booking.tour_package.duration_days}D/{booking.tour_package.duration_nights}N
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block">Travelers</span>
                      <p className="font-semibold text-gray-900 mt-1">{totalTravelers} total</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block">Base Price</span>
                      <p className="font-semibold text-breco-navy mt-1">
                        ${booking.tour_package.base_price_usd}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-sm text-breco-navy group-hover:text-breco-teal transition-colors flex items-center gap-1">
                    View package details
                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Hotel Information */}
          {(booking.booking_type === 'hotel' || booking.booking_type === 'custom') && booking.hotel && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">Hotel Information</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{booking.hotel.name}</h3>
                  {booking.hotel.star_rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-yellow-500 text-lg">
                        {'★'.repeat(booking.hotel.star_rating)}
                      </span>
                    </div>
                  )}
                </div>
                
                {booking.hotel.address && (
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Address</span>
                    <p className="text-gray-900">{booking.hotel.address}</p>
                  </div>
                )}

                {booking.hotel.phone && (
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Phone</span>
                    <p className="text-gray-900">{booking.hotel.phone}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  {booking.room_type && (
                    <div>
                      <span className="text-xs text-gray-500 block">Room Type</span>
                      <p className="font-semibold text-gray-900 mt-1 capitalize">{booking.room_type}</p>
                    </div>
                  )}
                  {booking.num_rooms && (
                    <div>
                      <span className="text-xs text-gray-500 block">Rooms</span>
                      <p className="font-semibold text-gray-900 mt-1">{booking.num_rooms}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Vehicle Information */}
          {(booking.booking_type === 'car_hire' || booking.booking_type === 'custom') && booking.vehicle && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">Vehicle Information</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{booking.vehicle.vehicle_type}</h3>
                  <p className="text-sm text-gray-500 font-mono">{booking.vehicle.registration_number}</p>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <span className="text-xs text-gray-500 block">Capacity</span>
                    <p className="font-semibold text-gray-900 mt-1">{booking.vehicle.seating_capacity} seats</p>
                  </div>
                  {booking.rental_type && (
                    <div>
                      <span className="text-xs text-gray-500 block">Rental Type</span>
                      <p className="font-semibold text-gray-900 mt-1 capitalize">{booking.rental_type.replace('_', ' ')}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-gray-500 block">Daily Rate</span>
                    <p className="font-semibold text-breco-navy mt-1">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: booking.currency || 'USD',
                        minimumFractionDigits: 0,
                      }).format(booking.vehicle.daily_rate_usd || 0)}
                    </p>
                  </div>
                </div>

                {(booking.pickup_location || booking.dropoff_location) && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    {booking.pickup_location && (
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Pickup Location</span>
                        <p className="text-gray-900">{booking.pickup_location}</p>
                      </div>
                    )}
                    {booking.dropoff_location && (
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Dropoff Location</span>
                        <p className="text-gray-900">{booking.dropoff_location}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Customer Information */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <UserGroupIcon className="h-5 w-5 text-gray-400" />
                Customer Information
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <span className="text-xs text-gray-500 block mb-1">Name</span>
                <p className="font-medium text-gray-900">{booking.customer?.name || 'N/A'}</p>
              </div>
              {booking.customer?.email && (
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Email</span>
                  <p className="font-medium text-gray-900 break-all">{booking.customer.email}</p>
                </div>
              )}
              {booking.customer?.phone && (
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Phone</span>
                  <p className="font-medium text-gray-900">{booking.customer.phone}</p>
                </div>
              )}
              <div>
                <span className="text-xs text-gray-500 block mb-1">Travelers</span>
                <p className="font-medium text-gray-900">{totalTravelers} people</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {booking.num_adults} adults, {booking.num_children} children, {booking.num_infants} infants
                </p>
              </div>
            </div>
          </div>

          {/* Travel Dates */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
              <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
              Travel Dates
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <span className="text-xs text-gray-500 block mb-1">Start Date</span>
                <p className="font-medium text-gray-900">
                  {new Date(booking.travel_start_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500 block mb-1">End Date</span>
                <p className="font-medium text-gray-900">
                  {new Date(booking.travel_end_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          {(booking.special_requests || booking.dietary_requirements || booking.notes) && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                Additional Information
              </h2>
              <div className="space-y-4">
                {booking.special_requests && (
                  <div>
                    <span className="text-xs text-gray-500 font-medium block mb-1">Special Requests</span>
                    <p className="text-sm text-gray-700">{booking.special_requests}</p>
                  </div>
                )}
                {booking.dietary_requirements && (
                  <div>
                    <span className="text-xs text-gray-500 font-medium block mb-1">Dietary Requirements</span>
                    <p className="text-sm text-gray-700">{booking.dietary_requirements}</p>
                  </div>
                )}
                {booking.notes && (
                  <div>
                    <span className="text-xs text-gray-500 font-medium block mb-1">Internal Notes</span>
                    <p className="text-sm text-gray-700">{booking.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="xl:col-span-1 space-y-6">
          {/* Pricing Summary */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
              <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
              Pricing Summary
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Subtotal</span>
                <span className="font-semibold text-gray-900">
                  {booking.currency} {booking.subtotal.toFixed(2)}
                </span>
              </div>
              {booking.discount_amount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Discount</span>
                  <span className="font-semibold text-red-600">
                    - {booking.currency} {booking.discount_amount.toFixed(2)}
                  </span>
                </div>
              )}
              {booking.tax_amount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Tax</span>
                  <span className="font-semibold text-gray-900">
                    {booking.currency} {booking.tax_amount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="pt-4 border-t-2 border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg text-gray-900">Total</span>
                  <span className="font-bold text-2xl text-breco-navy">
                    {booking.currency} {booking.total.toFixed(2)}
                  </span>
                </div>
              </div>
              {booking.amount_paid > 0 && (
                <>
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-600">Amount Paid</span>
                    <span className="font-semibold text-green-600">
                      {booking.currency} {booking.amount_paid.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Balance Due</span>
                    <span className="font-bold text-xl text-breco-gold">
                      {booking.currency} {(booking.total - booking.amount_paid).toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Status Management */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Change Status</h2>
            <select
              value={booking.status}
              onChange={(e) => handleStatusChange(e.target.value as BookingStatus)}
              className="w-full rounded-lg border-2 border-gray-300 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-transparent"
            >
              <option value="inquiry">Inquiry</option>
              <option value="quote_sent">Quote Sent</option>
              <option value="confirmed">Confirmed</option>
              <option value="deposit_paid">Deposit Paid</option>
              <option value="fully_paid">Fully Paid</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Actions */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Actions</h2>
            <div className="space-y-3">
              <Link
                href={`/dashboard/bookings/${booking.id}/edit`}
                className="btn-secondary w-full flex items-center justify-center gap-2 py-2.5"
              >
                <PencilIcon className="h-4 w-4" />
                Edit Booking
              </Link>
              <button
                onClick={() => window.print()}
                className="btn-secondary w-full flex items-center justify-center gap-2 py-2.5"
              >
                <PrinterIcon className="h-4 w-4" />
                Print
              </button>
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <TrashIcon className="h-4 w-4" />
                Delete Booking
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

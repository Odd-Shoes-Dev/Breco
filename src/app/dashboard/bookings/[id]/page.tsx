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
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';

const STATUS_COLORS: Record<BookingStatus, string> = {
  inquiry: 'bg-purple-100 text-purple-800',
  confirmed: 'bg-breco-navy text-white',
  deposit_paid: 'bg-breco-gold text-white',
  fully_paid: 'bg-green-100 text-green-800',
  completed: 'bg-green-500 text-white',
  cancelled: 'bg-gray-200 text-gray-600',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  inquiry: 'Inquiry',
  confirmed: 'Confirmed',
  deposit_paid: 'Deposit Paid',
  fully_paid: 'Fully Paid',
  completed: 'Completed',
  cancelled: 'Cancelled',
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
    hotel_images?: Array<{
      id: string;
      image_url: string;
      is_primary: boolean;
    }>;
  };
  vehicle?: {
    id: string;
    vehicle_type: string;
    registration_number: string;
    seating_capacity: number;
    daily_rate_usd: number | null;
    vehicle_images?: Array<{
      id: string;
      image_url: string;
      is_primary: boolean;
    }>;
  };
}

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function BookingDetailPage({ params }: BookingDetailPageProps) {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingWithRelations | null>(null);
  const [relatedInvoices, setRelatedInvoices] = useState<any[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<string>('');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceType, setInvoiceType] = useState<'full' | 'deposit' | 'balance'>('full');
  const [depositPercent, setDepositPercent] = useState(30);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

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
      const [bookingRes, invoicesRes] = await Promise.all([
        supabase
          .from('bookings')
          .select(`
            *,
            customer:customers (id, name, email, phone),
            tour_package:tour_packages (id, name, package_code, duration_days, duration_nights, image_url, description, base_price_usd),
            hotel:hotels (id, name, star_rating, address, phone, hotel_images!inner (id, image_url, is_primary)),
            vehicle:vehicles!bookings_assigned_vehicle_id_fkey (id, vehicle_type, registration_number, seating_capacity, daily_rate_usd, vehicle_images!inner (id, image_url, is_primary))
          `)
          .eq('id', id)
          .single(),
        supabase
          .from('invoices')
          .select('id, invoice_number, document_type, total, amount_paid, status, currency, invoice_date, created_at')
          .eq('booking_id', id)
          .order('created_at', { ascending: false })
      ]);

      if (bookingRes.error) throw bookingRes.error;
      setBooking(bookingRes.data);
      setRelatedInvoices(invoicesRes.data || []);
      
      // Fetch payment history for all related invoices
      if (invoicesRes.data && invoicesRes.data.length > 0) {
        const invoiceIds = invoicesRes.data.map(inv => inv.id);
        
        const { data: paymentsData } = await supabase
          .from('payment_applications')
          .select(`
            amount_applied,
            created_at,
            payment:payments_received (
              id,
              payment_number,
              payment_date,
              payment_method,
              reference_number,
              notes
            ),
            invoice:invoices (
              id,
              invoice_number
            )
          `)
          .in('invoice_id', invoiceIds)
          .order('payment(payment_date)', { ascending: false });

        // Flatten and format payment data
        const formattedPayments = (paymentsData || []).map((app: any) => ({
          id: app.payment?.id || '',
          payment_number: app.payment?.payment_number || '',
          payment_date: app.payment?.payment_date || '',
          amount: parseFloat(app.amount_applied || 0),
          payment_method: app.payment?.payment_method || 'cash',
          reference_number: app.payment?.reference_number || null,
          notes: app.payment?.notes || null,
          invoice_number: app.invoice?.invoice_number || '',
          invoice_id: app.invoice?.id || '',
        }));

        setPaymentHistory(formattedPayments);
      }
      
      // Auto-sync payment status from invoices if needed
      await syncPaymentStatus(bookingRes.data, invoicesRes.data || []);
    } catch (error) {
      console.error('Error fetching booking:', error);
      toast.error('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  }

  async function syncPaymentStatus(booking: BookingWithRelations, invoices: any[]) {
    // Calculate total paid from all invoices, handling currency conversions
    let totalPaidFromInvoices = 0;
    
    for (const inv of invoices) {
      const invAmountPaid = inv.amount_paid || 0;
      
      if (inv.currency === booking.currency) {
        // Same currency, add directly
        totalPaidFromInvoices += invAmountPaid;
      } else {
        // Different currency, convert using database function
        const { data: convertedAmount } = await supabase.rpc('convert_currency', {
          p_amount: invAmountPaid,
          p_from_currency: inv.currency,
          p_to_currency: booking.currency,
          p_date: new Date().toISOString().split('T')[0],
        });
        
        if (convertedAmount !== null) {
          totalPaidFromInvoices += convertedAmount;
        } else {
          console.warn(`Could not convert ${inv.currency} to ${booking.currency} for invoice ${inv.id}`);
          toast.error(`Currency conversion not available for ${inv.currency} to ${booking.currency}`);
          // Fallback: add the amount as-is
          totalPaidFromInvoices += invAmountPaid;
        }
      }
    }
    
    // Check if booking amount_paid needs updating
    if (Math.abs(totalPaidFromInvoices - (booking.amount_paid || 0)) > 0.01) {
      // Determine correct status
      let correctStatus = booking.status;
      if (totalPaidFromInvoices >= booking.total) {
        correctStatus = 'fully_paid';
      } else if (totalPaidFromInvoices > 0) {
        if (!['fully_paid', 'completed'].includes(booking.status)) {
          correctStatus = 'deposit_paid';
        }
      }

      // Update booking
      const { error } = await supabase
        .from('bookings')
        .update({
          amount_paid: totalPaidFromInvoices,
          status: correctStatus,
        })
        .eq('id', booking.id);

      if (!error) {
        // Refresh to show updated data
        fetchBooking();
      }
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

  async function handleGenerateInvoice() {
    if (!booking) return;
    
    // Calculate amount based on invoice type
    let amount = booking.total;
    let description = '';
    
    // Calculate how much has already been invoiced
    const totalInvoiced = relatedInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const remainingToInvoice = booking.total - totalInvoiced;
    
    // Validate invoice type selection
    if (invoiceType === 'deposit') {
      amount = booking.total * (depositPercent / 100);
      
      // Check if deposit would exceed remaining balance
      if (amount > remainingToInvoice && remainingToInvoice > 0) {
        const maxPercent = Math.floor((remainingToInvoice / booking.total) * 100);
        toast.error(`Deposit amount would exceed remaining balance. Maximum deposit: ${maxPercent}%`);
        return;
      }
    } else if (invoiceType === 'balance') {
      amount = remainingToInvoice;
      
      if (amount <= 0) {
        toast.error('No balance remaining to invoice. Booking is fully invoiced.');
        return;
      }
    } else if (invoiceType === 'full') {
      amount = booking.total;
      
      // Warn if full invoice would exceed remaining
      if (amount > remainingToInvoice && remainingToInvoice > 0) {
        const proceed = confirm(
          `Warning: This booking already has ${booking.currency} ${totalInvoiced.toFixed(2)} invoiced. ` +
          `Creating a full invoice for ${booking.currency} ${amount.toFixed(2)} will exceed the booking total. ` +
          `Remaining balance to invoice: ${booking.currency} ${remainingToInvoice.toFixed(2)}.\n\n` +
          `Do you want to continue anyway?`
        );
        if (!proceed) return;
      }
    }
    
    // Generate description based on booking type
    switch (booking.booking_type) {
      case 'tour':
        description = booking.tour_package?.name || 'Tour Package';
        break;
      case 'hotel':
        description = booking.hotel?.name || 'Hotel Accommodation';
        break;
      case 'car_hire':
        description = booking.vehicle?.vehicle_type || 'Vehicle Rental';
        break;
      case 'custom':
        const items = [];
        if (booking.hotel) items.push(booking.hotel.name);
        if (booking.vehicle) items.push(booking.vehicle.vehicle_type);
        description = items.join(' + ') || 'Custom Booking';
        break;
      default:
        description = `Booking ${booking.booking_number}`;
    }
    
    if (invoiceType === 'deposit') {
      description = `Deposit (${depositPercent}%) - ${description}`;
    } else if (invoiceType === 'balance') {
      description = `Balance Payment - ${description}`;
    }
    
    // Build query parameters for pre-filling invoice form
    const params = new URLSearchParams({
      customer_id: booking.customer_id,
      booking_id: booking.id,
      booking_number: booking.booking_number,
      currency: booking.currency || 'USD',
      description: description,
      quantity: '1',
      amount: amount.toFixed(2),
      subtotal: booking.subtotal.toFixed(2),
      tax_amount: booking.tax_amount.toFixed(2),
      invoice_type: invoiceType,
    });
    
    // Redirect to invoice creation page with pre-filled data
    router.push(`/dashboard/invoices/new?${params.toString()}`);
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
            <div className="card overflow-hidden">
              <Link 
                href={`/dashboard/hotels/${booking.hotel.id}`}
                className="block group"
              >
                {(() => {
                  const primaryImage = booking.hotel.hotel_images?.find(img => img.is_primary);
                  const imageUrl = primaryImage?.image_url;
                  
                  return imageUrl ? (
                    <div className="relative h-56 w-full overflow-hidden bg-gray-100">
                      <img
                        src={imageUrl}
                        alt={booking.hotel.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h3 className="text-xl font-bold">{booking.hotel.name}</h3>
                        {booking.hotel.star_rating && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-yellow-400 text-lg">
                              {'★'.repeat(booking.hotel.star_rating)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null;
                })()}
                
                <div className="p-6">
                  {!booking.hotel.hotel_images?.find(img => img.is_primary) && (
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-900">{booking.hotel.name}</h3>
                      {booking.hotel.star_rating && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-yellow-500 text-lg">
                            {'★'.repeat(booking.hotel.star_rating)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    {booking.hotel.address && (
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Address</span>
                        <p className="text-sm text-gray-900">{booking.hotel.address}</p>
                      </div>
                    )}

                    {booking.hotel.phone && (
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Phone</span>
                        <p className="text-sm text-gray-900">{booking.hotel.phone}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 mt-4">
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
                  
                  <div className="mt-4 text-sm text-breco-navy group-hover:text-breco-teal transition-colors flex items-center gap-1">
                    View hotel details
                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Vehicle Information */}
          {(booking.booking_type === 'car_hire' || booking.booking_type === 'custom') && booking.vehicle && (
            <div className="card overflow-hidden">
              <Link 
                href={`/dashboard/fleet/${booking.vehicle.id}`}
                className="block group"
              >
                {(() => {
                  const primaryImage = booking.vehicle.vehicle_images?.find(img => img.is_primary);
                  const imageUrl = primaryImage?.image_url;
                  
                  return imageUrl ? (
                    <div className="relative h-56 w-full overflow-hidden bg-gray-100">
                      <img
                        src={imageUrl}
                        alt={booking.vehicle.vehicle_type}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h3 className="text-xl font-bold">{booking.vehicle.vehicle_type}</h3>
                        <p className="text-sm text-gray-200 font-mono">{booking.vehicle.registration_number}</p>
                      </div>
                    </div>
                  ) : null;
                })()}
                
                <div className="p-6">
                  {!booking.vehicle.vehicle_images?.find(img => img.is_primary) && (
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-900">{booking.vehicle.vehicle_type}</h3>
                      <p className="text-sm text-gray-500 font-mono">{booking.vehicle.registration_number}</p>
                    </div>
                  )}

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
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 mt-4">
                      {booking.pickup_location && (
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">Pickup Location</span>
                          <p className="text-sm text-gray-900">{booking.pickup_location}</p>
                        </div>
                      )}
                      {booking.dropoff_location && (
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">Dropoff Location</span>
                          <p className="text-sm text-gray-900">{booking.dropoff_location}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="mt-4 text-sm text-breco-navy group-hover:text-breco-teal transition-colors flex items-center gap-1">
                    View vehicle details
                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
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

          {/* Related Invoices */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
              <DocumentDuplicateIcon className="h-5 w-5 text-gray-400" />
              Related Invoices
              {relatedInvoices.length > 0 && (
                <span className="ml-auto text-xs bg-breco-navy text-white px-2 py-1 rounded-full">
                  {relatedInvoices.length}
                </span>
              )}
            </h2>
            
            {relatedInvoices.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No invoices generated yet
              </p>
            ) : (
              <div className="space-y-3">
                {relatedInvoices.map((invoice) => {
                  const statusColors: Record<string, string> = {
                    draft: 'bg-gray-100 text-gray-800',
                    sent: 'bg-blue-100 text-blue-800',
                    viewed: 'bg-purple-100 text-purple-800',
                    partial: 'bg-yellow-100 text-yellow-800',
                    paid: 'bg-green-100 text-green-800',
                    overdue: 'bg-red-100 text-red-800',
                    cancelled: 'bg-gray-200 text-gray-600',
                  };

                  const balanceDue = invoice.total - invoice.amount_paid;
                  const isFullyPaid = balanceDue === 0;

                  return (
                    <Link
                      key={invoice.id}
                      href={`/dashboard/invoices/${invoice.id}`}
                      className="block border border-gray-200 rounded-lg p-4 hover:border-breco-navy hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 text-sm">
                              {invoice.invoice_number}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[invoice.status] || 'bg-gray-100 text-gray-800'}`}>
                              {invoice.status}
                            </span>
                            {invoice.currency !== booking.currency && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-medium">
                                {invoice.currency}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(invoice.invoice_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 text-sm">
                            {invoice.currency} {invoice.total.toFixed(2)}
                          </div>
                          {!isFullyPaid && (
                            <div className="text-xs text-amber-600 font-medium mt-0.5">
                              Due: {invoice.currency} {balanceDue.toFixed(2)}
                            </div>
                          )}
                          {isFullyPaid && (
                            <div className="text-xs text-green-600 font-medium mt-0.5 flex items-center gap-1">
                              <CheckCircleIcon className="h-3 w-3" />
                              Paid
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
                
                <div className="pt-3 border-t border-gray-200 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Total invoiced:</span>
                    <span className="font-semibold">
                      {booking.currency} {relatedInvoices.reduce((sum, inv) => sum + inv.total, 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Total paid:</span>
                    <span className="font-semibold text-green-600">
                      {booking.currency} {relatedInvoices.reduce((sum, inv) => sum + inv.amount_paid, 0).toFixed(2)}
                    </span>
                  </div>
                  {relatedInvoices.reduce((sum, inv) => sum + (inv.total - inv.amount_paid), 0) > 0 && (
                    <div className="flex justify-between mt-1">
                      <span>Outstanding:</span>
                      <span className="font-semibold text-amber-600">
                        {booking.currency} {relatedInvoices.reduce((sum, inv) => sum + (inv.total - inv.amount_paid), 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Payment History */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
              <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
              Payment History
              {paymentHistory.length > 0 && (
                <span className="ml-auto text-xs bg-green-600 text-white px-2 py-1 rounded-full">
                  {paymentHistory.length}
                </span>
              )}
            </h2>
            
            {paymentHistory.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No payments recorded yet
              </p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  let runningTotal = 0;
                  return paymentHistory.map((payment, index) => {
                    runningTotal += payment.amount;
                    
                    const paymentMethodColors: Record<string, string> = {
                      cash: 'bg-green-100 text-green-800',
                      check: 'bg-blue-100 text-blue-800',
                      bank_transfer: 'bg-purple-100 text-purple-800',
                      credit_card: 'bg-orange-100 text-orange-800',
                      mobile_money: 'bg-teal-100 text-teal-800',
                    };

                    return (
                      <div
                        key={payment.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-green-300 hover:bg-green-50/30 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
                                {paymentHistory.length - index}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900 text-sm">
                                  {booking.currency} {payment.amount.toFixed(2)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(payment.payment_date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </div>
                              </div>
                            </div>

                            <div className="ml-10 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paymentMethodColors[payment.payment_method] || 'bg-gray-100 text-gray-800'}`}>
                                  {payment.payment_method.replace('_', ' ').toUpperCase()}
                                </span>
                                {payment.reference_number && (
                                  <span className="text-xs text-gray-600">
                                    Ref: {payment.reference_number}
                                  </span>
                                )}
                              </div>

                              {payment.invoice_number && (
                                <Link
                                  href={`/dashboard/invoices/${payment.invoice_id}`}
                                  className="text-xs text-breco-navy hover:underline inline-flex items-center gap-1"
                                >
                                  Applied to {payment.invoice_number}
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </Link>
                              )}

                              {payment.notes && (
                                <p className="text-xs text-gray-600 italic mt-1">
                                  "{payment.notes}"
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right ml-4">
                            <div className="text-xs text-gray-500 mb-1">Running Total</div>
                            <div className="font-semibold text-green-600 text-sm">
                              {booking.currency} {runningTotal.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}

                <div className="pt-3 border-t-2 border-gray-200 bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-900">Total Payments Received</span>
                    <span className="font-bold text-xl text-green-600">
                      {booking.currency} {paymentHistory.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                    </span>
                  </div>
                  {booking.total - booking.amount_paid > 0 && (
                    <div className="flex justify-between items-center mt-2 text-sm">
                      <span className="text-gray-600">Remaining Balance</span>
                      <span className="font-semibold text-amber-600">
                        {booking.currency} {(booking.total - booking.amount_paid).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
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
              <option value="confirmed">Confirmed</option>
              <option value="deposit_paid">Deposit Paid</option>
              <option value="fully_paid">Fully Paid</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Actions */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
              >
                <DocumentDuplicateIcon className="h-4 w-4" />
                Generate Invoice
              </button>
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

      {/* Invoice Generation Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Generate Invoice</h3>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Smart Suggestions */}
              {(() => {
                const totalInvoiced = relatedInvoices.reduce((sum, inv) => sum + inv.total, 0);
                const remainingToInvoice = booking.total - totalInvoiced;
                const percentInvoiced = (totalInvoiced / booking.total) * 100;
                
                // Check if any invoices have different currency
                const hasCurrencyMismatch = relatedInvoices.some(inv => inv.currency !== booking.currency);

                // Show different messages based on invoicing status
                if (relatedInvoices.length === 0) {
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">First Invoice</p>
                          <p className="text-xs text-blue-700 mt-1">
                            This booking has no invoices yet. Consider starting with a deposit invoice.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                } else if (remainingToInvoice > 0) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-900">
                            {percentInvoiced.toFixed(0)}% Invoiced
                          </p>
                          <p className="text-xs text-amber-700 mt-1">
                            {booking.currency} {totalInvoiced.toFixed(2)} of {booking.currency} {booking.total.toFixed(2)} invoiced.
                            <br />
                            Remaining: <strong>{booking.currency} {remainingToInvoice.toFixed(2)}</strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                } else if (remainingToInvoice === 0) {
                  return (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-900">Fully Invoiced</p>
                          <p className="text-xs text-green-700 mt-1">
                            This booking has been fully invoiced ({relatedInvoices.length} invoice{relatedInvoices.length !== 1 ? 's' : ''}).
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  // Over-invoiced
                  return (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-900">Over-Invoiced!</p>
                          <p className="text-xs text-red-700 mt-1">
                            Total invoiced ({booking.currency} {totalInvoiced.toFixed(2)}) exceeds booking total by {booking.currency} {Math.abs(remainingToInvoice).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
              })()}

              {/* Currency Mismatch Warning */}
              {relatedInvoices.some(inv => inv.currency !== booking.currency) && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-900">Currency Mismatch Detected</p>
                      <p className="text-xs text-orange-700 mt-1">
                        Some invoices use different currencies than the booking ({booking.currency}). Payments will be auto-converted.
                      </p>
                      <div className="mt-2 text-xs text-orange-600">
                        {relatedInvoices.filter(inv => inv.currency !== booking.currency).map(inv => (
                          <div key={inv.id}>• {inv.invoice_number}: {inv.currency}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Type
                </label>
                <select
                  value={invoiceType}
                  onChange={(e) => setInvoiceType(e.target.value as 'full' | 'deposit' | 'balance')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                >
                  <option value="full">Full Invoice ({booking.currency} {booking.total.toFixed(2)})</option>
                  <option value="deposit">Deposit Invoice</option>
                  <option value="balance">Balance Invoice ({booking.currency} {(booking.total - relatedInvoices.reduce((sum, inv) => sum + inv.total, 0)).toFixed(2)})</option>
                </select>
              </div>

              {invoiceType === 'deposit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deposit Percentage
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={depositPercent}
                      onChange={(e) => setDepositPercent(parseInt(e.target.value) || 30)}
                      min="1"
                      max="100"
                      className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                    />
                    <span className="text-sm text-gray-600">%</span>
                    <span className="text-sm text-gray-600 ml-2">
                      = {booking.currency} {((booking.total * depositPercent) / 100).toFixed(2)}
                    </span>
                  </div>
                  {(() => {
                    const depositAmount = (booking.total * depositPercent) / 100;
                    const totalInvoiced = relatedInvoices.reduce((sum, inv) => sum + inv.total, 0);
                    const remaining = booking.total - totalInvoiced;
                    if (depositAmount > remaining && remaining > 0) {
                      return (
                        <p className="text-xs text-red-600 mt-2">
                          ⚠️ This deposit exceeds remaining balance. Maximum: {Math.floor((remaining / booking.total) * 100)}%
                        </p>
                      );
                    }
                  })()}
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  <strong>Booking:</strong> {booking.booking_number}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Customer: {booking.customer?.name}
                </p>
                <p className="text-sm text-gray-600">
                  Total: {booking.currency} {booking.total.toFixed(2)}
                </p>
                {relatedInvoices.length > 0 && (
                  <>
                    <p className="text-sm text-gray-600">
                      Already invoiced: {booking.currency} {relatedInvoices.reduce((sum, inv) => sum + inv.total, 0).toFixed(2)}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      Remaining: {booking.currency} {(booking.total - relatedInvoices.reduce((sum, inv) => sum + inv.total, 0)).toFixed(2)}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowInvoiceModal(false)}
                disabled={generatingInvoice}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateInvoice}
                disabled={generatingInvoice}
                className="btn-primary"
              >
                {generatingInvoice ? 'Generating...' : 'Generate Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

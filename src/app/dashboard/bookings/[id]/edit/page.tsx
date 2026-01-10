'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { CurrencySelect } from '@/components/ui';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  BuildingOffice2Icon,
  TruckIcon,
  MapIcon,
} from '@heroicons/react/24/outline';
import type { Customer } from '@/types/database';
import type { TourPackage, Hotel, Vehicle, BookingStatus } from '@/types/breco';

interface BookingFormData {
  customer_id: string;
  booking_type: 'tour' | 'hotel' | 'car_hire' | 'custom';
  
  // Tour package fields
  tour_package_id: string;
  
  // Hotel fields
  hotel_id: string;
  room_type: string;
  num_rooms: number;
  
  // Vehicle fields
  assigned_vehicle_id: string;
  rental_type: 'self_drive' | 'with_driver' | 'airport_transfer' | '';
  pickup_location: string;
  dropoff_location: string;
  
  // Common fields
  booking_date: string;
  travel_start_date: string;
  travel_end_date: string;
  num_adults: number;
  num_children: number;
  num_infants: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'UGX';
  special_requests: string;
  dietary_requirements: string;
  notes: string;
  status: BookingStatus;
}

interface EditBookingPageProps {
  params: Promise<{ id: string }>;
}

export default function EditBookingPage({ params }: EditBookingPageProps) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tourPackages, setTourPackages] = useState<TourPackage[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<TourPackage | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const [formData, setFormData] = useState<BookingFormData>({
    customer_id: '',
    booking_type: 'tour',
    tour_package_id: '',
    hotel_id: '',
    room_type: '',
    num_rooms: 1,
    assigned_vehicle_id: '',
    rental_type: '',
    pickup_location: '',
    dropoff_location: '',
    booking_date: new Date().toISOString().split('T')[0],
    travel_start_date: '',
    travel_end_date: '',
    num_adults: 2,
    num_children: 0,
    num_infants: 0,
    subtotal: 0,
    discount_amount: 0,
    tax_amount: 0,
    total: 0,
    currency: 'USD',
    special_requests: '',
    dietary_requirements: '',
    notes: '',
    status: 'inquiry',
  });

  useEffect(() => {
    params.then((resolvedParams) => {
      setBookingId(resolvedParams.id);
    });
  }, [params]);

  useEffect(() => {
    if (bookingId) {
      loadData();
    }
  }, [bookingId]);

  useEffect(() => {
    if (formData.tour_package_id && tourPackages.length > 0) {
      const pkg = tourPackages.find(p => p.id === formData.tour_package_id);
      setSelectedPackage(pkg || null);
    }
  }, [formData.tour_package_id, tourPackages]);

  useEffect(() => {
    if (formData.hotel_id && hotels.length > 0) {
      const hotel = hotels.find(h => h.id === formData.hotel_id);
      setSelectedHotel(hotel || null);
    }
  }, [formData.hotel_id, hotels]);

  useEffect(() => {
    if (formData.assigned_vehicle_id && vehicles.length > 0) {
      const vehicle = vehicles.find(v => v.id === formData.assigned_vehicle_id);
      setSelectedVehicle(vehicle || null);
    }
  }, [formData.assigned_vehicle_id, vehicles]);

  useEffect(() => {
    // Recalculate pricing when relevant fields change
    calculateTotal();
  }, [
    formData.booking_type,
    formData.num_adults,
    formData.num_children,
    formData.num_rooms,
    formData.discount_amount,
    formData.travel_start_date,
    formData.travel_end_date,
    selectedPackage,
    selectedHotel,
    selectedVehicle,
  ]);

  const loadData = async () => {
    if (!bookingId) return;

    try {
      // Load all necessary data in parallel
      const [customersRes, packagesRes, hotelsRes, vehiclesRes, bookingRes] = await Promise.all([
        supabase.from('customers').select('*').eq('is_active', true).order('name'),
        supabase.from('tour_packages').select('*').eq('is_active', true).order('name'),
        supabase.from('hotels').select('*').eq('is_active', true).order('name'),
        supabase.from('vehicles').select('*').eq('is_active', true).order('vehicle_type'),
        supabase.from('bookings').select('*').eq('id', bookingId).single(),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (packagesRes.error) throw packagesRes.error;
      if (hotelsRes.error) throw hotelsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (bookingRes.error) throw bookingRes.error;

      setCustomers(customersRes.data || []);
      setTourPackages(packagesRes.data || []);
      setHotels(hotelsRes.data || []);
      setVehicles(vehiclesRes.data || []);

      // Populate form with existing booking data
      const booking = bookingRes.data;
      setFormData({
        customer_id: booking.customer_id || '',
        booking_type: booking.booking_type || 'tour',
        tour_package_id: booking.tour_package_id || '',
        hotel_id: booking.hotel_id || '',
        room_type: booking.room_type || '',
        num_rooms: booking.num_rooms || 1,
        assigned_vehicle_id: booking.assigned_vehicle_id || '',
        rental_type: booking.rental_type || '',
        pickup_location: booking.pickup_location || '',
        dropoff_location: booking.dropoff_location || '',
        booking_date: booking.booking_date ? new Date(booking.booking_date).toISOString().split('T')[0] : '',
        travel_start_date: booking.travel_start_date ? new Date(booking.travel_start_date).toISOString().split('T')[0] : '',
        travel_end_date: booking.travel_end_date ? new Date(booking.travel_end_date).toISOString().split('T')[0] : '',
        num_adults: booking.num_adults || 2,
        num_children: booking.num_children || 0,
        num_infants: booking.num_infants || 0,
        subtotal: booking.subtotal || 0,
        discount_amount: booking.discount_amount || 0,
        tax_amount: booking.tax_amount || 0,
        total: booking.total || 0,
        currency: booking.currency || 'USD',
        special_requests: booking.special_requests || '',
        dietary_requirements: booking.dietary_requirements || '',
        notes: booking.notes || '',
        status: booking.status || 'inquiry',
      });
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error('Failed to load booking');
      router.push('/dashboard/bookings');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    let subtotal = 0;
    const numDays = calculateNumDays();

    // Calculate based on booking type
    switch (formData.booking_type) {
      case 'tour':
        if (selectedPackage) {
          const basePrice = selectedPackage.base_price_usd;
          if (selectedPackage.price_per_person) {
            subtotal = (basePrice * formData.num_adults) + (basePrice * 0.5 * formData.num_children);
          } else {
            subtotal = basePrice;
          }
        }
        break;

      case 'hotel':
        if (selectedHotel && numDays > 0) {
          const ratePerNight = selectedHotel.standard_rate_usd || 100;
          subtotal = ratePerNight * formData.num_rooms * numDays;
        }
        break;

      case 'car_hire':
        if (selectedVehicle && numDays > 0) {
          const dailyRate = selectedVehicle.daily_rate_usd || 150;
          subtotal = dailyRate * numDays;
          // Add driver fee if with_driver
          if (formData.rental_type === 'with_driver') {
            subtotal += (30 * numDays); // $30/day for driver
          }
        }
        break;

      case 'custom':
        // Custom can include hotel + vehicle
        if (selectedHotel && formData.hotel_id && numDays > 0) {
          const ratePerNight = selectedHotel.standard_rate_usd || 100;
          subtotal += ratePerNight * formData.num_rooms * numDays;
        }
        if (selectedVehicle && formData.assigned_vehicle_id && numDays > 0) {
          const dailyRate = selectedVehicle.daily_rate_usd || 150;
          subtotal += dailyRate * numDays;
          if (formData.rental_type === 'with_driver') {
            subtotal += (30 * numDays);
          }
        }
        break;
    }

    const discount = formData.discount_amount || 0;
    const taxRate = 0.18;
    const taxableAmount = subtotal - discount;
    const tax = taxableAmount * taxRate;
    const total = taxableAmount + tax;

    setFormData(prev => ({
      ...prev,
      subtotal,
      tax_amount: tax,
      total,
    }));
  };

  const calculateNumDays = () => {
    if (!formData.travel_start_date || !formData.travel_end_date) return 0;
    const start = new Date(formData.travel_start_date);
    const end = new Date(formData.travel_end_date);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.customer_id) {
        throw new Error('Please select a customer');
      }
      if (!formData.travel_start_date || !formData.travel_end_date) {
        throw new Error('Please specify travel dates');
      }

      // Validate based on booking type
      if (formData.booking_type === 'tour' && !formData.tour_package_id) {
        throw new Error('Please select a tour package');
      }
      if (formData.booking_type === 'hotel' && !formData.hotel_id) {
        throw new Error('Please select a hotel');
      }
      if (formData.booking_type === 'car_hire' && !formData.assigned_vehicle_id) {
        throw new Error('Please select a vehicle');
      }
      if (formData.booking_type === 'custom' && !formData.hotel_id && !formData.assigned_vehicle_id) {
        throw new Error('Please select at least a hotel or vehicle for custom booking');
      }

      // Prepare update data
      const updateData: any = {
        customer_id: formData.customer_id,
        booking_type: formData.booking_type,
        booking_date: formData.booking_date,
        travel_start_date: formData.travel_start_date,
        travel_end_date: formData.travel_end_date,
        num_adults: formData.num_adults,
        num_children: formData.num_children,
        num_infants: formData.num_infants,
        subtotal: formData.subtotal,
        discount_amount: formData.discount_amount,
        tax_amount: formData.tax_amount,
        total: formData.total,
        currency: formData.currency,
        status: formData.status,
        special_requests: formData.special_requests || null,
        dietary_requirements: formData.dietary_requirements || null,
        notes: formData.notes || null,
        updated_at: new Date().toISOString(),
      };

      // Add/remove type-specific fields
      if (formData.booking_type === 'tour') {
        updateData.tour_package_id = formData.tour_package_id;
        updateData.hotel_id = null;
        updateData.room_type = null;
        updateData.num_rooms = null;
        updateData.assigned_vehicle_id = null;
        updateData.rental_type = null;
        updateData.pickup_location = null;
        updateData.dropoff_location = null;
      } else if (formData.booking_type === 'hotel') {
        updateData.tour_package_id = null;
        updateData.hotel_id = formData.hotel_id;
        updateData.room_type = formData.room_type;
        updateData.num_rooms = formData.num_rooms;
        updateData.assigned_vehicle_id = null;
        updateData.rental_type = null;
        updateData.pickup_location = null;
        updateData.dropoff_location = null;
      } else if (formData.booking_type === 'car_hire') {
        updateData.tour_package_id = null;
        updateData.hotel_id = null;
        updateData.room_type = null;
        updateData.num_rooms = null;
        updateData.assigned_vehicle_id = formData.assigned_vehicle_id;
        updateData.rental_type = formData.rental_type;
        updateData.pickup_location = formData.pickup_location;
        updateData.dropoff_location = formData.dropoff_location;
      } else if (formData.booking_type === 'custom') {
        updateData.tour_package_id = formData.tour_package_id || null;
        updateData.hotel_id = formData.hotel_id || null;
        updateData.room_type = formData.room_type || null;
        updateData.num_rooms = formData.num_rooms;
        updateData.assigned_vehicle_id = formData.assigned_vehicle_id || null;
        updateData.rental_type = formData.rental_type || null;
        updateData.pickup_location = formData.pickup_location || null;
        updateData.dropoff_location = formData.dropoff_location || null;
      }

      // Update booking
      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId);

      if (error) throw error;

      toast.success('Booking updated successfully!');
      router.push(`/dashboard/bookings/${bookingId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update booking';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'UGX' ? 0 : 2,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-breco-navy border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/bookings/${bookingId}`}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Booking</h1>
          <p className="text-sm text-gray-500 mt-1">Update booking information</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <InformationCircleIcon className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Booking Type *</label>
              <select
                name="booking_type"
                value={formData.booking_type}
                onChange={handleChange}
                className="input"
                required
              >
                <option value="tour">Tour Package</option>
                <option value="hotel">Hotel Only</option>
                <option value="car_hire">Car Hire</option>
                <option value="custom">Custom Combination</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Select the type of booking</p>
            </div>

            <div>
              <label className="label">Customer *</label>
              <select
                name="customer_id"
                value={formData.customer_id}
                onChange={handleChange}
                className="input"
                required
              >
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Booking Date *</label>
              <input
                type="date"
                name="booking_date"
                value={formData.booking_date}
                onChange={handleChange}
                className="input"
                required
              />
            </div>

            <div>
              <label className="label">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="input"
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
          </div>
        </div>

        {/* Tour Package Selection */}
        {(formData.booking_type === 'tour' || formData.booking_type === 'custom') && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <MapIcon className="h-5 w-5 text-breco-navy" />
              <h2 className="text-lg font-semibold text-gray-900">Tour Package</h2>
            </div>
            <div>
              <label className="label">Select Tour Package {formData.booking_type === 'tour' && '*'}</label>
              <select
                name="tour_package_id"
                value={formData.tour_package_id}
                onChange={handleChange}
                className="input"
                required={formData.booking_type === 'tour'}
              >
                <option value="">Select Tour Package</option>
                {tourPackages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} - {pkg.package_code} ({pkg.duration_days}D/{pkg.duration_nights}N) - ${pkg.base_price_usd}
                  </option>
                ))}
              </select>
              {selectedPackage && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>{selectedPackage.name}</strong> - {selectedPackage.duration_days} days / {selectedPackage.duration_nights} nights
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Base Price: {formatPrice(selectedPackage.base_price_usd, formData.currency)}
                    {selectedPackage.price_per_person && ' (per person)'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hotel Selection */}
        {(formData.booking_type === 'hotel' || formData.booking_type === 'custom') && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <BuildingOffice2Icon className="h-5 w-5 text-breco-navy" />
              <h2 className="text-lg font-semibold text-gray-900">Hotel Information</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Select Hotel {formData.booking_type === 'hotel' && '*'}</label>
                <select
                  name="hotel_id"
                  value={formData.hotel_id}
                  onChange={handleChange}
                  className="input"
                  required={formData.booking_type === 'hotel'}
                >
                  <option value="">Select Hotel</option>
                  {hotels.map((hotel) => (
                    <option key={hotel.id} value={hotel.id}>
                      {hotel.name} {hotel.star_rating && `(${hotel.star_rating}★)`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Room Type</label>
                  <input
                    type="text"
                    name="room_type"
                    value={formData.room_type}
                    onChange={handleChange}
                    className="input"
                    placeholder="e.g., Standard, Deluxe, Suite"
                  />
                </div>
                <div>
                  <label className="label">Number of Rooms</label>
                  <input
                    type="number"
                    name="num_rooms"
                    value={formData.num_rooms}
                    onChange={handleChange}
                    className="input"
                    min="1"
                  />
                </div>
              </div>
              {selectedHotel && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>{selectedHotel.name}</strong>
                    {selectedHotel.star_rating && ` - ${selectedHotel.star_rating}★`}
                  </p>
                  {selectedHotel.standard_rate_usd && (
                    <p className="text-sm text-gray-600 mt-1">
                      Standard Rate: {formatPrice(selectedHotel.standard_rate_usd, formData.currency)} per night
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vehicle Selection */}
        {(formData.booking_type === 'car_hire' || formData.booking_type === 'custom') && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <TruckIcon className="h-5 w-5 text-breco-navy" />
              <h2 className="text-lg font-semibold text-gray-900">Vehicle Information</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Select Vehicle {formData.booking_type === 'car_hire' && '*'}</label>
                <select
                  name="assigned_vehicle_id"
                  value={formData.assigned_vehicle_id}
                  onChange={handleChange}
                  className="input"
                  required={formData.booking_type === 'car_hire'}
                >
                  <option value="">Select Vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehicle_type} - {vehicle.registration_number} ({vehicle.seating_capacity} seats)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Rental Type</label>
                  <select
                    name="rental_type"
                    value={formData.rental_type}
                    onChange={handleChange}
                    className="input"
                  >
                    <option value="">Select Type</option>
                    <option value="self_drive">Self Drive</option>
                    <option value="with_driver">With Driver</option>
                    <option value="airport_transfer">Airport Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="label">Pickup Location</label>
                  <input
                    type="text"
                    name="pickup_location"
                    value={formData.pickup_location}
                    onChange={handleChange}
                    className="input"
                    placeholder="e.g., Entebbe Airport"
                  />
                </div>
                <div>
                  <label className="label">Dropoff Location</label>
                  <input
                    type="text"
                    name="dropoff_location"
                    value={formData.dropoff_location}
                    onChange={handleChange}
                    className="input"
                    placeholder="e.g., Kampala Hotel"
                  />
                </div>
              </div>
              {selectedVehicle && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>{selectedVehicle.vehicle_type}</strong> - {selectedVehicle.registration_number}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Capacity: {selectedVehicle.seating_capacity} seats
                    {selectedVehicle.daily_rate_usd && ` | Daily Rate: ${formatPrice(selectedVehicle.daily_rate_usd, formData.currency)}`}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Travel Dates & Guests */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <CalendarDaysIcon className="h-5 w-5 text-breco-navy" />
            <h2 className="text-lg font-semibold text-gray-900">Travel Details</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Start Date *</label>
              <input
                type="date"
                name="travel_start_date"
                value={formData.travel_start_date}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">End Date *</label>
              <input
                type="date"
                name="travel_end_date"
                value={formData.travel_end_date}
                onChange={handleChange}
                className="input"
                required
                min={formData.travel_start_date}
              />
            </div>
            <div>
              <label className="label">Number of Adults *</label>
              <input
                type="number"
                name="num_adults"
                value={formData.num_adults}
                onChange={handleChange}
                className="input"
                min="0"
                required
              />
            </div>
            <div>
              <label className="label">Number of Children</label>
              <input
                type="number"
                name="num_children"
                value={formData.num_children}
                onChange={handleChange}
                className="input"
                min="0"
              />
            </div>
            <div>
              <label className="label">Number of Infants</label>
              <input
                type="number"
                name="num_infants"
                value={formData.num_infants}
                onChange={handleChange}
                className="input"
                min="0"
              />
            </div>
          </div>
          {formData.travel_start_date && formData.travel_end_date && (
            <p className="text-sm text-gray-600 mt-3">
              Duration: {calculateNumDays()} day(s)
            </p>
          )}
        </div>

        {/* Pricing */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <CurrencyDollarIcon className="h-5 w-5 text-breco-navy" />
            <h2 className="text-lg font-semibold text-gray-900">Pricing</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Currency</label>
              <CurrencySelect
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value as 'USD' | 'EUR' | 'GBP' | 'UGX' }))}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Discount Amount</label>
                <input
                  type="number"
                  name="discount_amount"
                  value={formData.discount_amount}
                  onChange={handleChange}
                  className="input"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{formatPrice(formData.subtotal, formData.currency)}</span>
              </div>
              {formData.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-medium text-red-600">-{formatPrice(formData.discount_amount, formData.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax (18%):</span>
                <span className="font-medium">{formatPrice(formData.tax_amount, formData.currency)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="font-semibold text-gray-900">Total:</span>
                <span className="font-bold text-lg text-breco-navy">{formatPrice(formData.total, formData.currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <DocumentTextIcon className="h-5 w-5 text-breco-navy" />
            <h2 className="text-lg font-semibold text-gray-900">Additional Information</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Special Requests</label>
              <textarea
                name="special_requests"
                value={formData.special_requests}
                onChange={handleChange}
                rows={3}
                className="input"
                placeholder="Any special requests or preferences..."
              />
            </div>
            <div>
              <label className="label">Dietary Requirements</label>
              <textarea
                name="dietary_requirements"
                value={formData.dietary_requirements}
                onChange={handleChange}
                rows={2}
                className="input"
                placeholder="Any dietary restrictions or preferences..."
              />
            </div>
            <div>
              <label className="label">Internal Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="input"
                placeholder="Internal notes (not visible to customer)..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <Link
            href={`/dashboard/bookings/${bookingId}`}
            className="btn-secondary"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? 'Updating...' : 'Update Booking'}
          </button>
        </div>
      </form>
    </div>
  );
}

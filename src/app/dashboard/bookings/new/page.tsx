'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import type { TourPackage, Hotel, Vehicle } from '@/types/breco';

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
}

export default function NewBookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageId = searchParams.get('package');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tourPackages, setTourPackages] = useState<TourPackage[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<TourPackage | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<BookingFormData>({
    customer_id: '',
    booking_type: 'tour',
    tour_package_id: packageId || '',
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
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.tour_package_id && tourPackages.length > 0) {
      const pkg = tourPackages.find(p => p.id === formData.tour_package_id);
      setSelectedPackage(pkg || null);
      
      if (pkg) {
        // Set default travel dates if duration is known
        if (!formData.travel_start_date && pkg.duration_days) {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() + 7);
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + pkg.duration_days);
          
          setFormData(prev => ({
            ...prev,
            travel_start_date: startDate.toISOString().split('T')[0],
            travel_end_date: endDate.toISOString().split('T')[0],
          }));
        }
      }
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
    try {
      const [customersRes, packagesRes, hotelsRes, vehiclesRes] = await Promise.all([
        supabase.from('customers').select('*').eq('is_active', true).order('name'),
        supabase.from('tour_packages').select('*').eq('is_active', true).order('name'),
        supabase.from('hotels').select('*').eq('is_active', true).order('name'),
        supabase.from('vehicles').select('*').eq('is_active', true).eq('status', 'available').order('vehicle_type'),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (packagesRes.error) throw packagesRes.error;
      if (hotelsRes.error) throw hotelsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      setCustomers(customersRes.data || []);
      setTourPackages(packagesRes.data || []);
      setHotels(hotelsRes.data || []);
      setVehicles(vehiclesRes.data || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error('Failed to load data');
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

  const generateBookingNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('booking_number')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastNumber = data[0].booking_number;
        const match = lastNumber.match(/BKG-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      return `BKG-${String(nextNumber).padStart(5, '0')}`;
    } catch (err) {
      console.error('Failed to generate booking number:', err);
      return `BKG-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
    }
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

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Generate booking number
      const bookingNumber = await generateBookingNumber();

      // Prepare insert data
      const insertData: any = {
        booking_number: bookingNumber,
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
        amount_paid: 0,
        currency: formData.currency,
        status: 'inquiry',
        special_requests: formData.special_requests || null,
        dietary_requirements: formData.dietary_requirements || null,
        notes: formData.notes || null,
        created_by: user?.id,
      };

      // Add type-specific fields
      if (formData.booking_type === 'tour' || (formData.booking_type === 'custom' && formData.tour_package_id)) {
        insertData.tour_package_id = formData.tour_package_id || null;
      }

      if (formData.booking_type === 'hotel' || (formData.booking_type === 'custom' && formData.hotel_id)) {
        insertData.hotel_id = formData.hotel_id || null;
        insertData.room_type = formData.room_type || null;
        insertData.num_rooms = formData.num_rooms;
      }

      if (formData.booking_type === 'car_hire' || (formData.booking_type === 'custom' && formData.assigned_vehicle_id)) {
        insertData.assigned_vehicle_id = formData.assigned_vehicle_id || null;
        insertData.rental_type = formData.rental_type || null;
        insertData.pickup_location = formData.pickup_location || null;
        insertData.dropoff_location = formData.dropoff_location || null;
      }

      // Insert booking
      const { data, error } = await supabase
        .from('bookings')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      toast.success('Booking created successfully!');
      router.push(`/dashboard/bookings/${data.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create booking';
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-breco-navy border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/bookings"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Booking</h1>
          <p className="text-gray-600">Create a new booking</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <div className="flex items-center gap-2">
            <InformationCircleIcon className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Booking Type Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Select Booking Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, booking_type: 'tour' }))}
              className={`p-4 rounded-lg border-2 transition-all ${
                formData.booking_type === 'tour'
                  ? 'border-breco-navy bg-breco-navy/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <MapIcon className={`w-8 h-8 mx-auto mb-2 ${formData.booking_type === 'tour' ? 'text-breco-navy' : 'text-gray-400'}`} />
              <div className="text-sm font-medium text-gray-900">Tour Package</div>
              <div className="text-xs text-gray-500 mt-1">Safari tours</div>
            </button>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, booking_type: 'hotel' }))}
              className={`p-4 rounded-lg border-2 transition-all ${
                formData.booking_type === 'hotel'
                  ? 'border-breco-navy bg-breco-navy/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <BuildingOffice2Icon className={`w-8 h-8 mx-auto mb-2 ${formData.booking_type === 'hotel' ? 'text-breco-navy' : 'text-gray-400'}`} />
              <div className="text-sm font-medium text-gray-900">Hotel Only</div>
              <div className="text-xs text-gray-500 mt-1">Accommodation</div>
            </button>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, booking_type: 'car_hire' }))}
              className={`p-4 rounded-lg border-2 transition-all ${
                formData.booking_type === 'car_hire'
                  ? 'border-breco-navy bg-breco-navy/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <TruckIcon className={`w-8 h-8 mx-auto mb-2 ${formData.booking_type === 'car_hire' ? 'text-breco-navy' : 'text-gray-400'}`} />
              <div className="text-sm font-medium text-gray-900">Car Hire</div>
              <div className="text-xs text-gray-500 mt-1">Vehicle rental</div>
            </button>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, booking_type: 'custom' }))}
              className={`p-4 rounded-lg border-2 transition-all ${
                formData.booking_type === 'custom'
                  ? 'border-breco-navy bg-breco-navy/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <DocumentTextIcon className={`w-8 h-8 mx-auto mb-2 ${formData.booking_type === 'custom' ? 'text-breco-navy' : 'text-gray-400'}`} />
              <div className="text-sm font-medium text-gray-900">Custom</div>
              <div className="text-xs text-gray-500 mt-1">Combination</div>
            </button>
          </div>
        </div>

        {/* Customer & Basic Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <DocumentTextIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Booking Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                name="customer_id"
                value={formData.customer_id}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                <option value="">Select customer</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Booking Date
              </label>
              <input
                type="date"
                name="booking_date"
                value={formData.booking_date}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <CurrencySelect
                value={formData.currency}
                onChange={(value) => setFormData(prev => ({ ...prev, currency: value as any }))}
              />
            </div>
          </div>
        </div>

        {/* Tour Package Section */}
        {(formData.booking_type === 'tour') && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <MapIcon className="w-5 h-5 text-breco-navy" />
              <h2 className="font-semibold text-gray-900">Tour Package</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Package <span className="text-red-500">*</span>
              </label>
              <select
                name="tour_package_id"
                value={formData.tour_package_id}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                <option value="">Select tour package</option>
                {tourPackages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.package_code} - {pkg.name} ({pkg.duration_days}D/{pkg.duration_nights}N)
                  </option>
                ))}
              </select>
              {selectedPackage && (
                <p className="text-xs text-gray-500 mt-1">
                  Base Price: {formatPrice(selectedPackage.base_price_usd, 'USD')}
                  {selectedPackage.price_per_person ? ' per person' : ' per group'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Hotel Section */}
        {(formData.booking_type === 'hotel' || formData.booking_type === 'custom') && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <BuildingOffice2Icon className="w-5 h-5 text-breco-navy" />
              <h2 className="font-semibold text-gray-900">Hotel Accommodation</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Hotel {formData.booking_type === 'hotel' && <span className="text-red-500">*</span>}
                </label>
                <select
                  name="hotel_id"
                  value={formData.hotel_id}
                  onChange={handleChange}
                  required={formData.booking_type === 'hotel'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                >
                  <option value="">Select hotel</option>
                  {hotels.map(hotel => (
                    <option key={hotel.id} value={hotel.id}>
                      {hotel.name} {hotel.star_rating && `(${hotel.star_rating}★)`}
                    </option>
                  ))}
                </select>
                {selectedHotel && selectedHotel.standard_rate_usd && (
                  <p className="text-xs text-gray-500 mt-1">
                    Standard Rate: {formatPrice(selectedHotel.standard_rate_usd, 'USD')} per night
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Type
                </label>
                <select
                  name="room_type"
                  value={formData.room_type}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                >
                  <option value="">Select room type</option>
                  <option value="Standard">Standard</option>
                  <option value="Deluxe">Deluxe</option>
                  <option value="Suite">Suite</option>
                  <option value="Family">Family</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Rooms
                </label>
                <input
                  type="number"
                  name="num_rooms"
                  value={formData.num_rooms}
                  onChange={handleChange}
                  min="1"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                />
              </div>
            </div>
          </div>
        )}

        {/* Vehicle/Car Hire Section */}
        {(formData.booking_type === 'car_hire' || formData.booking_type === 'custom') && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <TruckIcon className="w-5 h-5 text-breco-navy" />
              <h2 className="font-semibold text-gray-900">Vehicle Rental</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Vehicle {formData.booking_type === 'car_hire' && <span className="text-red-500">*</span>}
                </label>
                <select
                  name="assigned_vehicle_id"
                  value={formData.assigned_vehicle_id}
                  onChange={handleChange}
                  required={formData.booking_type === 'car_hire'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                >
                  <option value="">Select vehicle</option>
                  {vehicles.map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehicle_type} - {vehicle.registration_number} ({vehicle.seating_capacity} seats)
                    </option>
                  ))}
                </select>
                {selectedVehicle && selectedVehicle.daily_rate_usd && (
                  <p className="text-xs text-gray-500 mt-1">
                    Daily Rate: {formatPrice(selectedVehicle.daily_rate_usd, 'USD')} per day
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rental Type
                </label>
                <select
                  name="rental_type"
                  value={formData.rental_type}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                >
                  <option value="">Select type</option>
                  <option value="self_drive">Self Drive</option>
                  <option value="with_driver">With Driver (+$30/day)</option>
                  <option value="airport_transfer">Airport Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pickup Location
                </label>
                <input
                  type="text"
                  name="pickup_location"
                  value={formData.pickup_location}
                  onChange={handleChange}
                  placeholder="e.g., Entebbe Airport"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Drop-off Location
                </label>
                <input
                  type="text"
                  name="dropoff_location"
                  value={formData.dropoff_location}
                  onChange={handleChange}
                  placeholder="e.g., Kampala Hotel"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                />
              </div>
            </div>
          </div>
        )}

        {/* Travel Dates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CalendarDaysIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">
              {formData.booking_type === 'hotel' ? 'Stay Dates' : 'Travel Dates'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.booking_type === 'hotel' ? 'Check-in Date' : 'Start Date'} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="travel_start_date"
                value={formData.travel_start_date}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.booking_type === 'hotel' ? 'Check-out Date' : 'End Date'} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="travel_end_date"
                value={formData.travel_end_date}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>
          </div>
          {formData.travel_start_date && formData.travel_end_date && (
            <p className="text-sm text-gray-600 mt-2">
              Duration: {calculateNumDays()} {calculateNumDays() === 1 ? 'day' : 'days'}
            </p>
          )}
        </div>

        {/* Group Size */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <UserGroupIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">
              {formData.booking_type === 'hotel' ? 'Guests' : 'Travelers'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adults <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="num_adults"
                value={formData.num_adults}
                onChange={handleChange}
                required
                min="1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Children (5-12 years)
              </label>
              <input
                type="number"
                name="num_children"
                value={formData.num_children}
                onChange={handleChange}
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Infants (0-4 years)
              </label>
              <input
                type="number"
                name="num_infants"
                value={formData.num_infants}
                onChange={handleChange}
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CurrencyDollarIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Pricing</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subtotal
                </label>
                <input
                  type="number"
                  name="subtotal"
                  value={formData.subtotal}
                  onChange={handleChange}
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy bg-gray-50"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount
                </label>
                <input
                  type="number"
                  name="discount_amount"
                  value={formData.discount_amount}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Tax (18% VAT)</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatPrice(formData.tax_amount, formData.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-breco-navy">
                  {formatPrice(formData.total, formData.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Additional Information</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Requests
              </label>
              <textarea
                name="special_requests"
                value={formData.special_requests}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="E.g., window seats, room preferences, celebration occasions..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dietary Requirements
              </label>
              <textarea
                name="dietary_requirements"
                value={formData.dietary_requirements}
                onChange={handleChange}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="Vegetarian, vegan, allergies, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Internal Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="Internal notes about the booking..."
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/dashboard/bookings" className="btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Creating...
              </>
            ) : (
              'Create Booking'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

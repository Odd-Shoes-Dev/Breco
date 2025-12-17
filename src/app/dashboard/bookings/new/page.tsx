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
} from '@heroicons/react/24/outline';
import type { Customer } from '@/types/database';
import type { TourPackage } from '@/types/breco';

interface BookingFormData {
  customer_id: string;
  booking_type: 'tour' | 'hotel' | 'car_hire' | 'custom';
  tour_package_id: string;
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
  const [selectedPackage, setSelectedPackage] = useState<TourPackage | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<BookingFormData>({
    customer_id: '',
    booking_type: 'tour',
    tour_package_id: packageId || '',
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
    if (formData.tour_package_id) {
      const pkg = tourPackages.find(p => p.id === formData.tour_package_id);
      setSelectedPackage(pkg || null);
      
      if (pkg) {
        // Auto-calculate pricing
        calculateTotal(pkg);
        
        // Set default travel dates if duration is known
        if (!formData.travel_start_date && pkg.duration_days) {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() + 7); // 7 days from now
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
    // Recalculate when travelers or discount changes
    if (selectedPackage) {
      calculateTotal(selectedPackage);
    }
  }, [formData.num_adults, formData.num_children, formData.discount_amount]);

  const loadData = async () => {
    try {
      const [customersRes, packagesRes] = await Promise.all([
        supabase.from('customers').select('*').eq('is_active', true).order('name'),
        supabase.from('tour_packages').select('*').eq('is_active', true).order('name'),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (packagesRes.error) throw packagesRes.error;

      setCustomers(customersRes.data || []);
      setTourPackages(packagesRes.data || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = (pkg: TourPackage) => {
    const basePrice = pkg.base_price_usd;
    let subtotal = 0;

    if (pkg.price_per_person) {
      // Children might be at a different rate (for now, using 50% of adult price)
      subtotal = (basePrice * formData.num_adults) + (basePrice * 0.5 * formData.num_children);
    } else {
      // Group pricing
      subtotal = basePrice;
    }

    const discount = formData.discount_amount || 0;
    const taxRate = 0.18; // 18% VAT in Uganda
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
      if (formData.booking_type === 'tour' && !formData.tour_package_id) {
        throw new Error('Please select a tour package');
      }

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Generate booking number
      const bookingNumber = await generateBookingNumber();

      // Insert booking
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          booking_number: bookingNumber,
          customer_id: formData.customer_id,
          booking_type: formData.booking_type,
          tour_package_id: formData.tour_package_id || null,
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
        })
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
          <p className="text-gray-600">Create a new tour booking</p>
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
        {/* Customer & Package Selection */}
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
                Booking Type
              </label>
              <select
                name="booking_type"
                value={formData.booking_type}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                <option value="tour">Tour Package</option>
                <option value="hotel">Hotel Only</option>
                <option value="car_hire">Car Hire</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {formData.booking_type === 'tour' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tour Package <span className="text-red-500">*</span>
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
            )}

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

        {/* Travel Dates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CalendarDaysIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Travel Dates</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date <span className="text-red-500">*</span>
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
                End Date <span className="text-red-500">*</span>
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
        </div>

        {/* Group Size */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <UserGroupIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Travelers</h2>
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

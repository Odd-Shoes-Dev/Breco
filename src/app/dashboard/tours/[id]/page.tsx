'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { formatCurrency, type SupportedCurrency } from '@/lib/currency';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  GlobeAltIcon,
  ClockIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  StarIcon,
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import type { TourPackage, Destination } from '@/types/breco';

export default function TourPackageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [pkg, setPkg] = useState<TourPackage & { primary_destination?: Destination } | null>(null);
  const [images, setImages] = useState<Array<{ id: string; image_url: string; is_primary: boolean; caption: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  useEffect(() => {
    fetchPackage();
  }, [params.id]);

  const fetchPackage = async () => {
    try {
      const response = await fetch(`/api/tours/${params.id}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch tour package');
      }
      
      setPkg(result.data);
      setImages(result.data?.images || []);
    } catch (error) {
      console.error('Failed to fetch tour package:', error);
      toast.error('Failed to load tour package');
      router.push('/dashboard/tours');
    } finally {
      setLoading(false);
    }
  };

  const toggleFeatured = async () => {
    if (!pkg) return;

    try {
      const response = await fetch(`/api/tours/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_featured: !pkg.is_featured }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update package');
      }

      setPkg({ ...pkg, is_featured: !pkg.is_featured });
      toast.success(pkg.is_featured ? 'Removed from featured' : 'Marked as featured');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update package');
    }
  };

  const toggleActive = async () => {
    if (!pkg) return;

    try {
      const response = await fetch(`/api/tours/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !pkg.is_active }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update package');
      }

      setPkg({ ...pkg, is_active: !pkg.is_active });
      toast.success(pkg.is_active ? 'Package deactivated' : 'Package activated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update package');
    }
  };

  const handleDelete = async () => {
    if (!pkg) return;
    
    if (!confirm('Are you sure you want to delete this tour package? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/tours/${pkg.id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete package');
      }

      toast.success('Tour package deleted');
      router.push('/dashboard/tours');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete package');
      setDeleting(false);
    }
  };

  const formatPrice = (price: number, currency: SupportedCurrency = 'USD') => {
    return formatCurrency(price, currency);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-breco-navy border-t-transparent" />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Tour package not found</h2>
        <Link href="/dashboard/tours" className="btn-primary mt-4 inline-flex items-center gap-2">
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Tour Packages
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/dashboard/tours"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors mt-1"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{pkg.name}</h1>
              {pkg.is_featured && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-breco-gold text-white text-xs font-semibold rounded-full">
                  <StarSolidIcon className="w-3 h-3" />
                  Featured
                </span>
              )}
              {pkg.is_active ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                  <CheckCircleIcon className="w-3 h-3" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">
                  <XCircleIcon className="w-3 h-3" />
                  Inactive
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="font-mono">{pkg.package_code}</span>
              {pkg.tour_type && (
                <>
                  <span>•</span>
                  <span>{pkg.tour_type}</span>
                </>
              )}
              <span>•</span>
              <span>
                {pkg.duration_days} {pkg.duration_days === 1 ? 'Day' : 'Days'} / {pkg.duration_nights}{' '}
                {pkg.duration_nights === 1 ? 'Night' : 'Nights'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFeatured}
            className={`btn-sm ${
              pkg.is_featured ? 'bg-breco-gold text-white' : 'btn-secondary'
            }`}
            title={pkg.is_featured ? 'Remove from featured' : 'Mark as featured'}
          >
            <StarIcon className="w-4 h-4" />
          </button>
          <button
            onClick={toggleActive}
            className="btn-secondary btn-sm"
            title={pkg.is_active ? 'Deactivate package' : 'Activate package'}
          >
            {pkg.is_active ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
          </button>
          <Link href={`/dashboard/tours/${pkg.id}/edit`} className="btn-secondary btn-sm">
            <PencilIcon className="w-4 h-4" />
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-danger btn-sm disabled:opacity-50"
          >
            <TrashIcon className="w-4 h-4" />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image Gallery */}
          {(images.length > 0 || pkg.image_url) && (
            <div className="card overflow-hidden">
              {/* Main Image */}
              <div className="relative">
                <img
                  src={images.length > 0 ? images[selectedImageIndex]?.image_url : pkg.image_url || ''}
                  alt={pkg.name}
                  className="w-full h-96 object-cover"
                />
                {images.length > 1 && (
                  <>
                    {/* Previous Button */}
                    <button
                      onClick={() => setSelectedImageIndex((selectedImageIndex - 1 + images.length) % images.length)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-all"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    {/* Next Button */}
                    <button
                      onClick={() => setSelectedImageIndex((selectedImageIndex + 1) % images.length)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-all"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Image Counter */}
                    <div className="absolute bottom-4 right-4 bg-black bg-opacity-75 text-white text-sm px-3 py-1 rounded-full">
                      {selectedImageIndex + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnail Strip */}
              {images.length > 1 && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {images.map((img, index) => (
                      <div key={img.id} className="relative flex-shrink-0">
                        <img
                          src={img.image_url}
                          alt={`Thumbnail ${index + 1}`}
                          onClick={() => setSelectedImageIndex(index)}
                          className={`w-20 h-20 object-cover rounded cursor-pointer transition-all ${
                            selectedImageIndex === index 
                              ? 'ring-4 ring-breco-navy opacity-100' 
                              : 'opacity-60 hover:opacity-100'
                          }`}
                        />
                        {img.is_primary && (
                          <div className="absolute -top-1 -right-1 bg-breco-gold text-white rounded-full p-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {pkg.description && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Overview</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{pkg.description}</p>
            </div>
          )}

          {/* Inclusions & Exclusions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pkg.inclusions && (
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  Inclusions
                </h3>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{pkg.inclusions}</div>
              </div>
            )}

            {pkg.exclusions && (
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <XCircleIcon className="w-5 h-5 text-red-600" />
                  Exclusions
                </h3>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{pkg.exclusions}</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Key Details */}
        <div className="space-y-6">
          {/* Pricing */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <CurrencyDollarIcon className="w-5 h-5 text-breco-navy" />
              <h3 className="font-semibold text-gray-900">Pricing</h3>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-2xl font-bold text-breco-navy">
                  {formatPrice(pkg.base_price_usd, 'USD')}
                </div>
                <div className="text-xs text-gray-500">
                  {pkg.price_per_person ? 'per person' : 'per group'}
                </div>
              </div>

              {pkg.base_price_eur && pkg.base_price_eur > 0 && (
                <div className="text-sm text-gray-600">
                  {formatPrice(pkg.base_price_eur, 'EUR')}
                </div>
              )}

              {pkg.base_price_ugx && pkg.base_price_ugx > 0 && (
                <div className="text-sm text-gray-600">
                  {formatPrice(pkg.base_price_ugx, 'UGX')}
                </div>
              )}
            </div>
          </div>

          {/* Duration & Capacity */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <ClockIcon className="w-5 h-5 text-breco-navy" />
              <h3 className="font-semibold text-gray-900">Duration & Capacity</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium text-gray-900">
                  {pkg.duration_days}D / {pkg.duration_nights}N
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Group Size:</span>
                <span className="font-medium text-gray-900">
                  {pkg.min_group_size} - {pkg.max_group_size} guests
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Difficulty:</span>
                <span className="font-medium text-gray-900 capitalize">{pkg.difficulty_level}</span>
              </div>
            </div>
          </div>

          {/* Primary Destination */}
          {pkg.primary_destination && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPinIcon className="w-5 h-5 text-breco-navy" />
                <h3 className="font-semibold text-gray-900">Primary Destination</h3>
              </div>
              <div>
                <div className="font-medium text-gray-900">{pkg.primary_destination.name}</div>
                <div className="text-sm text-gray-500">{pkg.primary_destination.country}</div>
                {pkg.primary_destination.region && (
                  <div className="text-xs text-gray-400">{pkg.primary_destination.region}</div>
                )}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Package Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="text-gray-900">
                  {new Date(pkg.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Last Updated:</span>
                <span className="text-gray-900">
                  {new Date(pkg.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href={`/dashboard/bookings/new?package=${pkg.id}`}
                className="btn-primary w-full justify-center"
              >
                Create Booking
              </Link>
              <Link
                href={`/dashboard/invoices/new?package=${pkg.id}`}
                className="btn-secondary w-full justify-center"
              >
                Create Quote
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* TODO: Add sections for itineraries, destinations, seasonal pricing */}
      {/* These can be added in future iterations */}
    </div>
  );
}

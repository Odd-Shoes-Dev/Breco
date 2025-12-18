'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon,
  StarIcon,
  CurrencyDollarIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import type { Hotel, Destination } from '@/types/breco';

export default function HotelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [hotel, setHotel] = useState<Hotel & { destination?: Destination } | null>(null);
  const [images, setImages] = useState<Array<{ id: string; image_url: string; is_primary: boolean; caption: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  useEffect(() => {
    fetchHotel();
  }, [params.id]);

  const fetchHotel = async () => {
    try {
      const [hotelRes, imagesRes] = await Promise.all([
        supabase
          .from('hotels')
          .select(`
            *,
            destination:destinations(*)
          `)
          .eq('id', params.id)
          .single(),
        supabase
          .from('hotel_images')
          .select('*')
          .eq('hotel_id', params.id)
          .order('display_order')
      ]);

      if (hotelRes.error) throw hotelRes.error;
      setHotel(hotelRes.data);
      
      console.log('Fetched images:', imagesRes.data);
      if (imagesRes.error) {
        console.error('Images fetch error:', imagesRes.error);
      }
      
      setImages(imagesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch hotel:', error);
      toast.error('Failed to load hotel');
      router.push('/dashboard/hotels');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async () => {
    if (!hotel) return;

    try {
      const { error } = await supabase
        .from('hotels')
        .update({ is_active: !hotel.is_active })
        .eq('id', hotel.id);

      if (error) throw error;

      setHotel({ ...hotel, is_active: !hotel.is_active });
      toast.success(hotel.is_active ? 'Hotel deactivated' : 'Hotel activated');
    } catch (error) {
      toast.error('Failed to update hotel');
    }
  };

  const handleDelete = async () => {
    if (!hotel) return;
    
    if (!confirm('Are you sure you want to delete this hotel? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('hotels')
        .delete()
        .eq('id', hotel.id);

      if (error) throw error;

      toast.success('Hotel deleted');
      router.push('/dashboard/hotels');
    } catch (error) {
      toast.error('Failed to delete hotel');
      setDeleting(false);
    }
  };

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'UGX' ? 0 : 2,
      maximumFractionDigits: currency === 'UGX' ? 0 : 2,
    }).format(price);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarSolidIcon
            key={star}
            className={`w-5 h-5 ${star <= rating ? 'text-breco-gold' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-breco-navy border-t-transparent" />
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Hotel not found</h2>
        <Link href="/dashboard/hotels" className="btn-primary mt-4 inline-flex items-center gap-2">
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Hotels
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
            href="/dashboard/hotels"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors mt-1"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BuildingStorefrontIcon className="w-6 h-6 text-breco-navy" />
              <h1 className="text-2xl font-bold text-gray-900">{hotel.name}</h1>
              {hotel.is_active ? (
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
              {hotel.star_rating && (
                <div className="flex items-center gap-1">
                  {renderStars(hotel.star_rating)}
                </div>
              )}
              {hotel.hotel_type && (
                <>
                  <span>•</span>
                  <span className="capitalize">{hotel.hotel_type}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleActive}
            className="btn-secondary btn-sm"
            title={hotel.is_active ? 'Deactivate hotel' : 'Activate hotel'}
          >
            {hotel.is_active ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
          </button>
          <Link href={`/dashboard/hotels/${hotel.id}/edit`} className="btn-secondary btn-sm">
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
          {images.length > 0 && (
            <div className="card overflow-hidden">
              {/* Main Image */}
              <div className="relative">
                <img
                  src={images[selectedImageIndex]?.image_url || ''}
                  alt={hotel.name}
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

          {/* Notes Section */}
          {hotel.notes && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Notes</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{hotel.notes}</p>
            </div>
          )}
        </div>

        {/* Right Column - Key Details */}
        <div className="space-y-6">
          {/* Room Rates */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <CurrencyDollarIcon className="w-5 h-5 text-breco-navy" />
              <h3 className="font-semibold text-gray-900">Room Rates</h3>
            </div>
            <div className="space-y-3">
              {hotel.standard_rate_usd && hotel.standard_rate_usd > 0 && (
                <div className="border-b border-gray-200 pb-2">
                  <div className="text-sm text-gray-600 mb-1">Standard Room</div>
                  <div className="text-xl font-bold text-breco-navy">
                    {formatPrice(hotel.standard_rate_usd, 'USD')}
                  </div>
                  <div className="text-xs text-gray-500">per night</div>
                </div>
              )}

              {hotel.deluxe_rate_usd && hotel.deluxe_rate_usd > 0 && (
                <div className="border-b border-gray-200 pb-2">
                  <div className="text-sm text-gray-600 mb-1">Deluxe Room</div>
                  <div className="text-xl font-bold text-breco-navy">
                    {formatPrice(hotel.deluxe_rate_usd, 'USD')}
                  </div>
                  <div className="text-xs text-gray-500">per night</div>
                </div>
              )}

              {hotel.suite_rate_usd && hotel.suite_rate_usd > 0 && (
                <div className="pb-2">
                  <div className="text-sm text-gray-600 mb-1">Suite</div>
                  <div className="text-xl font-bold text-breco-navy">
                    {formatPrice(hotel.suite_rate_usd, 'USD')}
                  </div>
                  <div className="text-xs text-gray-500">per night</div>
                </div>
              )}

              {hotel.commission_rate && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Commission Rate:</span>
                    <span className="font-semibold text-gray-900">{hotel.commission_rate}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <PhoneIcon className="w-5 h-5 text-breco-navy" />
              <h3 className="font-semibold text-gray-900">Contact Information</h3>
            </div>
            <div className="space-y-3 text-sm">
              {hotel.contact_person && (
                <div>
                  <div className="text-gray-600 text-xs mb-1">Contact Person</div>
                  <div className="font-medium text-gray-900">{hotel.contact_person}</div>
                </div>
              )}
              {hotel.phone && (
                <div className="flex items-center gap-2">
                  <PhoneIcon className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${hotel.phone}`} className="text-breco-navy hover:underline">
                    {hotel.phone}
                  </a>
                </div>
              )}
              {hotel.email && (
                <div className="flex items-center gap-2">
                  <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${hotel.email}`} className="text-breco-navy hover:underline">
                    {hotel.email}
                  </a>
                </div>
              )}
              {hotel.website && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <a href={hotel.website} target="_blank" rel="noopener noreferrer" className="text-breco-navy hover:underline">
                    Visit Website
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          {hotel.destination && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPinIcon className="w-5 h-5 text-breco-navy" />
                <h3 className="font-semibold text-gray-900">Location</h3>
              </div>
              <div>
                <div className="font-medium text-gray-900">{hotel.destination.name}</div>
                <div className="text-sm text-gray-500">{hotel.destination.country}</div>
                {hotel.destination.region && (
                  <div className="text-xs text-gray-400">{hotel.destination.region}</div>
                )}
                {hotel.address && (
                  <div className="mt-2 text-sm text-gray-700">{hotel.address}</div>
                )}
              </div>
            </div>
          )}

          {/* Hotel Information */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Hotel Information</h3>
            <div className="space-y-2 text-sm">
              {hotel.star_rating && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Star Rating:</span>
                  <div>{renderStars(hotel.star_rating)}</div>
                </div>
              )}
              {hotel.hotel_type && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="text-gray-900 capitalize">{hotel.hotel_type}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-600">Created:</span>
                <span className="text-gray-900">
                  {new Date(hotel.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Last Updated:</span>
                <span className="text-gray-900">
                  {new Date(hotel.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href={`/dashboard/bookings/new?hotel=${hotel.id}`}
                className="btn-primary w-full justify-center"
              >
                Create Booking
              </Link>
              <Link
                href={`/dashboard/invoices/new?hotel=${hotel.id}`}
                className="btn-secondary w-full justify-center"
              >
                Create Invoice
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

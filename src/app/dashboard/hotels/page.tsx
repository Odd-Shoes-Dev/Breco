'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Hotel, Destination } from '@/types/breco';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  BuildingStorefrontIcon,
  StarIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

interface HotelImage {
  id: string;
  hotel_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  caption?: string;
}

interface HotelWithDestination extends Hotel {
  destination?: Destination;
  images?: HotelImage[];
  primary_image?: HotelImage;
}

export default function HotelsPage() {
  const [hotels, setHotels] = useState<HotelWithDestination[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [destinationFilter, setDestinationFilter] = useState<string>('all');

  useEffect(() => {
    fetchHotels();
    fetchDestinations();
  }, []);

  const fetchHotels = async () => {
    try {
      const response = await fetch('/api/hotels');
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch hotels');
      }
      
      // Fetch images for all hotels
      const imagesPromises = (result.data || []).map(async (hotel: Hotel) => {
        try {
          const detailResponse = await fetch(`/api/hotels/${hotel.id}`);
          const detailResult = await detailResponse.json();
          return {
            ...hotel,
            images: detailResult.data?.images || [],
            primary_image: detailResult.data?.images?.find((img: any) => img.is_primary),
          };
        } catch {
          return hotel;
        }
      });
      
      const hotelsWithImages = await Promise.all(imagesPromises);
      setHotels(hotelsWithImages);
    } catch (error) {
      console.error('Error fetching hotels:', error);
      toast.error('Failed to load hotels');
    } finally {
      setLoading(false);
    }
  };

  const fetchDestinations = async () => {
    try {
      // Destinations can be fetched from tours API for now
      // TODO: Create dedicated destinations API endpoint
      setDestinations([]);
    } catch (error) {
      console.error('Error fetching destinations:', error);
    }
  };

  const deleteHotel = async (id: string) => {
    if (!confirm('Are you sure you want to delete this hotel?')) return;

    try {
      const response = await fetch(`/api/hotels/${id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete hotel');
      }
      
      setHotels(prev => prev.filter(h => h.id !== id));
      toast.success('Hotel deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete hotel');
    }
  };

  const toggleActive = async (hotel: Hotel) => {
    try {
      const response = await fetch(`/api/hotels/${hotel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !hotel.is_active }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update hotel');
      }
      
      setHotels(prev => 
        prev.map(h => h.id === hotel.id ? { ...h, is_active: !h.is_active } : h)
      );
      
      toast.success(hotel.is_active ? 'Hotel deactivated' : 'Hotel activated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update hotel');
    }
  };

  const filteredHotels = hotels.filter(hotel => {
    const matchesSearch = 
      hotel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hotel.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hotel.destination?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDestination = destinationFilter === 'all' || hotel.destination_id === destinationFilter;
    
    return matchesSearch && matchesDestination;
  });

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          i < rating ? (
            <StarSolidIcon key={i} className="w-4 h-4 text-breco-gold" />
          ) : (
            <StarIcon key={i} className="w-4 h-4 text-gray-300" />
          )
        ))}
      </div>
    );
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
          <h1 className="text-2xl font-bold text-gray-900">Partner Hotels</h1>
          <p className="text-gray-500 mt-1">Manage accommodation partners for tour bookings</p>
        </div>
        <Link
          href="/dashboard/hotels/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Add Hotel
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-2xl font-bold text-gray-900">{hotels.length}</p>
          <p className="text-sm text-gray-500">Total Hotels</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-gray-900">
            {hotels.filter(h => h.is_partner).length}
          </p>
          <p className="text-sm text-gray-500">Partners</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-gray-900">
            {hotels.filter(h => h.is_active).length}
          </p>
          <p className="text-sm text-gray-500">Active</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-gray-900">
            {Math.round(hotels.reduce((sum, h) => sum + (h.commission_rate || 0), 0) / hotels.length || 0)}%
          </p>
          <p className="text-sm text-gray-500">Avg Commission</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search hotels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value)}
            className="input w-full sm:w-56"
          >
            <option value="all">All Destinations</option>
            {destinations.map(dest => (
              <option key={dest.id} value={dest.id}>{dest.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Hotels Grid */}
      {filteredHotels.length === 0 ? (
        <div className="card p-12 text-center">
          <BuildingStorefrontIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hotels found</h3>
          <p className="text-gray-500 mb-4">Add your first partner hotel</p>
          <Link
            href="/dashboard/hotels/new"
            className="btn-primary inline-flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Add Hotel
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHotels.map((hotel) => (
            <div key={hotel.id} className={`card overflow-hidden ${!hotel.is_active ? 'opacity-60' : ''}`}>
              <div className="h-32 bg-gradient-to-br from-breco-navy to-breco-navy-light flex items-center justify-center overflow-hidden">
                {hotel.primary_image?.image_url || hotel.images?.[0]?.image_url ? (
                  <img 
                    src={hotel.primary_image?.image_url || hotel.images?.[0]?.image_url} 
                    alt={hotel.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <BuildingStorefrontIcon className="w-12 h-12 text-white/50" />
                )}
              </div>
              
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{hotel.name}</h3>
                    {renderStars(hotel.star_rating)}
                  </div>
                  {hotel.is_partner && (
                    <span className="badge-info">Partner</span>
                  )}
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  {hotel.destination && (
                    <div className="flex items-center gap-2">
                      <MapPinIcon className="w-4 h-4 text-gray-400" />
                      <span>{hotel.destination.name}</span>
                    </div>
                  )}
                  {hotel.hotel_type && (
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">{hotel.hotel_type}</span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-4 py-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">Standard</p>
                    <p className="font-medium text-sm">{formatCurrency(hotel.standard_rate_usd)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Deluxe</p>
                    <p className="font-medium text-sm">{formatCurrency(hotel.deluxe_rate_usd)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Suite</p>
                    <p className="font-medium text-sm">{formatCurrency(hotel.suite_rate_usd)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <span>Commission: <strong>{hotel.commission_rate}%</strong></span>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <Link
                    href={`/dashboard/hotels/${hotel.id}`}
                    className="btn-secondary btn-sm flex-1 flex items-center justify-center gap-1"
                  >
                    <EyeIcon className="w-4 h-4" />
                    View
                  </Link>
                  <button
                    onClick={() => toggleActive(hotel)}
                    className={`btn-sm ${hotel.is_active ? 'btn-secondary' : 'btn-primary'}`}
                  >
                    {hotel.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => deleteHotel(hotel.id)}
                    className="btn-sm btn-danger"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


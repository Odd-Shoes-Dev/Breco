'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
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

interface HotelWithDestination extends Hotel {
  destination?: Destination;
}

export default function HotelsPage() {
  const [hotels, setHotels] = useState<HotelWithDestination[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [destinationFilter, setDestinationFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state for new hotel
  const [formData, setFormData] = useState({
    name: '',
    destination_id: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    star_rating: 3,
    hotel_type: 'Lodge',
    standard_rate_usd: 0,
    deluxe_rate_usd: 0,
    suite_rate_usd: 0,
    contact_person: '',
    contact_phone: '',
    commission_rate: 10,
    notes: '',
    is_partner: true,
  });

  useEffect(() => {
    fetchHotels();
    fetchDestinations();
  }, []);

  const fetchHotels = async () => {
    try {
      const { data, error } = await supabase
        .from('hotels')
        .select(`
          *,
          destination:destinations(*)
        `)
        .order('name');

      if (error) throw error;
      setHotels(data || []);
    } catch (error) {
      console.error('Error fetching hotels:', error);
      toast.error('Failed to load hotels');
    } finally {
      setLoading(false);
    }
  };

  const fetchDestinations = async () => {
    try {
      const { data, error } = await supabase
        .from('destinations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setDestinations(data || []);
    } catch (error) {
      console.error('Error fetching destinations:', error);
    }
  };

  const handleCreateHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('hotels')
        .insert([{
          ...formData,
          destination_id: formData.destination_id || null,
        }]);

      if (error) throw error;
      
      toast.success('Hotel added successfully');
      setShowCreateModal(false);
      setFormData({
        name: '',
        destination_id: '',
        address: '',
        phone: '',
        email: '',
        website: '',
        star_rating: 3,
        hotel_type: 'Lodge',
        standard_rate_usd: 0,
        deluxe_rate_usd: 0,
        suite_rate_usd: 0,
        contact_person: '',
        contact_phone: '',
        commission_rate: 10,
        notes: '',
        is_partner: true,
      });
      fetchHotels();
    } catch (error) {
      console.error('Error creating hotel:', error);
      toast.error('Failed to create hotel');
    }
  };

  const deleteHotel = async (id: string) => {
    if (!confirm('Are you sure you want to delete this hotel?')) return;

    try {
      const { error } = await supabase
        .from('hotels')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setHotels(prev => prev.filter(h => h.id !== id));
      toast.success('Hotel deleted');
    } catch (error) {
      toast.error('Failed to delete hotel');
    }
  };

  const toggleActive = async (hotel: Hotel) => {
    try {
      const { error } = await supabase
        .from('hotels')
        .update({ is_active: !hotel.is_active })
        .eq('id', hotel.id);

      if (error) throw error;
      
      setHotels(prev => 
        prev.map(h => h.id === hotel.id ? { ...h, is_active: !h.is_active } : h)
      );
      
      toast.success(hotel.is_active ? 'Hotel deactivated' : 'Hotel activated');
    } catch (error) {
      toast.error('Failed to update hotel');
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

  const hotelTypes = ['Lodge', 'Hotel', 'Camp', 'Guesthouse', 'Resort', 'Boutique Hotel', 'Eco-Lodge'];

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
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Add Hotel
        </button>
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
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Add Hotel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHotels.map((hotel) => (
            <div key={hotel.id} className={`card overflow-hidden ${!hotel.is_active ? 'opacity-60' : ''}`}>
              <div className="h-32 bg-gradient-to-br from-breco-navy to-breco-navy-light flex items-center justify-center">
                <BuildingStorefrontIcon className="w-12 h-12 text-white/50" />
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h2 className="text-lg font-semibold">Add Partner Hotel</h2>
            </div>
            <form onSubmit={handleCreateHotel} className="card-body space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group md:col-span-2">
                  <label className="label">Hotel Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Destination</label>
                  <select
                    value={formData.destination_id}
                    onChange={(e) => setFormData({ ...formData, destination_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Select destination</option>
                    {destinations.map(dest => (
                      <option key={dest.id} value={dest.id}>{dest.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Hotel Type</label>
                  <select
                    value={formData.hotel_type}
                    onChange={(e) => setFormData({ ...formData, hotel_type: e.target.value })}
                    className="input"
                  >
                    {hotelTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Star Rating</label>
                  <select
                    value={formData.star_rating}
                    onChange={(e) => setFormData({ ...formData, star_rating: parseInt(e.target.value) })}
                    className="input"
                  >
                    {[1, 2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>{n} Star{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Commission Rate (%)</label>
                  <input
                    type="number"
                    value={formData.commission_rate}
                    onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) })}
                    className="input"
                    min="0"
                    max="100"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Standard Rate (USD)</label>
                  <input
                    type="number"
                    value={formData.standard_rate_usd}
                    onChange={(e) => setFormData({ ...formData, standard_rate_usd: parseFloat(e.target.value) })}
                    className="input"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Deluxe Rate (USD)</label>
                  <input
                    type="number"
                    value={formData.deluxe_rate_usd}
                    onChange={(e) => setFormData({ ...formData, deluxe_rate_usd: parseFloat(e.target.value) })}
                    className="input"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Suite Rate (USD)</label>
                  <input
                    type="number"
                    value={formData.suite_rate_usd}
                    onChange={(e) => setFormData({ ...formData, suite_rate_usd: parseFloat(e.target.value) })}
                    className="input"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="form-group md:col-span-2">
                  <label className="label">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="input"
                    rows={2}
                  />
                </div>

                <div className="form-group">
                  <label className="label">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Contact Phone</label>
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                <button type="submit" className="btn-primary">
                  Add Hotel
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


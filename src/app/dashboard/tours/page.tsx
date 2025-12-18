'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { TourPackage, Destination } from '@/types/breco';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  GlobeAltIcon,
  ClockIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  StarIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

interface TourPackageImage {
  id: string;
  tour_package_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  caption?: string;
}

interface TourPackageWithImages extends TourPackage {
  primary_destination?: Destination;
  images?: TourPackageImage[];
  primary_image?: TourPackageImage;
}

export default function TourPackagesPage() {
  const [packages, setPackages] = useState<TourPackageWithImages[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchPackages();
    fetchDestinations();
  }, []);

  const fetchPackages = async () => {
    try {
      // Fetch tour packages with destinations
      const { data: packagesData, error: packagesError } = await supabase
        .from('tour_packages')
        .select(`
          *,
          primary_destination:destinations(*)
        `)
        .order('created_at', { ascending: false });

      if (packagesError) throw packagesError;

      // Fetch images for all tour packages
      const { data: imagesData, error: imagesError } = await supabase
        .from('tour_package_images')
        .select('*')
        .order('display_order');

      if (imagesError) {
        console.error('Error fetching images:', imagesError);
      }

      // Attach images to tour packages
      const packagesWithImages = (packagesData || []).map(pkg => ({
        ...pkg,
        images: (imagesData || []).filter(img => img.tour_package_id === pkg.id),
        primary_image: (imagesData || []).find(img => img.tour_package_id === pkg.id && img.is_primary),
      }));

      setPackages(packagesWithImages);
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error('Failed to load tour packages');
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

  const toggleFeatured = async (pkg: TourPackage) => {
    try {
      const { error } = await supabase
        .from('tour_packages')
        .update({ is_featured: !pkg.is_featured })
        .eq('id', pkg.id);

      if (error) throw error;
      
      setPackages(prev => 
        prev.map(p => p.id === pkg.id ? { ...p, is_featured: !p.is_featured } : p)
      );
      
      toast.success(pkg.is_featured ? 'Removed from featured' : 'Marked as featured');
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const deletePackage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tour package?')) return;

    try {
      const { error } = await supabase
        .from('tour_packages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setPackages(prev => prev.filter(p => p.id !== id));
      toast.success('Tour package deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = 
      pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.package_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'all' || pkg.tour_type === filterType;
    
    return matchesSearch && matchesType;
  });

  const tourTypes = [...new Set(packages.map(p => p.tour_type).filter(Boolean))];

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(price);
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
          <h1 className="text-2xl font-bold text-gray-900">Tour Packages</h1>
          <p className="text-gray-500 mt-1">Manage your safari tours and itineraries</p>
        </div>
        <Link
          href="/dashboard/tours/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          New Package
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-breco-navy/10 rounded-lg">
              <GlobeAltIcon className="w-6 h-6 text-breco-navy" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{packages.length}</p>
              <p className="text-sm text-gray-500">Total Packages</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-breco-gold/20 rounded-lg">
              <StarSolidIcon className="w-6 h-6 text-breco-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {packages.filter(p => p.is_featured).length}
              </p>
              <p className="text-sm text-gray-500">Featured</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <ClockIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {packages.filter(p => p.is_active).length}
              </p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatPrice(Math.round(packages.reduce((sum, p) => sum + p.base_price_usd, 0) / packages.length || 0))}
              </p>
              <p className="text-sm text-gray-500">Avg. Price</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search packages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input w-full sm:w-48"
          >
            <option value="all">All Types</option>
            {tourTypes.map(type => (
              <option key={type} value={type || ''}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Packages Grid */}
      {filteredPackages.length === 0 ? (
        <div className="card p-12 text-center">
          <GlobeAltIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tour packages found</h3>
          <p className="text-gray-500 mb-4">Get started by creating your first tour package</p>
          <Link href="/dashboard/tours/new" className="btn-primary inline-flex items-center gap-2">
            <PlusIcon className="w-5 h-5" />
            Create Package
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPackages.map((pkg) => (
            <div key={pkg.id} className="card overflow-hidden hover:shadow-lg transition-shadow">
              {/* Image placeholder */}
              <div className="h-48 bg-gradient-to-br from-breco-navy to-breco-navy-light flex items-center justify-center relative overflow-hidden">
                {pkg.image_url || pkg.primary_image?.image_url || pkg.images?.[0]?.image_url ? (
                  <img
                    src={pkg.image_url || pkg.primary_image?.image_url || pkg.images?.[0]?.image_url}
                    alt={pkg.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <GlobeAltIcon className="w-16 h-16 text-white/50" />
                )}
                
                {/* Featured badge */}
                {pkg.is_featured && (
                  <div className="absolute top-3 left-3 bg-breco-gold text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                    <StarSolidIcon className="w-3 h-3" />
                    Featured
                  </div>
                )}
                
                {/* Duration badge */}
                <div className="absolute bottom-3 right-3 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                  {pkg.duration_days}D / {pkg.duration_nights}N
                </div>
              </div>

              <div className="p-4">
                {/* Package code and type */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-gray-500">{pkg.package_code}</span>
                  {pkg.tour_type && (
                    <span className="badge-info">{pkg.tour_type}</span>
                  )}
                </div>

                {/* Name */}
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{pkg.name}</h3>

                {/* Destination */}
                {pkg.primary_destination && (
                  <p className="text-sm text-gray-500 mb-3 flex items-center gap-1">
                    <GlobeAltIcon className="w-4 h-4" />
                    {pkg.primary_destination.name}
                  </p>
                )}

                {/* Price and group size */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xl font-bold text-breco-navy">
                      {formatPrice(pkg.base_price_usd)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {pkg.price_per_person ? 'per person' : 'per group'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-gray-600">
                      <UserGroupIcon className="w-4 h-4" />
                      <span className="text-sm">{pkg.min_group_size}-{pkg.max_group_size}</span>
                    </div>
                    <p className="text-xs text-gray-500">guests</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <Link
                    href={`/dashboard/tours/${pkg.id}`}
                    className="btn-secondary btn-sm flex-1 flex items-center justify-center gap-1"
                  >
                    <EyeIcon className="w-4 h-4" />
                    View
                  </Link>
                  <Link
                    href={`/dashboard/tours/${pkg.id}/edit`}
                    className="btn-secondary btn-sm flex items-center justify-center"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => toggleFeatured(pkg)}
                    className={`btn-sm flex items-center justify-center ${
                      pkg.is_featured ? 'bg-breco-gold text-white' : 'btn-secondary'
                    }`}
                  >
                    <StarIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deletePackage(pkg.id)}
                    className="btn-sm btn-danger flex items-center justify-center"
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


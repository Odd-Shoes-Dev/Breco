'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MapPinIcon,
  BuildingStorefrontIcon,
  TruckIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

interface Location {
  id: string;
  name: string;
  code: string;
  type: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Failed to load locations:', error);
      toast.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('locations')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Location ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadLocations();
    } catch (error: any) {
      console.error('Error updating location:', error);
      toast.error(error.message || 'Failed to update location');
    }
  };

  const typeIcons: Record<string, any> = {
    warehouse: BuildingStorefrontIcon,
    store: BuildingOfficeIcon,
    office: BuildingOfficeIcon,
    vehicle: TruckIcon,
  };

  const typeColors: Record<string, string> = {
    warehouse: 'bg-blue-100 text-blue-800',
    store: 'bg-green-100 text-green-800',
    office: 'bg-purple-100 text-purple-800',
    vehicle: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="text-gray-500 mt-1">Manage inventory locations</p>
        </div>
        <Link href="/dashboard/inventory/locations/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          New Location
        </Link>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Total Locations</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {locations.length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Active</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {locations.filter(l => l.is_active).length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Warehouses</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {locations.filter(l => l.type === 'warehouse').length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Stores</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {locations.filter(l => l.type === 'store').length}
            </div>
          </div>
        </div>
      </div>

      {/* Locations Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : locations.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <MapPinIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No locations</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new location.</p>
            <div className="mt-6">
              <Link href="/dashboard/inventory/locations/new" className="btn-primary">
                <PlusIcon className="w-5 h-5 mr-2" />
                New Location
              </Link>
            </div>
          </div>
        ) : (
          locations.map((location) => {
            const Icon = typeIcons[location.type] || MapPinIcon;
            return (
              <div key={location.id} className="card hover:shadow-md transition-shadow">
                <div className="card-body">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${typeColors[location.type] || 'bg-gray-100 text-gray-800'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{location.name}</h3>
                        <p className="text-sm text-gray-500">{location.code}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        location.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {location.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {location.address && (
                    <p className="mt-3 text-sm text-gray-600 line-clamp-2">{location.address}</p>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/dashboard/inventory/locations/${location.id}`}
                      className="btn-secondary text-sm flex-1"
                    >
                      View Details
                    </Link>
                    <button
                      onClick={() => toggleActive(location.id, location.is_active)}
                      className="btn-secondary text-sm"
                    >
                      {location.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

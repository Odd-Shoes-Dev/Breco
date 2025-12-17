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
  TruckIcon,
  WrenchScrewdriverIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

interface Vehicle {
  id: string;
  vehicle_number: string;
  registration_number: string | null;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  vehicle_type: string;
  fuel_type: string | null;
  transmission: string | null;
  seating_capacity: number | null;
  luggage_capacity: string | null;
  features: string[] | null;
  status: 'available' | 'in_use' | 'maintenance' | 'retired';
  daily_rate_usd: number | null;
  daily_rate_ugx: number | null;
  weekly_rate_usd: number | null;
  mileage_rate: number | null;
  current_mileage: number | null;
  last_service_date: string | null;
  next_service_mileage: number | null;
  purchase_date: string | null;
  purchase_price: number | null;
  current_value: number | null;
  insurance_expiry: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface VehicleImage {
  id: string;
  vehicle_id: string;
  image_url: string;
  caption: string | null;
  display_order: number;
  created_at: string;
}

export default function VehicleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [images, setImages] = useState<VehicleImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  useEffect(() => {
    fetchVehicle();
  }, [params.id]);

  const fetchVehicle = async () => {
    try {
      const [vehicleRes, imagesRes] = await Promise.all([
        supabase
          .from('vehicles')
          .select('*')
          .eq('id', params.id)
          .single(),
        supabase
          .from('vehicle_images')
          .select('*')
          .eq('vehicle_id', params.id)
          .order('display_order')
      ]);

      if (vehicleRes.error) throw vehicleRes.error;
      setVehicle(vehicleRes.data);
      setImages(imagesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch vehicle:', error);
      toast.error('Failed to load vehicle');
      router.push('/dashboard/fleet');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!vehicle) return;
    
    if (!confirm('Are you sure you want to delete this vehicle? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicle.id);

      if (error) throw error;

      toast.success('Vehicle deleted');
      router.push('/dashboard/fleet');
    } catch (error) {
      toast.error('Failed to delete vehicle');
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      available: { label: 'Available', color: 'bg-green-100 text-green-800' },
      in_use: { label: 'In Use', color: 'bg-blue-100 text-blue-800' },
      maintenance: { label: 'Maintenance', color: 'bg-yellow-100 text-yellow-800' },
      retired: { label: 'Retired', color: 'bg-gray-100 text-gray-800' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.available;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 ${config.color} text-xs font-semibold rounded-full`}>
        {config.label}
      </span>
    );
  };

  const checkMaintenanceAlerts = () => {
    if (!vehicle) return [];
    
    const alerts: { type: string; message: string; severity: 'warning' | 'error' }[] = [];
    const today = new Date();
    const warningDays = 30; // Days before expiry to show warning
    
    // Insurance expiry check
    if (vehicle.insurance_expiry) {
      const insuranceDate = new Date(vehicle.insurance_expiry);
      const daysUntilExpiry = Math.ceil((insuranceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < 0) {
        alerts.push({
          type: 'Insurance',
          message: `Insurance expired ${Math.abs(daysUntilExpiry)} days ago`,
          severity: 'error',
        });
      } else if (daysUntilExpiry <= warningDays) {
        alerts.push({
          type: 'Insurance',
          message: `Insurance expires in ${daysUntilExpiry} days`,
          severity: 'warning',
        });
      }
    }
    
    // Service check
    if (vehicle.next_service_mileage && vehicle.current_mileage) {
      const mileageUntilService = vehicle.next_service_mileage - vehicle.current_mileage;
      
      if (mileageUntilService < 0) {
        alerts.push({
          type: 'Service',
          message: `Service overdue by ${Math.abs(mileageUntilService).toLocaleString()} km`,
          severity: 'error',
        });
      } else if (mileageUntilService <= 1000) {
        alerts.push({
          type: 'Service',
          message: `Service due in ${mileageUntilService.toLocaleString()} km`,
          severity: 'warning',
        });
      }
    }
    
    return alerts;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-breco-navy border-t-transparent" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Vehicle not found</h2>
        <Link href="/dashboard/fleet" className="btn-primary mt-4 inline-flex items-center gap-2">
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Fleet
        </Link>
      </div>
    );
  }

  const maintenanceAlerts = checkMaintenanceAlerts();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/dashboard/fleet"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors mt-1"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <TruckIcon className="w-6 h-6 text-breco-navy" />
              <h1 className="text-2xl font-bold text-gray-900">
                {vehicle.make} {vehicle.model}
              </h1>
              {getStatusBadge(vehicle.status)}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="font-medium">{vehicle.vehicle_number}</span>
              {vehicle.registration_number && (
                <>
                  <span>•</span>
                  <span>{vehicle.registration_number}</span>
                </>
              )}
              {vehicle.year && (
                <>
                  <span>•</span>
                  <span>{vehicle.year}</span>
                </>
              )}
              {vehicle.color && (
                <>
                  <span>•</span>
                  <span className="capitalize">{vehicle.color}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/dashboard/fleet/${vehicle.id}/edit`} className="btn-secondary btn-sm">
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

      {/* Maintenance Alerts */}
      {maintenanceAlerts.length > 0 && (
        <div className="space-y-2">
          {maintenanceAlerts.map((alert, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-4 rounded-lg ${
                alert.severity === 'error' 
                  ? 'bg-red-50 border border-red-200' 
                  : 'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <ExclamationTriangleIcon 
                className={`w-5 h-5 ${
                  alert.severity === 'error' ? 'text-red-600' : 'text-yellow-600'
                }`}
              />
              <div>
                <div className="font-semibold text-gray-900">{alert.type} Alert</div>
                <div className="text-sm text-gray-700">{alert.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

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
                  alt={`${vehicle.make} ${vehicle.model}`}
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
                {images[selectedImageIndex]?.caption && (
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white text-sm px-3 py-2 rounded-lg max-w-md">
                    {images[selectedImageIndex].caption}
                  </div>
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Vehicle Specifications */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Vehicle Specifications</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Vehicle Type</div>
                <div className="font-medium text-gray-900 capitalize">{vehicle.vehicle_type}</div>
              </div>
              {vehicle.fuel_type && (
                <div>
                  <div className="text-sm text-gray-600">Fuel Type</div>
                  <div className="font-medium text-gray-900 capitalize">{vehicle.fuel_type}</div>
                </div>
              )}
              {vehicle.transmission && (
                <div>
                  <div className="text-sm text-gray-600">Transmission</div>
                  <div className="font-medium text-gray-900 capitalize">{vehicle.transmission}</div>
                </div>
              )}
              {vehicle.seating_capacity && (
                <div>
                  <div className="text-sm text-gray-600">Seating Capacity</div>
                  <div className="font-medium text-gray-900">{vehicle.seating_capacity} passengers</div>
                </div>
              )}
              {vehicle.luggage_capacity && (
                <div>
                  <div className="text-sm text-gray-600">Luggage Capacity</div>
                  <div className="font-medium text-gray-900">{vehicle.luggage_capacity}</div>
                </div>
              )}
              {vehicle.current_mileage && (
                <div>
                  <div className="text-sm text-gray-600">Current Mileage</div>
                  <div className="font-medium text-gray-900">{vehicle.current_mileage.toLocaleString()} km</div>
                </div>
              )}
            </div>
          </div>

          {/* Features */}
          {vehicle.features && vehicle.features.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Features & Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {vehicle.features.map((feature, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-breco-navy bg-opacity-10 text-breco-navy text-sm font-medium rounded-full"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Maintenance History */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <WrenchScrewdriverIcon className="w-5 h-5 text-breco-navy" />
              <h2 className="font-semibold text-gray-900">Maintenance Information</h2>
            </div>
            <div className="space-y-3">
              {vehicle.last_service_date && (
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Last Service</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(vehicle.last_service_date)}</span>
                </div>
              )}
              {vehicle.next_service_mileage && (
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Next Service At</span>
                  <span className="text-sm font-medium text-gray-900">{vehicle.next_service_mileage.toLocaleString()} km</span>
                </div>
              )}
              {vehicle.insurance_expiry && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Insurance Expiry</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(vehicle.insurance_expiry)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes Section */}
          {vehicle.notes && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Notes</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{vehicle.notes}</p>
            </div>
          )}
        </div>

        {/* Right Column - Key Details */}
        <div className="space-y-6">
          {/* Rental Rates */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <CurrencyDollarIcon className="w-5 h-5 text-breco-navy" />
              <h3 className="font-semibold text-gray-900">Rental Rates</h3>
            </div>
            <div className="space-y-3">
              {vehicle.daily_rate_usd && vehicle.daily_rate_usd > 0 && (
                <div className="border-b border-gray-200 pb-2">
                  <div className="text-sm text-gray-600 mb-1">Daily Rate (USD)</div>
                  <div className="text-xl font-bold text-breco-navy">
                    {formatPrice(vehicle.daily_rate_usd, 'USD')}
                  </div>
                  <div className="text-xs text-gray-500">per day</div>
                </div>
              )}

              {vehicle.daily_rate_ugx && vehicle.daily_rate_ugx > 0 && (
                <div className="border-b border-gray-200 pb-2">
                  <div className="text-sm text-gray-600 mb-1">Daily Rate (UGX)</div>
                  <div className="text-xl font-bold text-breco-navy">
                    {formatPrice(vehicle.daily_rate_ugx, 'UGX')}
                  </div>
                  <div className="text-xs text-gray-500">per day</div>
                </div>
              )}

              {vehicle.weekly_rate_usd && vehicle.weekly_rate_usd > 0 && (
                <div className="border-b border-gray-200 pb-2">
                  <div className="text-sm text-gray-600 mb-1">Weekly Rate</div>
                  <div className="text-xl font-bold text-breco-navy">
                    {formatPrice(vehicle.weekly_rate_usd, 'USD')}
                  </div>
                  <div className="text-xs text-gray-500">per week</div>
                </div>
              )}

              {vehicle.mileage_rate && vehicle.mileage_rate > 0 && (
                <div className="pb-2">
                  <div className="text-sm text-gray-600 mb-1">Mileage Rate</div>
                  <div className="text-xl font-bold text-breco-navy">
                    {formatPrice(vehicle.mileage_rate, 'USD')}
                  </div>
                  <div className="text-xs text-gray-500">per km</div>
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          {vehicle.location && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPinIcon className="w-5 h-5 text-breco-navy" />
                <h3 className="font-semibold text-gray-900">Current Location</h3>
              </div>
              <div className="font-medium text-gray-900">{vehicle.location}</div>
            </div>
          )}

          {/* Purchase & Value */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <CalendarIcon className="w-5 h-5 text-breco-navy" />
              <h3 className="font-semibold text-gray-900">Purchase & Value</h3>
            </div>
            <div className="space-y-3">
              {vehicle.purchase_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Purchase Date:</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(vehicle.purchase_date)}</span>
                </div>
              )}
              {vehicle.purchase_price && vehicle.purchase_price > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Purchase Price:</span>
                  <span className="text-sm font-medium text-gray-900">{formatPrice(vehicle.purchase_price, 'USD')}</span>
                </div>
              )}
              {vehicle.current_value && vehicle.current_value > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Current Value:</span>
                  <span className="text-sm font-bold text-breco-navy">{formatPrice(vehicle.current_value, 'USD')}</span>
                </div>
              )}
            </div>
          </div>

          {/* System Information */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">System Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="text-gray-900">
                  {new Date(vehicle.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Last Updated:</span>
                <span className="text-gray-900">
                  {new Date(vehicle.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href={`/dashboard/bookings/new?vehicle=${vehicle.id}`}
                className="btn-primary w-full justify-center"
              >
                Create Booking
              </Link>
              <Link
                href={`/dashboard/invoices/new?vehicle=${vehicle.id}`}
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

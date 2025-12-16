'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { Vehicle } from '@/types/breco';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
  CalendarDaysIcon,
  MapPinIcon,
  UserIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

type VehicleStatus = 'available' | 'in_use' | 'maintenance' | 'out_of_service';

export default function FleetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    registration_number: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    vehicle_type: 'Safari Van',
    seating_capacity: 7,
    fuel_type: 'Diesel',
    current_mileage: 0,
    status: 'available' as VehicleStatus,
    insurance_expiry: '',
    inspection_expiry: '',
    daily_rate_usd: 0,
    notes: '',
  });

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('registration_number');

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('vehicles')
        .insert([{
          ...formData,
          insurance_expiry: formData.insurance_expiry || null,
          inspection_expiry: formData.inspection_expiry || null,
        }]);

      if (error) throw error;
      
      toast.success('Vehicle added successfully');
      setShowCreateModal(false);
      setFormData({
        registration_number: '',
        make: '',
        model: '',
        year: new Date().getFullYear(),
        vehicle_type: 'Safari Van',
        seating_capacity: 7,
        fuel_type: 'Diesel',
        current_mileage: 0,
        status: 'available',
        insurance_expiry: '',
        inspection_expiry: '',
        daily_rate_usd: 0,
        notes: '',
      });
      fetchVehicles();
    } catch (error) {
      console.error('Error creating vehicle:', error);
      toast.error('Failed to add vehicle');
    }
  };

  const updateStatus = async (vehicle: Vehicle, newStatus: VehicleStatus) => {
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ status: newStatus })
        .eq('id', vehicle.id);

      if (error) throw error;
      
      setVehicles(prev => 
        prev.map(v => v.id === vehicle.id ? { ...v, status: newStatus } : v)
      );
      
      toast.success('Status updated');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const deleteVehicle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;

    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setVehicles(prev => prev.filter(v => v.id !== id));
      toast.success('Vehicle deleted');
    } catch (error) {
      toast.error('Failed to delete vehicle');
    }
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = 
      vehicle.registration_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.make?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter;
    const matchesType = typeFilter === 'all' || vehicle.vehicle_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <span className="badge-success flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" /> Available</span>;
      case 'in_use':
        return <span className="badge-info flex items-center gap-1"><ClockIcon className="w-3 h-3" /> In Use</span>;
      case 'maintenance':
        return <span className="badge-warning flex items-center gap-1"><WrenchScrewdriverIcon className="w-3 h-3" /> Maintenance</span>;
      case 'out_of_service':
        return <span className="badge-danger flex items-center gap-1"><ExclamationTriangleIcon className="w-3 h-3" /> Out of Service</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const expiryDate = new Date(date);
    const today = new Date();
    const daysUntil = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 30 && daysUntil >= 0;
  };

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const vehicleTypes = ['Safari Van', 'Land Cruiser', 'Minibus', 'Sedan', 'SUV', 'Coaster Bus', 'Pickup Truck'];
  const fuelTypes = ['Diesel', 'Petrol', 'Hybrid', 'Electric'];
  const statuses: VehicleStatus[] = ['available', 'in_use', 'maintenance', 'out_of_service'];

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
          <h1 className="text-2xl font-bold text-gray-900">Fleet Management</h1>
          <p className="text-gray-500 mt-1">Manage safari vehicles and car hire fleet</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Add Vehicle
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-4">
          <p className="text-2xl font-bold text-gray-900">{vehicles.length}</p>
          <p className="text-sm text-gray-500">Total Vehicles</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-green-600">
            {vehicles.filter(v => v.status === 'available').length}
          </p>
          <p className="text-sm text-gray-500">Available</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-blue-600">
            {vehicles.filter(v => v.status === 'in_use').length}
          </p>
          <p className="text-sm text-gray-500">In Use</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-yellow-600">
            {vehicles.filter(v => v.status === 'maintenance').length}
          </p>
          <p className="text-sm text-gray-500">Maintenance</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-red-600">
            {vehicles.filter(v => isExpiringSoon(v.insurance_expiry) || isExpiringSoon(v.inspection_expiry)).length}
          </p>
          <p className="text-sm text-gray-500">Expiring Soon</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search vehicles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-full sm:w-44"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="in_use">In Use</option>
            <option value="maintenance">Maintenance</option>
            <option value="out_of_service">Out of Service</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input w-full sm:w-44"
          >
            <option value="all">All Types</option>
            {vehicleTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Vehicles Grid */}
      {filteredVehicles.length === 0 ? (
        <div className="card p-12 text-center">
          <TruckIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No vehicles found</h3>
          <p className="text-gray-500 mb-4">Add your first vehicle to the fleet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Add Vehicle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.map((vehicle) => (
            <div key={vehicle.id} className={`card overflow-hidden ${vehicle.status === 'out_of_service' ? 'opacity-60' : ''}`}>
              <div className="h-24 bg-gradient-to-br from-breco-navy to-breco-navy-light flex items-center justify-center">
                <TruckIcon className="w-12 h-12 text-white/50" />
              </div>
              
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{vehicle.registration_number}</h3>
                    <p className="text-gray-600">{vehicle.make} {vehicle.model}</p>
                  </div>
                  {getStatusBadge(vehicle.status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 my-4">
                  <div>
                    <span className="text-gray-400">Type:</span> {vehicle.vehicle_type}
                  </div>
                  <div>
                    <span className="text-gray-400">Year:</span> {vehicle.year}
                  </div>
                  <div>
                    <span className="text-gray-400">Seats:</span> {vehicle.seating_capacity}
                  </div>
                  <div>
                    <span className="text-gray-400">Fuel:</span> {vehicle.fuel_type}
                  </div>
                </div>

                <div className="text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mileage:</span>
                    <span className="font-medium">{vehicle.current_mileage?.toLocaleString()} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Daily Rate:</span>
                    <span className="font-medium">{formatCurrency(vehicle.daily_rate_usd)}</span>
                  </div>
                </div>

                {/* Expiry Warnings */}
                <div className="space-y-1 mb-4">
                  <div className={`flex items-center justify-between text-sm ${isExpired(vehicle.insurance_expiry) ? 'text-red-600' : isExpiringSoon(vehicle.insurance_expiry) ? 'text-yellow-600' : 'text-gray-500'}`}>
                    <span>Insurance:</span>
                    <span className="flex items-center gap-1">
                      {(isExpired(vehicle.insurance_expiry) || isExpiringSoon(vehicle.insurance_expiry)) && (
                        <ExclamationTriangleIcon className="w-4 h-4" />
                      )}
                      {formatDate(vehicle.insurance_expiry)}
                    </span>
                  </div>
                  <div className={`flex items-center justify-between text-sm ${isExpired(vehicle.inspection_expiry) ? 'text-red-600' : isExpiringSoon(vehicle.inspection_expiry) ? 'text-yellow-600' : 'text-gray-500'}`}>
                    <span>Inspection:</span>
                    <span className="flex items-center gap-1">
                      {(isExpired(vehicle.inspection_expiry) || isExpiringSoon(vehicle.inspection_expiry)) && (
                        <ExclamationTriangleIcon className="w-4 h-4" />
                      )}
                      {formatDate(vehicle.inspection_expiry)}
                    </span>
                  </div>
                </div>

                {/* Status Dropdown */}
                <div className="mb-4">
                  <select
                    value={vehicle.status}
                    onChange={(e) => updateStatus(vehicle, e.target.value as VehicleStatus)}
                    className="input text-sm w-full"
                  >
                    {statuses.map(status => (
                      <option key={status} value={status}>
                        {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <Link
                    href={`/dashboard/fleet/${vehicle.id}`}
                    className="btn-secondary btn-sm flex-1 flex items-center justify-center gap-1"
                  >
                    <EyeIcon className="w-4 h-4" />
                    Details
                  </Link>
                  <Link
                    href={`/dashboard/fleet/${vehicle.id}/maintenance`}
                    className="btn-secondary btn-sm flex items-center gap-1"
                  >
                    <WrenchScrewdriverIcon className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => deleteVehicle(vehicle.id)}
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
              <h2 className="text-lg font-semibold">Add Vehicle</h2>
            </div>
            <form onSubmit={handleCreateVehicle} className="card-body space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Registration Number *</label>
                  <input
                    type="text"
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    className="input"
                    placeholder="UAX 123A"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Vehicle Type</label>
                  <select
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                    className="input"
                  >
                    {vehicleTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Make</label>
                  <input
                    type="text"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    className="input"
                    placeholder="Toyota"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Model</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="input"
                    placeholder="Land Cruiser"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Year</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    className="input"
                    min="1990"
                    max={new Date().getFullYear() + 1}
                  />
                </div>

                <div className="form-group">
                  <label className="label">Seating Capacity</label>
                  <input
                    type="number"
                    value={formData.seating_capacity}
                    onChange={(e) => setFormData({ ...formData, seating_capacity: parseInt(e.target.value) })}
                    className="input"
                    min="1"
                    max="50"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Fuel Type</label>
                  <select
                    value={formData.fuel_type}
                    onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                    className="input"
                  >
                    {fuelTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as VehicleStatus })}
                    className="input"
                  >
                    {statuses.map(status => (
                      <option key={status} value={status}>
                        {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Current Mileage (km)</label>
                  <input
                    type="number"
                    value={formData.current_mileage}
                    onChange={(e) => setFormData({ ...formData, current_mileage: parseInt(e.target.value) })}
                    className="input"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Daily Rate (USD)</label>
                  <input
                    type="number"
                    value={formData.daily_rate_usd}
                    onChange={(e) => setFormData({ ...formData, daily_rate_usd: parseFloat(e.target.value) })}
                    className="input"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Insurance Expiry</label>
                  <input
                    type="date"
                    value={formData.insurance_expiry}
                    onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Inspection Expiry</label>
                  <input
                    type="date"
                    value={formData.inspection_expiry}
                    onChange={(e) => setFormData({ ...formData, inspection_expiry: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="form-group md:col-span-2">
                  <label className="label">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                <button type="submit" className="btn-primary">
                  Add Vehicle
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


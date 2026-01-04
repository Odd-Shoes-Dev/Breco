'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  WrenchIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface Maintenance {
  id: string;
  maintenance_type: string;
  scheduled_date: string;
  completed_date: string | null;
  status: string;
  cost: number;
  next_maintenance_date: string | null;
  fixed_assets: {
    asset_name: string;
    asset_tag: string | null;
  } | null;
  vendors: {
    name: string;
    company_name: string | null;
  } | null;
}

export default function AssetMaintenancePage() {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('scheduled');

  useEffect(() => {
    loadMaintenances();
  }, [statusFilter]);

  const loadMaintenances = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('asset_maintenance')
        .select(`
          *,
          fixed_assets (asset_name, asset_tag),
          vendors (name, company_name)
        `)
        .order('scheduled_date', { ascending: true });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMaintenances(data || []);
    } catch (error) {
      console.error('Failed to load maintenances:', error);
      toast.error('Failed to load maintenances');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (maintenanceId: string) => {
    if (!confirm('Mark this maintenance as completed?')) return;

    try {
      const cost = prompt('Enter actual cost:');
      if (cost === null) return;

      const { error } = await supabase
        .from('asset_maintenance')
        .update({
          status: 'completed',
          completed_date: new Date().toISOString(),
          cost: parseFloat(cost) || 0,
        })
        .eq('id', maintenanceId);

      if (error) throw error;

      toast.success('Maintenance marked as completed');
      loadMaintenances();
    } catch (error: any) {
      console.error('Error completing maintenance:', error);
      toast.error(error.message || 'Failed to complete maintenance');
    }
  };

  const statusColors: Record<string, string> = {
    scheduled: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };

  const typeColors: Record<string, string> = {
    preventive: 'bg-blue-100 text-blue-800',
    corrective: 'bg-red-100 text-red-800',
    inspection: 'bg-purple-100 text-purple-800',
    calibration: 'bg-green-100 text-green-800',
  };

  // Check for overdue maintenances
  const overdueMaintenance = maintenances.filter(
    m => m.status === 'scheduled' && new Date(m.scheduled_date) < new Date()
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Maintenance</h1>
          <p className="text-gray-500 mt-1">Schedule and track asset maintenance</p>
        </div>
        <Link href="/dashboard/assets/maintenance/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          Schedule Maintenance
        </Link>
      </div>

      {/* Overdue Alert */}
      {overdueMaintenance.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <span className="font-medium">{overdueMaintenance.length} overdue maintenance(s)</span> require attention.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Total Scheduled</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {maintenances.filter(m => m.status === 'scheduled').length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Overdue</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {overdueMaintenance.length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">This Month</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {maintenances.filter(m => {
                const date = new Date(m.scheduled_date);
                const now = new Date();
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
              }).length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Total Cost (YTD)</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(
                maintenances
                  .filter(m => m.status === 'completed')
                  .reduce((sum, m) => sum + m.cost, 0)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="card">
        <div className="card-body">
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-4 py-2 rounded-lg text-sm ${
                statusFilter === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('scheduled')}
              className={`px-4 py-2 rounded-lg text-sm ${
                statusFilter === 'scheduled' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Scheduled
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`px-4 py-2 rounded-lg text-sm ${
                statusFilter === 'in_progress' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-4 py-2 rounded-lg text-sm ${
                statusFilter === 'completed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Completed
            </button>
          </div>
        </div>
      </div>

      {/* Maintenance List */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : maintenances.length === 0 ? (
            <div className="text-center py-12">
              <WrenchIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No maintenance scheduled</h3>
              <p className="mt-1 text-sm text-gray-500">Start by scheduling asset maintenance.</p>
              <div className="mt-6">
                <Link href="/dashboard/assets/maintenance/new" className="btn-primary">
                  <PlusIcon className="w-5 h-5 mr-2" />
                  Schedule Maintenance
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Scheduled Date</th>
                    <th>Completed Date</th>
                    <th>Service Provider</th>
                    <th>Cost</th>
                    <th>Next Maintenance</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {maintenances.map((maintenance) => {
                    const isOverdue = maintenance.status === 'scheduled' && 
                                    new Date(maintenance.scheduled_date) < new Date();

                    return (
                      <tr key={maintenance.id} className={isOverdue ? 'bg-red-50' : ''}>
                        <td>
                          <div>
                            <div className="font-medium">{maintenance.fixed_assets?.asset_name}</div>
                            {maintenance.fixed_assets?.asset_tag && (
                              <div className="text-sm text-gray-500">{maintenance.fixed_assets.asset_tag}</div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`px-2 py-1 rounded-full text-xs ${typeColors[maintenance.maintenance_type]}`}>
                            {maintenance.maintenance_type.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {new Date(maintenance.scheduled_date).toLocaleDateString()}
                            {isOverdue && <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />}
                          </div>
                        </td>
                        <td>
                          {maintenance.completed_date
                            ? new Date(maintenance.completed_date).toLocaleDateString()
                            : '-'}
                        </td>
                        <td>
                          {maintenance.vendors?.company_name || maintenance.vendors?.name || 'N/A'}
                        </td>
                        <td>
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          }).format(maintenance.cost)}
                        </td>
                        <td>
                          {maintenance.next_maintenance_date
                            ? new Date(maintenance.next_maintenance_date).toLocaleDateString()
                            : '-'}
                        </td>
                        <td>
                          <span className={`px-2 py-1 rounded-full text-xs ${statusColors[maintenance.status]}`}>
                            {maintenance.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {maintenance.status === 'scheduled' && (
                            <button
                              onClick={() => handleComplete(maintenance.id)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Complete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

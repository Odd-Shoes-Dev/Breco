'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PencilIcon,
  PrinterIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

interface AssetMaintenance {
  id: string;
  asset_id: string;
  maintenance_type: string;
  scheduled_date: string;
  performed_date: string | null;
  performed_by_employee_id: string | null;
  performed_by_vendor: string | null;
  description: string;
  cost: number | null;
  status: string;
  notes: string | null;
  next_maintenance_date: string | null;
  created_at: string;
  assets: {
    id: string;
    name: string;
    asset_tag: string;
  };
  employees?: {
    first_name: string;
    last_name: string;
    employee_number: string;
  };
}

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MaintenanceDetailPageClient maintenanceId={id} />;
}

function MaintenanceDetailPageClient({ maintenanceId }: { maintenanceId: string }) {
  const router = useRouter();
  const [maintenance, setMaintenance] = useState<AssetMaintenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadMaintenance();
  }, [maintenanceId]);

  const loadMaintenance = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('asset_maintenance')
        .select(
          `
          *,
          assets (id, name, asset_tag),
          employees:performed_by_employee_id (first_name, last_name, employee_number)
        `
        )
        .eq('id', maintenanceId)
        .single();

      if (error) throw error;
      setMaintenance(data);
    } catch (error) {
      console.error('Failed to load maintenance:', error);
      toast.error('Failed to load maintenance record');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!confirm('Mark this maintenance as completed?')) return;

    try {
      setUpdating(true);

      const { error } = await supabase
        .from('asset_maintenance')
        .update({
          status: 'completed',
          performed_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', maintenanceId);

      if (error) throw error;

      toast.success('Maintenance marked as completed');
      loadMaintenance();
    } catch (error: any) {
      console.error('Error updating maintenance:', error);
      toast.error(error.message || 'Failed to update maintenance');
    } finally {
      setUpdating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!maintenance) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Maintenance record not found</p>
      </div>
    );
  }

  const isOverdue =
    maintenance.status === 'scheduled' &&
    new Date(maintenance.scheduled_date) < new Date();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Maintenance Record</h1>
            <p className="text-gray-500 mt-1">{maintenance.assets.name}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <PrinterIcon className="w-5 h-5" />
            Print
          </button>
          {maintenance.status !== 'completed' && (
            <>
              <button
                onClick={() => router.push(`/dashboard/assets/maintenance/${maintenanceId}/edit`)}
                className="btn-secondary flex items-center gap-2"
              >
                <PencilIcon className="w-5 h-5" />
                Edit
              </button>
              <button
                onClick={handleMarkComplete}
                className="btn-primary flex items-center gap-2"
                disabled={updating}
              >
                <CheckIcon className="w-5 h-5" />
                {updating ? 'Updating...' : 'Mark Complete'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4 print:hidden">
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            maintenance.status === 'completed'
              ? 'bg-green-100 text-green-800'
              : maintenance.status === 'in_progress'
              ? 'bg-blue-100 text-blue-800'
              : maintenance.status === 'cancelled'
              ? 'bg-red-100 text-red-800'
              : isOverdue
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {maintenance.status === 'scheduled' && isOverdue
            ? 'OVERDUE'
            : maintenance.status.toUpperCase().replace('_', ' ')}
        </span>
      </div>

      {/* Asset Information */}
      <div className="card">
        <div className="card-body">
          <h2 className="text-lg font-semibold mb-4">Asset Information</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-gray-600">Asset Name</label>
              <p className="font-medium">{maintenance.assets.name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Asset Tag</label>
              <p className="font-medium">{maintenance.assets.asset_tag}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance Details */}
      <div className="card">
        <div className="card-body">
          <h2 className="text-lg font-semibold mb-4">Maintenance Details</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-gray-600">Maintenance Type</label>
              <p className="font-medium capitalize">{maintenance.maintenance_type}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Status</label>
              <p className="font-medium capitalize">{maintenance.status.replace('_', ' ')}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Scheduled Date</label>
              <p className="font-medium">
                {new Date(maintenance.scheduled_date).toLocaleDateString()}
              </p>
            </div>
            {maintenance.performed_date && (
              <div>
                <label className="text-sm text-gray-600">Performed Date</label>
                <p className="font-medium">
                  {new Date(maintenance.performed_date).toLocaleDateString()}
                </p>
              </div>
            )}
            {maintenance.next_maintenance_date && (
              <div>
                <label className="text-sm text-gray-600">Next Maintenance</label>
                <p className="font-medium">
                  {new Date(maintenance.next_maintenance_date).toLocaleDateString()}
                </p>
              </div>
            )}
            {maintenance.cost && (
              <div>
                <label className="text-sm text-gray-600">Cost</label>
                <p className="font-medium text-lg">
                  ${maintenance.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
            <div className="md:col-span-2">
              <label className="text-sm text-gray-600">Description</label>
              <p className="font-medium">{maintenance.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performed By */}
      <div className="card">
        <div className="card-body">
          <h2 className="text-lg font-semibold mb-4">Performed By</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {maintenance.performed_by_employee_id && maintenance.employees && (
              <div>
                <label className="text-sm text-gray-600">Employee</label>
                <p className="font-medium">
                  {maintenance.employees.first_name} {maintenance.employees.last_name}
                </p>
                <p className="text-sm text-gray-600">
                  {maintenance.employees.employee_number}
                </p>
              </div>
            )}
            {maintenance.performed_by_vendor && (
              <div>
                <label className="text-sm text-gray-600">Vendor</label>
                <p className="font-medium">{maintenance.performed_by_vendor}</p>
              </div>
            )}
            {!maintenance.performed_by_employee_id && !maintenance.performed_by_vendor && (
              <div className="md:col-span-2">
                <p className="text-gray-500 italic">Not yet assigned</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Additional Notes */}
      {maintenance.notes && (
        <div className="card">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-4">Notes</h2>
            <p className="whitespace-pre-wrap">{maintenance.notes}</p>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="card">
        <div className="card-body">
          <h2 className="text-lg font-semibold mb-4">Record Information</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-gray-600">Created Date</label>
              <p className="font-medium">
                {new Date(maintenance.created_at).toLocaleDateString()}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Record ID</label>
              <p className="font-mono text-sm text-gray-600">{maintenance.id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block,
          .print\\:block * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

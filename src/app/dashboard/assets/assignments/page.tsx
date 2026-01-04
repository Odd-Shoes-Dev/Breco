'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  UserIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface Assignment {
  id: string;
  assigned_date: string;
  return_date: string | null;
  status: string;
  condition_at_assignment: string | null;
  condition_at_return: string | null;
  fixed_assets: {
    asset_name: string;
    asset_tag: string | null;
  } | null;
  employees: {
    first_name: string;
    last_name: string;
  } | null;
}

export default function AssetAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('assigned');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadAssignments();
  }, [statusFilter]);

  const loadAssignments = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('asset_assignments')
        .select(`
          *,
          fixed_assets (asset_name, asset_tag),
          employees (first_name, last_name)
        `)
        .order('assigned_date', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Failed to load assignments:', error);
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (assignmentId: string) => {
    if (!confirm('Mark this asset as returned?')) return;

    try {
      const condition = prompt('Enter asset condition at return (good/fair/poor/damaged):');
      if (!condition) return;

      const { error } = await supabase
        .from('asset_assignments')
        .update({
          status: 'returned',
          return_date: new Date().toISOString(),
          condition_at_return: condition,
        })
        .eq('id', assignmentId);

      if (error) throw error;

      toast.success('Asset marked as returned');
      loadAssignments();
    } catch (error: any) {
      console.error('Error returning asset:', error);
      toast.error(error.message || 'Failed to return asset');
    }
  };

  const statusColors: Record<string, string> = {
    assigned: 'bg-blue-100 text-blue-800',
    returned: 'bg-green-100 text-green-800',
    lost: 'bg-red-100 text-red-800',
    damaged: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Assignments</h1>
          <p className="text-gray-500 mt-1">Track asset custody and assignments</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          New Assignment
        </button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Total Assignments</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {assignments.length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Currently Assigned</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {assignments.filter(a => a.status === 'assigned').length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Returned</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {assignments.filter(a => a.status === 'returned').length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-500">Lost/Damaged</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {assignments.filter(a => ['lost', 'damaged'].includes(a.status)).length}
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
              onClick={() => setStatusFilter('assigned')}
              className={`px-4 py-2 rounded-lg text-sm ${
                statusFilter === 'assigned' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Assigned
            </button>
            <button
              onClick={() => setStatusFilter('returned')}
              className={`px-4 py-2 rounded-lg text-sm ${
                statusFilter === 'returned' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Returned
            </button>
            <button
              onClick={() => setStatusFilter('lost')}
              className={`px-4 py-2 rounded-lg text-sm ${
                statusFilter === 'lost' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Lost
            </button>
            <button
              onClick={() => setStatusFilter('damaged')}
              className={`px-4 py-2 rounded-lg text-sm ${
                statusFilter === 'damaged' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Damaged
            </button>
          </div>
        </div>
      </div>

      {/* Assignments List */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12">
              <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No assignments</h3>
              <p className="mt-1 text-sm text-gray-500">Start by assigning an asset to an employee.</p>
              <div className="mt-6">
                <button onClick={() => setShowModal(true)} className="btn-primary">
                  <PlusIcon className="w-5 h-5 mr-2" />
                  New Assignment
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Assigned To</th>
                    <th>Assigned Date</th>
                    <th>Return Date</th>
                    <th>Condition</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>
                        <div>
                          <div className="font-medium">{assignment.fixed_assets?.asset_name}</div>
                          {assignment.fixed_assets?.asset_tag && (
                            <div className="text-sm text-gray-500">{assignment.fixed_assets.asset_tag}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        {assignment.employees
                          ? `${assignment.employees.first_name} ${assignment.employees.last_name}`
                          : 'N/A'}
                      </td>
                      <td>{new Date(assignment.assigned_date).toLocaleDateString()}</td>
                      <td>
                        {assignment.return_date
                          ? new Date(assignment.return_date).toLocaleDateString()
                          : '-'}
                      </td>
                      <td>
                        <div className="text-sm">
                          <div>At Assignment: {assignment.condition_at_assignment || 'N/A'}</div>
                          {assignment.condition_at_return && (
                            <div className="text-gray-500">At Return: {assignment.condition_at_return}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs ${statusColors[assignment.status]}`}>
                          {assignment.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {assignment.status === 'assigned' && (
                          <button
                            onClick={() => handleReturn(assignment.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                          >
                            <ArrowPathIcon className="w-4 h-4" />
                            Return
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

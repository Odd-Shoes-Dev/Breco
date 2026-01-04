'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface Category {
  id: string;
  name: string;
  description: string | null;
  depreciation_rate: number | null;
  useful_life_years: number | null;
  created_at: string;
}

export default function AssetCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    depreciation_rate: '',
    useful_life_years: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('asset_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const categoryData = {
        name: formData.name,
        description: formData.description || null,
        depreciation_rate: formData.depreciation_rate ? parseFloat(formData.depreciation_rate) : null,
        useful_life_years: formData.useful_life_years ? parseInt(formData.useful_life_years) : null,
      };

      if (editingCategory) {
        const { error } = await supabase
          .from('asset_categories')
          .update(categoryData)
          .eq('id', editingCategory.id);

        if (error) throw error;
        toast.success('Category updated successfully');
      } else {
        const { error } = await supabase
          .from('asset_categories')
          .insert(categoryData);

        if (error) throw error;
        toast.success('Category created successfully');
      }

      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '', depreciation_rate: '', useful_life_years: '' });
      loadCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      toast.error(error.message || 'Failed to save category');
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      depreciation_rate: category.depreciation_rate?.toString() || '',
      useful_life_years: category.useful_life_years?.toString() || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? Assets using it will have no category.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('asset_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Category deleted successfully');
      loadCategories();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast.error(error.message || 'Failed to delete category');
    }
  };

  const openNewModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '', depreciation_rate: '', useful_life_years: '' });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Categories</h1>
          <p className="text-gray-500 mt-1">Manage fixed asset categories and default depreciation settings</p>
        </div>
        <button onClick={openNewModal} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          New Category
        </button>
      </div>

      {/* Categories List */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No categories found</p>
              <button onClick={openNewModal} className="btn-primary mt-4">
                Create Your First Category
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Depreciation Rate</th>
                    <th>Useful Life</th>
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td className="font-medium">{category.name}</td>
                      <td className="text-gray-600">{category.description || '-'}</td>
                      <td>{category.depreciation_rate ? `${category.depreciation_rate}%` : '-'}</td>
                      <td>{category.useful_life_years ? `${category.useful_life_years} years` : '-'}</td>
                      <td>{new Date(category.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(category)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(category.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCategory ? 'Edit Category' : 'New Category'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                  placeholder="Office Equipment"
                />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={2}
                  placeholder="Optional description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Depreciation Rate (%)</label>
                  <input
                    type="number"
                    value={formData.depreciation_rate}
                    onChange={(e) => setFormData({ ...formData, depreciation_rate: e.target.value })}
                    className="input"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="20"
                  />
                </div>

                <div>
                  <label className="label">Useful Life (years)</label>
                  <input
                    type="number"
                    value={formData.useful_life_years}
                    onChange={(e) => setFormData({ ...formData, useful_life_years: e.target.value })}
                    className="input"
                    min="1"
                    placeholder="5"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                These default values will be applied to new assets in this category
              </p>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingCategory ? 'Update' : 'Create'} Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

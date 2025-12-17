'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  GlobeAltIcon,
  ClockIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import type { Destination } from '@/types/breco';

interface TourPackageFormData {
  package_code: string;
  name: string;
  description: string;
  duration_days: number;
  duration_nights: number;
  base_price_usd: number;
  base_price_eur: number;
  base_price_ugx: number;
  price_per_person: boolean;
  min_group_size: number;
  max_group_size: number;
  tour_type: string;
  difficulty_level: string;
  inclusions: string;
  exclusions: string;
  primary_destination_id: string;
  image_url: string;
  is_featured: boolean;
  is_active: boolean;
}

export default function EditTourPackagePage() {
  const router = useRouter();
  const params = useParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<Array<{ id: string; image_url: string; is_primary: boolean; display_order: number }>>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);

  const [formData, setFormData] = useState<TourPackageFormData>({
    package_code: '',
    name: '',
    description: '',
    duration_days: 1,
    duration_nights: 0,
    base_price_usd: 0,
    base_price_eur: 0,
    base_price_ugx: 0,
    price_per_person: true,
    min_group_size: 1,
    max_group_size: 20,
    tour_type: 'Safari',
    difficulty_level: 'moderate',
    inclusions: '',
    exclusions: '',
    primary_destination_id: '',
    image_url: '',
    is_featured: false,
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    try {
      // Load destinations
      const { data: destData, error: destError } = await supabase
        .from('destinations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (destError) throw destError;
      setDestinations(destData || []);

      // Load tour package and images
      const [pkgRes, imagesRes] = await Promise.all([
        supabase
          .from('tour_packages')
          .select('*')
          .eq('id', params.id)
          .single(),
        supabase
          .from('tour_package_images')
          .select('*')
          .eq('tour_package_id', params.id)
          .order('display_order')
      ]);

      if (pkgRes.error) throw pkgRes.error;
      const pkgData = pkgRes.data;

      setFormData({
        package_code: pkgData.package_code || '',
        name: pkgData.name || '',
        description: pkgData.description || '',
        duration_days: pkgData.duration_days || 1,
        duration_nights: pkgData.duration_nights || 0,
        base_price_usd: pkgData.base_price_usd || 0,
        base_price_eur: pkgData.base_price_eur || 0,
        base_price_ugx: pkgData.base_price_ugx || 0,
        price_per_person: pkgData.price_per_person ?? true,
        min_group_size: pkgData.min_group_size || 1,
        max_group_size: pkgData.max_group_size || 20,
        tour_type: pkgData.tour_type || 'Safari',
        difficulty_level: pkgData.difficulty_level || 'moderate',
        inclusions: pkgData.inclusions || '',
        exclusions: pkgData.exclusions || '',
        primary_destination_id: pkgData.primary_destination_id || '',
        image_url: pkgData.image_url || '',
        is_featured: pkgData.is_featured ?? false,
        is_active: pkgData.is_active ?? true,
      });

      // Load existing images
      if (imagesRes.data && imagesRes.data.length > 0) {
        setExistingImages(imagesRes.data);
        const primaryIndex = imagesRes.data.findIndex(img => img.is_primary);
        if (primaryIndex >= 0) setPrimaryImageIndex(primaryIndex);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error('Failed to load tour package');
      router.push('/dashboard/tours');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles: File[] = [];
      const newPreviews: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image file`);
          continue;
        }

        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 5MB`);
          continue;
        }

        newFiles.push(file);
        
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews.push(reader.result as string);
          if (newPreviews.length === newFiles.length) {
            setImageFiles(prev => [...prev, ...newFiles]);
            setImagePreviews(prev => [...prev, ...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeNewImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    if (primaryImageIndex === existingImages.length + index) {
      setPrimaryImageIndex(0);
    } else if (primaryImageIndex > existingImages.length + index) {
      setPrimaryImageIndex(prev => prev - 1);
    }
  };

  const removeExistingImage = (imageId: string, index: number) => {
    setDeletedImageIds(prev => [...prev, imageId]);
    setExistingImages(prev => prev.filter(img => img.id !== imageId));
    if (primaryImageIndex === index) {
      setPrimaryImageIndex(0);
    } else if (primaryImageIndex > index) {
      setPrimaryImageIndex(prev => prev - 1);
    }
  };

  const addImageUrl = () => {
    setImageUrls(prev => [...prev, '']);
  };

  const updateImageUrl = (index: number, value: string) => {
    setImageUrls(prev => prev.map((url, i) => i === index ? value : url));
  };

  const removeImageUrl = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
    const totalExistingAndFileImages = existingImages.length + imagePreviews.length;
    const urlImageIndex = totalExistingAndFileImages + index;
    if (primaryImageIndex === urlImageIndex) {
      setPrimaryImageIndex(0);
    } else if (primaryImageIndex > urlImageIndex) {
      setPrimaryImageIndex(primaryImageIndex - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.name) {
        throw new Error('Package name is required');
      }
      if (!formData.package_code) {
        throw new Error('Package code is required');
      }
      if (formData.duration_days < 1) {
        throw new Error('Duration must be at least 1 day');
      }
      if (formData.base_price_usd <= 0) {
        throw new Error('Base price (USD) must be greater than 0');
      }

      // Delete removed images
      for (const imageId of deletedImageIds) {
        await supabase
          .from('tour_package_images')
          .delete()
          .eq('id', imageId);
      }

      // Upload new images
      const newImageUrls: string[] = [];
      for (const file of imageFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${formData.package_code}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `packages/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('tour-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Failed to upload ${file.name}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('tour-images')
          .getPublicUrl(filePath);

        newImageUrls.push(publicUrl);
      }

      // Determine primary image URL for the package
      const totalImages = existingImages.length + newImageUrls.length;
      let primaryImageUrl = formData.image_url;

      if (totalImages > 0) {
        if (primaryImageIndex < existingImages.length) {
          primaryImageUrl = existingImages[primaryImageIndex].image_url;
        } else {
          primaryImageUrl = newImageUrls[primaryImageIndex - existingImages.length];
        }
      }

      // Update tour package
      const { error: updateError } = await supabase
        .from('tour_packages')
        .update({
          ...formData,
          image_url: primaryImageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id);

      if (updateError) throw updateError;

      // Update existing images primary status
      for (let i = 0; i < existingImages.length; i++) {
        const isPrimary = i === primaryImageIndex;
        await supabase
          .from('tour_package_images')
          .update({ is_primary: isPrimary })
          .eq('id', existingImages[i].id);
      }

      // Insert new images
      for (let i = 0; i < newImageUrls.length; i++) {
        const isPrimary = (existingImages.length + i) === primaryImageIndex;
        await supabase
          .from('tour_package_images')
          .insert({
            tour_package_id: params.id,
            image_url: newImageUrls[i],
            is_primary: isPrimary,
            display_order: existingImages.length + i + 1
          });
      }

      // Insert URL images
      if (imageUrls.length > 0) {
        const validUrls = imageUrls.filter(url => url.trim() !== '');
        if (validUrls.length > 0) {
          const baseIndex = existingImages.length + newImageUrls.length;
          for (let i = 0; i < validUrls.length; i++) {
            const isPrimary = (baseIndex + i) === primaryImageIndex;
            await supabase
              .from('tour_package_images')
              .insert({
                tour_package_id: params.id,
                image_url: validUrls[i].trim(),
                is_primary: isPrimary,
                display_order: baseIndex + i + 1
              });
          }
        }
      }

      toast.success('Tour package updated successfully!');
      router.push(`/dashboard/tours/${params.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update tour package';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tourTypes = [
    'Safari',
    'Gorilla Trekking',
    'Cultural Tour',
    'Adventure',
    'Wildlife Safari',
    'Bird Watching',
    'Mountain Hiking',
    'Beach Holiday',
    'City Tour',
    'Custom',
  ];

  const difficultyLevels = [
    { value: 'easy', label: 'Easy' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'challenging', label: 'Challenging' },
    { value: 'difficult', label: 'Difficult' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-breco-navy border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/dashboard/tours/${params.id}`}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Tour Package</h1>
          <p className="text-gray-600">Update tour package details</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <div className="flex items-center gap-2">
            <InformationCircleIcon className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <GlobeAltIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Basic Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Package Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="package_code"
                value={formData.package_code}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="PKG-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tour Type <span className="text-red-500">*</span>
              </label>
              <select
                name="tour_type"
                value={formData.tour_type}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                {tourTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Package Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="e.g., 7 Days Uganda Gorilla & Wildlife Safari"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="Describe the tour package highlights and overview..."
              />
            </div>
          </div>
        </div>

        {/* Duration & Capacity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <ClockIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Duration & Capacity</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Days <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="duration_days"
                value={formData.duration_days}
                onChange={handleChange}
                required
                min="1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nights <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="duration_nights"
                value={formData.duration_nights}
                onChange={handleChange}
                required
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Group Size <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="min_group_size"
                value={formData.min_group_size}
                onChange={handleChange}
                required
                min="1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Group Size <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="max_group_size"
                value={formData.max_group_size}
                onChange={handleChange}
                required
                min="1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Difficulty Level
              </label>
              <select
                name="difficulty_level"
                value={formData.difficulty_level}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                {difficultyLevels.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Destination
              </label>
              <select
                name="primary_destination_id"
                value={formData.primary_destination_id}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                <option value="">Select destination</option>
                {destinations.map((dest) => (
                  <option key={dest.id} value={dest.id}>
                    {dest.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CurrencyDollarIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Pricing</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Price (USD) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="base_price_usd"
                value={formData.base_price_usd}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Price (EUR)
              </label>
              <input
                type="number"
                name="base_price_eur"
                value={formData.base_price_eur}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Price (UGX)
              </label>
              <input
                type="number"
                name="base_price_ugx"
                value={formData.base_price_ugx}
                onChange={handleChange}
                min="0"
                step="1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="0"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="price_per_person"
                  checked={formData.price_per_person}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-breco-navy focus:ring-breco-navy"
                />
                <span className="text-sm text-gray-700">
                  Price is per person (uncheck for group pricing)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Tour Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <UserGroupIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Tour Details</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inclusions
              </label>
              <textarea
                name="inclusions"
                value={formData.inclusions}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="List what's included in the package"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exclusions
              </label>
              <textarea
                name="exclusions"
                value={formData.exclusions}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="List what's not included"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Package Images
              </label>
              
              {/* Image Upload */}
              <div className="mt-1">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">Multiple images: PNG, JPG, WEBP up to 5MB each</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Existing Images */}
              {existingImages.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Current Images</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {existingImages.map((img, index) => (
                      <div key={img.id} className="relative group">
                        <div className={`relative rounded-lg overflow-hidden border-2 ${
                          primaryImageIndex === index ? 'border-breco-gold ring-2 ring-breco-gold' : 'border-gray-200'
                        }`}>
                          <img
                            src={img.image_url}
                            alt={`Image ${index + 1}`}
                            className="w-full h-32 object-cover"
                          />
                          {primaryImageIndex === index && (
                            <div className="absolute top-1 left-1 bg-breco-gold text-white text-xs px-2 py-0.5 rounded-full font-medium">
                              Primary
                            </div>
                          )}
                          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => setPrimaryImageIndex(index)}
                              className="p-1.5 bg-breco-gold text-white rounded-full hover:bg-yellow-600 transition-colors"
                              title="Set as primary"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeExistingImage(img.id, index)}
                              className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                              title="Remove image"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    New Images ({imagePreviews.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {imagePreviews.map((preview, index) => {
                      const globalIndex = existingImages.length + index;
                      return (
                        <div key={`new-${index}`} className="relative group">
                          <div className={`relative rounded-lg overflow-hidden border-2 ${
                            primaryImageIndex === globalIndex ? 'border-breco-gold ring-2 ring-breco-gold' : 'border-gray-200'
                          }`}>
                            <img
                              src={preview}
                              alt={`New ${index + 1}`}
                              className="w-full h-32 object-cover"
                            />
                            {primaryImageIndex === globalIndex && (
                              <div className="absolute top-1 left-1 bg-breco-gold text-white text-xs px-2 py-0.5 rounded-full font-medium">
                                Primary
                              </div>
                            )}
                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => setPrimaryImageIndex(globalIndex)}
                                className="p-1.5 bg-breco-gold text-white rounded-full hover:bg-yellow-600 transition-colors"
                                title="Set as primary"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => removeNewImage(index)}
                                className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                                title="Remove image"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* OR divider */}
              {(existingImages.length > 0 || imagePreviews.length > 0 || imageUrls.length > 0) && (
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or add URLs</span>
                  </div>
                </div>
              )}

              {/* URL Inputs */}
              <div className="space-y-3">
                {imageUrls.map((url, index) => {
                  const actualIndex = existingImages.length + imagePreviews.length + index;
                  return (
                    <div key={index} className="flex gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => setPrimaryImageIndex(actualIndex)}
                        className={`flex-shrink-0 p-2 rounded ${
                          primaryImageIndex === actualIndex
                            ? 'text-breco-gold'
                            : 'text-gray-400 hover:text-breco-gold'
                        }`}
                        title="Set as primary"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => updateImageUrl(index, e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                        placeholder={`Image URL ${index + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeImageUrl(index)}
                        className="flex-shrink-0 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Remove"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
                
                <button
                  type="button"
                  onClick={addImageUrl}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-breco-navy hover:text-breco-navy transition-colors"
                >
                  + Add Image URL
                </button>
              </div>
              
              <p className="text-xs text-gray-500 mt-2">
                {(existingImages.length > 0 || imagePreviews.length > 0 || imageUrls.length > 0)
                  ? 'Click the star icon to set the primary image. Primary image will be shown in package listings.'
                  : 'Upload files or add image URLs. You can mix both types.'}
              </p>
            </div>
          </div>
        </div>

        {/* Package Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Package Settings</h2>

          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_featured"
                checked={formData.is_featured}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-300 text-breco-navy focus:ring-breco-navy"
              />
              <span className="text-sm text-gray-700">
                Mark as featured
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-300 text-breco-navy focus:ring-breco-navy"
              />
              <span className="text-sm text-gray-700">
                Package is active
              </span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/dashboard/tours/${params.id}`} className="btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

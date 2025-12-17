'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function NewTourPackagePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loadingDestinations, setLoadingDestinations] = useState(true);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);

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
    loadDestinations();
    generatePackageCode();
  }, []);

  const loadDestinations = async () => {
    try {
      const { data, error } = await supabase
        .from('destinations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setDestinations(data || []);
    } catch (err) {
      console.error('Failed to load destinations:', err);
      toast.error('Failed to load destinations');
    } finally {
      setLoadingDestinations(false);
    }
  };

  const generatePackageCode = async () => {
    try {
      // Generate package code like PKG-001, PKG-002, etc.
      const { data, error } = await supabase
        .from('tour_packages')
        .select('package_code')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastCode = data[0].package_code;
        const match = lastCode.match(/PKG-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const newCode = `PKG-${String(nextNumber).padStart(3, '0')}`;
      setFormData((prev) => ({ ...prev, package_code: newCode }));
    } catch (err) {
      console.error('Failed to generate package code:', err);
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
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;

    // Validate files
    const validFiles: File[] = [];
    const validPreviews: string[] = [];

    files.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`);
        return;
      }

      validFiles.push(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        validPreviews.push(reader.result as string);
        if (validPreviews.length === validFiles.length) {
          setImagePreviews((prev) => [...prev, ...validPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });

    setImageFiles((prev) => [...prev, ...validFiles]);
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    
    // Adjust primary index if needed
    if (primaryImageIndex === index) {
      setPrimaryImageIndex(0);
    } else if (primaryImageIndex > index) {
      setPrimaryImageIndex(primaryImageIndex - 1);
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
    const totalFileImages = imagePreviews.length;
    const urlImageIndex = totalFileImages + index;
    if (primaryImageIndex === urlImageIndex) {
      setPrimaryImageIndex(0);
    } else if (primaryImageIndex > urlImageIndex) {
      setPrimaryImageIndex(primaryImageIndex - 1);
    }
  };

  const setPrimaryImage = (index: number) => {
    setPrimaryImageIndex(index);
    toast.success('Primary image set');
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

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Insert tour package first
      const { data: packageData, error: packageError } = await supabase
        .from('tour_packages')
        .insert({
          ...formData,
          image_url: formData.image_url || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (packageError) throw packageError;

      // Upload images if files are selected
      const uploadedImages: Array<{ image_url: string; is_primary: boolean; display_order: number }> = [];
      
      if (imageFiles.length > 0) {

        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${formData.package_code}-${Date.now()}-${i}.${fileExt}`;
          const filePath = `packages/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('tour-images')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue; // Skip this image but continue with others
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('tour-images')
            .getPublicUrl(filePath);

          uploadedImages.push({
            image_url: publicUrl,
            is_primary: i === primaryImageIndex,
            display_order: i,
          });
        }

        // Insert all images
        if (uploadedImages.length > 0) {
          const { error: imagesError } = await supabase
            .from('tour_package_images')
            .insert(
              uploadedImages.map((img) => ({
                tour_package_id: packageData.id,
                ...img,
              }))
            );

          if (imagesError) {
            console.error('Failed to save some images:', imagesError);
          }

          // Update package with primary image URL
          const primaryImage = uploadedImages.find(img => img.is_primary);
          if (primaryImage) {
            await supabase
              .from('tour_packages')
              .update({ image_url: primaryImage.image_url })
              .eq('id', packageData.id);
          }
        }
      }

      // Process URL images (if no files were uploaded or mixed with files)
      if (imageUrls.length > 0) {
        const validUrls = imageUrls.filter(url => url.trim() !== '');
        if (validUrls.length > 0) {
          const urlImages = validUrls.map((url, index) => {
            const actualIndex = uploadedImages.length + index;
            return {
              tour_package_id: packageData.id,
              image_url: url.trim(),
              is_primary: actualIndex === primaryImageIndex,
              display_order: actualIndex,
            };
          });

          const { error: urlImagesError } = await supabase
            .from('tour_package_images')
            .insert(urlImages);

          if (urlImagesError) {
            console.error('Failed to save URL images:', urlImagesError);
          }

          // Update package with primary image URL if it's from URLs
          const primaryUrlImage = urlImages.find(img => img.is_primary);
          if (primaryUrlImage && uploadedImages.length === 0) {
            await supabase
              .from('tour_packages')
              .update({ image_url: primaryUrlImage.image_url })
              .eq('id', packageData.id);
          } else if (primaryUrlImage && primaryImageIndex >= uploadedImages.length) {
            await supabase
              .from('tour_packages')
              .update({ image_url: primaryUrlImage.image_url })
              .eq('id', packageData.id);
          }
        }
      }

      toast.success('Tour package created successfully!');
      router.push(`/dashboard/tours/${packageData.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create tour package';
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

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/tours"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Tour Package</h1>
          <p className="text-gray-600">Create a new safari tour package</p>
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
              <p className="text-xs text-gray-500 mt-1">Unique identifier for this package</p>
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
                disabled={loadingDestinations}
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
                placeholder="List what's included in the package (e.g., accommodation, meals, park fees, guide, transport)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Tip: Use bullet points or line breaks for better readability
              </p>
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
                placeholder="List what's not included (e.g., international flights, visas, travel insurance, tips)"
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
                    <p className="text-xs text-gray-500">Select multiple images (PNG, JPG, WEBP up to 5MB each)</p>
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

              {/* Image Previews Grid */}
              {imagePreviews.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className={`w-full h-32 object-cover rounded-lg ${
                          primaryImageIndex === index ? 'ring-4 ring-breco-gold' : ''
                        }`}
                      />
                      
                      {/* Primary badge */}
                      {primaryImageIndex === index && (
                        <div className="absolute top-2 left-2 bg-breco-gold text-white text-xs font-semibold px-2 py-1 rounded">
                          Primary
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {primaryImageIndex !== index && (
                          <button
                            type="button"
                            onClick={() => setPrimaryImage(index)}
                            className="p-1.5 bg-breco-navy text-white rounded-full hover:bg-breco-navy-dark transition-colors"
                            title="Set as primary"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                          title="Remove"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                        {index + 1} of {imagePreviews.length}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* OR divider */}
              {(imagePreviews.length > 0 || imageUrls.length > 0) && (
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or use URLs</span>
                  </div>
                </div>
              )}

              {/* URL Inputs */}
              <div className="space-y-3">
                {imageUrls.map((url, index) => {
                  const actualIndex = imagePreviews.length + index;
                  return (
                    <div key={index} className="flex gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => setPrimaryImage(actualIndex)}
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
                {(imagePreviews.length > 0 || imageUrls.length > 0)
                  ? 'Click the star icon to set a primary image. The primary image will be shown in listings.'
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
                Mark as featured (will be highlighted on the website)
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
                Package is active and available for booking
              </span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/dashboard/tours" className="btn-secondary">
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
                Creating...
              </>
            ) : (
              'Create Tour Package'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

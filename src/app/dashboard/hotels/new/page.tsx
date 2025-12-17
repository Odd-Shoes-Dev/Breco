'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  BuildingStorefrontIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  StarIcon,
  CurrencyDollarIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import type { Destination } from '@/types/breco';

interface HotelFormData {
  name: string;
  destination_id: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  star_rating: number;
  hotel_type: string;
  standard_rate_usd: number;
  deluxe_rate_usd: number;
  suite_rate_usd: number;
  contact_person: string;
  contact_phone: string;
  commission_rate: number;
  notes: string;
  is_partner: boolean;
  is_active: boolean;
}

export default function NewHotelPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loadingDestinations, setLoadingDestinations] = useState(true);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);

  const [formData, setFormData] = useState<HotelFormData>({
    name: '',
    destination_id: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    star_rating: 3,
    hotel_type: 'Lodge',
    standard_rate_usd: 0,
    deluxe_rate_usd: 0,
    suite_rate_usd: 0,
    contact_person: '',
    contact_phone: '',
    commission_rate: 10,
    notes: '',
    is_partner: true,
    is_active: true,
  });

  useEffect(() => {
    loadDestinations();
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
        throw new Error('Hotel name is required');
      }

      // Create hotel record
      const { data: hotelData, error: hotelError } = await supabase
        .from('hotels')
        .insert({
          ...formData,
          destination_id: formData.destination_id || null,
        })
        .select()
        .single();

      if (hotelError) throw hotelError;

      // Upload images if files are selected
      const uploadedImages: Array<{ image_url: string; is_primary: boolean; display_order: number }> = [];
      
      if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${hotelData.id}-${Date.now()}-${i}.${fileExt}`;
          const filePath = `hotels/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('hotel-images')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('hotel-images')
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
            .from('hotel_images')
            .insert(
              uploadedImages.map((img) => ({
                hotel_id: hotelData.id,
                ...img,
              }))
            );

          if (imagesError) {
            console.error('Failed to save some images:', imagesError);
          }
        }
      }

      // Process URL images
      if (imageUrls.length > 0) {
        const validUrls = imageUrls.filter(url => url.trim() !== '');
        if (validUrls.length > 0) {
          const urlImages = validUrls.map((url, index) => {
            const actualIndex = uploadedImages.length + index;
            return {
              hotel_id: hotelData.id,
              image_url: url.trim(),
              is_primary: actualIndex === primaryImageIndex,
              display_order: actualIndex,
            };
          });

          const { error: urlImagesError } = await supabase
            .from('hotel_images')
            .insert(urlImages);

          if (urlImagesError) {
            console.error('Failed to save URL images:', urlImagesError);
          }
        }
      }

      toast.success('Hotel created successfully!');
      router.push(`/dashboard/hotels/${hotelData.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create hotel';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hotelTypes = [
    'Lodge',
    'Hotel',
    'Resort',
    'Camp',
    'Guest House',
    'Boutique Hotel',
    'Eco Lodge',
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/hotels"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Hotel</h1>
            <p className="text-sm text-gray-600 mt-1">
              Add a new hotel or accommodation partner
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BuildingStorefrontIcon className="w-5 h-5 text-breco-navy" />
            Basic Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hotel Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="Serena Hotel"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destination
              </label>
              <select
                name="destination_id"
                value={formData.destination_id}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                <option value="">Select destination</option>
                {destinations.map((dest) => (
                  <option key={dest.id} value={dest.id}>
                    {dest.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hotel Type
              </label>
              <select
                name="hotel_type"
                value={formData.hotel_type}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                {hotelTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Star Rating
              </label>
              <select
                name="star_rating"
                value={formData.star_rating}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating} Star{rating > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Commission Rate (%)
              </label>
              <input
                type="number"
                name="commission_rate"
                value={formData.commission_rate}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPinIcon className="w-5 h-5 text-breco-navy" />
            Contact Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="Plot 12, Kira Road"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="+256 123 456 789"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="info@hotel.com"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="https://hotel.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="+256 123 456 789"
              />
            </div>
          </div>
        </div>

        {/* Rates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CurrencyDollarIcon className="w-5 h-5 text-breco-navy" />
            Room Rates (USD per night)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Standard Rate
              </label>
              <input
                type="number"
                name="standard_rate_usd"
                value={formData.standard_rate_usd}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deluxe Rate
              </label>
              <input
                type="number"
                name="deluxe_rate_usd"
                value={formData.deluxe_rate_usd}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Suite Rate
              </label>
              <input
                type="number"
                name="suite_rate_usd"
                value={formData.suite_rate_usd}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PhotoIcon className="w-5 h-5 text-breco-navy" />
            Hotel Images
          </h2>

          <div className="space-y-4">
            {/* File Upload */}
            <div>
              <label className="block">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-breco-navy transition-colors cursor-pointer">
                  <PhotoIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, GIF up to 5MB each
                  </p>
                  <input
                    type="file"
                    onChange={handleImageChange}
                    multiple
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </label>
            </div>

            {/* Image Previews */}
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className={`w-full h-32 object-cover rounded-lg ${
                        primaryImageIndex === index ? 'ring-4 ring-breco-gold' : ''
                      }`}
                    />
                    
                    {primaryImageIndex === index && (
                      <div className="absolute top-2 left-2 bg-breco-gold text-white text-xs font-semibold px-2 py-1 rounded">
                        Primary
                      </div>
                    )}

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

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Additional Notes</h2>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
            placeholder="Any additional information about the hotel..."
          />
        </div>

        {/* Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Settings</h2>

          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_partner"
                checked={formData.is_partner}
                onChange={handleChange}
                className="rounded border-gray-300 text-breco-navy focus:ring-breco-navy"
              />
              <span className="text-sm text-gray-700">Partner Hotel</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="rounded border-gray-300 text-breco-navy focus:ring-breco-navy"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/dashboard/hotels"
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-breco-navy text-white rounded-lg hover:bg-breco-navy-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Creating...' : 'Create Hotel'}
          </button>
        </div>
      </form>
    </div>
  );
}

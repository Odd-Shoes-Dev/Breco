'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  InformationCircleIcon,
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

export default function EditHotelPage() {
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

  const [formData, setFormData] = useState<HotelFormData>({
    name: '',
    destination_id: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    star_rating: 3,
    hotel_type: 'Hotel',
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

      // Load hotel and images
      const [hotelRes, imagesRes] = await Promise.all([
        supabase
          .from('hotels')
          .select('*')
          .eq('id', params.id)
          .single(),
        supabase
          .from('hotel_images')
          .select('*')
          .eq('hotel_id', params.id)
          .order('display_order')
      ]);

      if (hotelRes.error) throw hotelRes.error;
      const hotelData = hotelRes.data;

      setFormData({
        name: hotelData.name || '',
        destination_id: hotelData.destination_id || '',
        address: hotelData.address || '',
        phone: hotelData.phone || '',
        email: hotelData.email || '',
        website: hotelData.website || '',
        star_rating: hotelData.star_rating || 3,
        hotel_type: hotelData.hotel_type || 'Hotel',
        standard_rate_usd: hotelData.standard_rate_usd || 0,
        deluxe_rate_usd: hotelData.deluxe_rate_usd || 0,
        suite_rate_usd: hotelData.suite_rate_usd || 0,
        contact_person: hotelData.contact_person || '',
        contact_phone: hotelData.contact_phone || '',
        commission_rate: hotelData.commission_rate || 10,
        notes: hotelData.notes || '',
        is_partner: hotelData.is_partner ?? true,
        is_active: hotelData.is_active ?? true,
      });

      // Load existing images
      if (imagesRes.data && imagesRes.data.length > 0) {
        setExistingImages(imagesRes.data);
        const primaryIndex = imagesRes.data.findIndex(img => img.is_primary);
        if (primaryIndex >= 0) setPrimaryImageIndex(primaryIndex);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error('Failed to load hotel');
      router.push('/dashboard/hotels');
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
        throw new Error('Hotel name is required');
      }

      // Delete removed images
      for (const imageId of deletedImageIds) {
        await supabase
          .from('hotel_images')
          .delete()
          .eq('id', imageId);
      }

      // Upload new images
      const newImageUrls: string[] = [];
      for (const file of imageFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `hotels/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('hotel-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Failed to upload ${file.name}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('hotel-images')
          .getPublicUrl(filePath);

        newImageUrls.push(publicUrl);
      }

      // Update hotel
      const { error: updateError } = await supabase
        .from('hotels')
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id);

      if (updateError) throw updateError;

      // Update existing images primary status
      for (let i = 0; i < existingImages.length; i++) {
        const isPrimary = i === primaryImageIndex;
        await supabase
          .from('hotel_images')
          .update({ is_primary: isPrimary })
          .eq('id', existingImages[i].id);
      }

      // Insert new images from files
      for (let i = 0; i < newImageUrls.length; i++) {
        const isPrimary = (existingImages.length + i) === primaryImageIndex;
        await supabase
          .from('hotel_images')
          .insert({
            hotel_id: params.id,
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
              .from('hotel_images')
              .insert({
                hotel_id: params.id,
                image_url: validUrls[i].trim(),
                is_primary: isPrimary,
                display_order: baseIndex + i + 1
              });
          }
        }
      }

      toast.success('Hotel updated successfully!');
      router.push(`/dashboard/hotels/${params.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update hotel';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hotelTypes = [
    'Hotel',
    'Lodge',
    'Camp',
    'Guesthouse',
    'Resort',
    'Boutique Hotel',
    'Safari Lodge',
    'Tented Camp',
    'Other',
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
          href={`/dashboard/hotels/${params.id}`}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Hotel</h1>
          <p className="text-gray-600">Update hotel details and information</p>
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
            <BuildingStorefrontIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Basic Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hotel Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="e.g., Mweya Safari Lodge"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hotel Type
              </label>
              <select
                name="hotel_type"
                value={formData.hotel_type}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating} {rating === 1 ? 'Star' : 'Stars'}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="Enter hotel address"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <PhoneIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Contact Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="+256 xxx xxx xxx"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="hotel@example.com"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="https://www.hotel-website.com"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="Contact person name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="+256 xxx xxx xxx"
              />
            </div>
          </div>
        </div>

        {/* Rates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CurrencyDollarIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Room Rates (USD)</h2>
          </div>

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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="0.00"
              />
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
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="10"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <GlobeAltIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Hotel Images</h2>
          </div>

          <div className="space-y-4">
            {/* Image Upload */}
            <div>
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
                ? 'Click the star icon to set the primary image. Primary image will be shown in hotel listings.'
                : 'Upload files or add image URLs. You can mix both types.'}
            </p>
          </div>
        </div>

        {/* Additional Notes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <InformationCircleIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Additional Information</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="Any additional notes about this hotel..."
              />
            </div>
          </div>
        </div>

        {/* Hotel Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Hotel Settings</h2>

          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_partner"
                checked={formData.is_partner}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-300 text-breco-navy focus:ring-breco-navy"
              />
              <span className="text-sm text-gray-700">
                Mark as partner hotel
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
                Hotel is active
              </span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/dashboard/hotels/${params.id}`} className="btn-secondary">
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

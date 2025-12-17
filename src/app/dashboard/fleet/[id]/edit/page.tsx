'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  TruckIcon,
  CurrencyDollarIcon,
  WrenchScrewdriverIcon,
  PhotoIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface VehicleFormData {
  vehicle_number: string;
  registration_number: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vehicle_type: string;
  fuel_type: string;
  transmission: string;
  seating_capacity: number;
  luggage_capacity: string;
  features: string;
  purchase_date: string;
  purchase_price: number;
  current_value: number;
  insurance_expiry: string;
  daily_rate_usd: number;
  daily_rate_ugx: number;
  weekly_rate_usd: number;
  mileage_rate: number;
  status: string;
  current_mileage: number;
  last_service_date: string;
  next_service_mileage: number;
  location: string;
  notes: string;
  is_active: boolean;
}

export default function EditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<Array<{ id: string; image_url: string; is_primary: boolean; display_order: number }>>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);

  const [formData, setFormData] = useState<VehicleFormData>({
    vehicle_number: '',
    registration_number: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    vehicle_type: 'Safari Van',
    fuel_type: 'Diesel',
    transmission: 'Manual',
    seating_capacity: 7,
    luggage_capacity: '',
    features: '',
    purchase_date: '',
    purchase_price: 0,
    current_value: 0,
    insurance_expiry: '',
    daily_rate_usd: 0,
    daily_rate_ugx: 0,
    weekly_rate_usd: 0,
    mileage_rate: 0,
    status: 'available',
    current_mileage: 0,
    last_service_date: '',
    next_service_mileage: 0,
    location: '',
    notes: '',
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    try {
      // Load vehicle and images
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
      const vehicleData = vehicleRes.data;

      // Convert features array to comma-separated string
      const featuresString = Array.isArray(vehicleData.features) 
        ? vehicleData.features.join(', ') 
        : '';

      setFormData({
        vehicle_number: vehicleData.vehicle_number || '',
        registration_number: vehicleData.registration_number || '',
        make: vehicleData.make || '',
        model: vehicleData.model || '',
        year: vehicleData.year || new Date().getFullYear(),
        color: vehicleData.color || '',
        vehicle_type: vehicleData.vehicle_type || 'Safari Van',
        fuel_type: vehicleData.fuel_type || 'Diesel',
        transmission: vehicleData.transmission || 'Manual',
        seating_capacity: vehicleData.seating_capacity || 7,
        luggage_capacity: vehicleData.luggage_capacity || '',
        features: featuresString,
        purchase_date: vehicleData.purchase_date || '',
        purchase_price: vehicleData.purchase_price || 0,
        current_value: vehicleData.current_value || 0,
        insurance_expiry: vehicleData.insurance_expiry || '',
        daily_rate_usd: vehicleData.daily_rate_usd || 0,
        daily_rate_ugx: vehicleData.daily_rate_ugx || 0,
        weekly_rate_usd: vehicleData.weekly_rate_usd || 0,
        mileage_rate: vehicleData.mileage_rate || 0,
        status: vehicleData.status || 'available',
        current_mileage: vehicleData.current_mileage || 0,
        last_service_date: vehicleData.last_service_date || '',
        next_service_mileage: vehicleData.next_service_mileage || 0,
        location: vehicleData.location || '',
        notes: vehicleData.notes || '',
        is_active: vehicleData.is_active ?? true,
      });

      // Load existing images
      if (imagesRes.data && imagesRes.data.length > 0) {
        setExistingImages(imagesRes.data);
        const primaryIndex = imagesRes.data.findIndex(img => img.is_primary);
        if (primaryIndex >= 0) setPrimaryImageIndex(primaryIndex);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error('Failed to load vehicle');
      router.push('/dashboard/fleet');
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
      if (!formData.vehicle_number) {
        throw new Error('Vehicle number is required');
      }
      if (!formData.registration_number) {
        throw new Error('Registration number is required');
      }

      // Convert features string to array
      const featuresArray = formData.features
        .split(',')
        .map(f => f.trim())
        .filter(f => f !== '');

      // Delete removed images
      for (const imageId of deletedImageIds) {
        await supabase
          .from('vehicle_images')
          .delete()
          .eq('id', imageId);
      }

      // Upload new images
      const newImageUrls: string[] = [];
      for (const file of imageFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `vehicles/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('fleet-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Failed to upload ${file.name}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('fleet-images')
          .getPublicUrl(filePath);

        newImageUrls.push(publicUrl);
      }

      // Update vehicle
      const { error: updateError } = await supabase
        .from('vehicles')
        .update({
          ...formData,
          features: featuresArray,
          purchase_date: formData.purchase_date || null,
          insurance_expiry: formData.insurance_expiry || null,
          last_service_date: formData.last_service_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id);

      if (updateError) throw updateError;

      // Update existing images primary status
      for (let i = 0; i < existingImages.length; i++) {
        const isPrimary = i === primaryImageIndex;
        await supabase
          .from('vehicle_images')
          .update({ is_primary: isPrimary })
          .eq('id', existingImages[i].id);
      }

      // Insert new images from files
      for (let i = 0; i < newImageUrls.length; i++) {
        const isPrimary = (existingImages.length + i) === primaryImageIndex;
        await supabase
          .from('vehicle_images')
          .insert({
            vehicle_id: params.id,
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
              .from('vehicle_images')
              .insert({
                vehicle_id: params.id,
                image_url: validUrls[i].trim(),
                is_primary: isPrimary,
                display_order: baseIndex + i + 1
              });
          }
        }
      }

      toast.success('Vehicle updated successfully!');
      router.push(`/dashboard/fleet/${params.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update vehicle';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const vehicleTypes = ['Safari Van', 'Land Cruiser', 'Minibus', 'Sedan', 'SUV'];
  const fuelTypes = ['Petrol', 'Diesel', 'Hybrid', 'Electric'];
  const transmissionTypes = ['Manual', 'Automatic'];
  const statusOptions = ['available', 'in_use', 'maintenance', 'retired'];

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
          href={`/dashboard/fleet/${params.id}`}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Vehicle</h1>
          <p className="text-gray-600">Update vehicle details and information</p>
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
            <TruckIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Basic Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="vehicle_number"
                value={formData.vehicle_number}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="V001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Registration Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="registration_number"
                value={formData.registration_number}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="UAZ 123A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Make
              </label>
              <input
                type="text"
                name="make"
                value={formData.make}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="Toyota"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="Land Cruiser"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year
              </label>
              <input
                type="number"
                name="year"
                value={formData.year}
                onChange={handleChange}
                min="1900"
                max={new Date().getFullYear() + 1}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color
              </label>
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="White"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="Main Office"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                name="purchase_date"
                value={formData.purchase_date}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Price (USD)
              </label>
              <input
                type="number"
                name="purchase_price"
                value={formData.purchase_price}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Value (USD)
              </label>
              <input
                type="number"
                name="current_value"
                value={formData.current_value}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Insurance Expiry
              </label>
              <input
                type="date"
                name="insurance_expiry"
                value={formData.insurance_expiry}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>
          </div>
        </div>

        {/* Specifications */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Specifications</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle Type
              </label>
              <select
                name="vehicle_type"
                value={formData.vehicle_type}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                {vehicleTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fuel Type
              </label>
              <select
                name="fuel_type"
                value={formData.fuel_type}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                {fuelTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transmission
              </label>
              <select
                name="transmission"
                value={formData.transmission}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                {transmissionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seating Capacity
              </label>
              <input
                type="number"
                name="seating_capacity"
                value={formData.seating_capacity}
                onChange={handleChange}
                min="1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Luggage Capacity
              </label>
              <input
                type="text"
                name="luggage_capacity"
                value={formData.luggage_capacity}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="e.g., 4 large bags"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Features
              </label>
              <input
                type="text"
                name="features"
                value={formData.features}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="AC, GPS, 4WD, Pop-up roof (comma-separated)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter features separated by commas
              </p>
            </div>
          </div>
        </div>

        {/* Rental Rates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CurrencyDollarIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Rental Rates</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Daily Rate (USD)
              </label>
              <input
                type="number"
                name="daily_rate_usd"
                value={formData.daily_rate_usd}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Daily Rate (UGX)
              </label>
              <input
                type="number"
                name="daily_rate_ugx"
                value={formData.daily_rate_ugx}
                onChange={handleChange}
                min="0"
                step="1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weekly Rate (USD)
              </label>
              <input
                type="number"
                name="weekly_rate_usd"
                value={formData.weekly_rate_usd}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mileage Rate (per km)
              </label>
              <input
                type="number"
                name="mileage_rate"
                value={formData.mileage_rate}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <WrenchScrewdriverIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Maintenance</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Mileage (km)
              </label>
              <input
                type="number"
                name="current_mileage"
                value={formData.current_mileage}
                onChange={handleChange}
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Service Date
              </label>
              <input
                type="date"
                name="last_service_date"
                value={formData.last_service_date}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Next Service Mileage (km)
              </label>
              <input
                type="number"
                name="next_service_mileage"
                value={formData.next_service_mileage}
                onChange={handleChange}
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <PhotoIcon className="w-5 h-5 text-breco-navy" />
            <h2 className="font-semibold text-gray-900">Vehicle Images</h2>
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
                ? 'Click the star icon to set the primary image. Primary image will be shown in vehicle listings.'
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
                placeholder="Any additional notes about this vehicle..."
              />
            </div>
          </div>
        </div>

        {/* Vehicle Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Vehicle Settings</h2>

          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-300 text-breco-navy focus:ring-breco-navy"
              />
              <span className="text-sm text-gray-700">
                Vehicle is active
              </span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/dashboard/fleet/${params.id}`} className="btn-secondary">
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

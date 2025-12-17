'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  TruckIcon,
  CurrencyDollarIcon,
  WrenchScrewdriverIcon,
  PhotoIcon,
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

export default function NewVehiclePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else if (type === 'date') {
      setFormData((prev) => ({ ...prev, [name]: value }));
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

      // Create vehicle record
      const { data: vehicleData, error: vehicleError } = await supabase
        .from('vehicles')
        .insert({
          ...formData,
          features: featuresArray,
          purchase_date: formData.purchase_date || null,
          insurance_expiry: formData.insurance_expiry || null,
          last_service_date: formData.last_service_date || null,
        })
        .select()
        .single();

      if (vehicleError) throw vehicleError;

      // Upload images if files are selected
      const uploadedImages: Array<{ image_url: string; is_primary: boolean; display_order: number }> = [];
      
      if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${vehicleData.id}-${Date.now()}-${i}.${fileExt}`;
          const filePath = `vehicles/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('fleet-images')
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
            .from('fleet-images')
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
            .from('vehicle_images')
            .insert(
              uploadedImages.map((img) => ({
                vehicle_id: vehicleData.id,
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
              vehicle_id: vehicleData.id,
              image_url: url.trim(),
              is_primary: actualIndex === primaryImageIndex,
              display_order: actualIndex,
            };
          });

          const { error: urlImagesError } = await supabase
            .from('vehicle_images')
            .insert(urlImages);

          if (urlImagesError) {
            console.error('Failed to save URL images:', urlImagesError);
          }
        }
      }

      toast.success('Vehicle created successfully!');
      router.push(`/dashboard/fleet/${vehicleData.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create vehicle';
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

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/fleet"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Vehicle</h1>
            <p className="text-sm text-gray-600 mt-1">
              Add a new vehicle to the fleet
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
            <TruckIcon className="w-5 h-5 text-breco-navy" />
            Basic Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle Number *
              </label>
              <input
                type="text"
                name="vehicle_number"
                value={formData.vehicle_number}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="V001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Registration Number *
              </label>
              <input
                type="text"
                name="registration_number"
                value={formData.registration_number}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="AC, GPS, 4WD, Pop-up roof (comma-separated)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter features separated by commas
              </p>
            </div>
          </div>
        </div>

        {/* Rates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CurrencyDollarIcon className="w-5 h-5 text-breco-navy" />
            Rental Rates
          </h2>

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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <WrenchScrewdriverIcon className="w-5 h-5 text-breco-navy" />
            Maintenance
          </h2>

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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-breco-navy"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PhotoIcon className="w-5 h-5 text-breco-navy" />
            Vehicle Images
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
            placeholder="Any additional information about the vehicle..."
          />
        </div>

        {/* Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Settings</h2>

          <div className="space-y-3">
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
            href="/dashboard/fleet"
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-breco-navy text-white rounded-lg hover:bg-breco-navy-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Creating...' : 'Create Vehicle'}
          </button>
        </div>
      </form>
    </div>
  );
}

-- Create storage bucket for fleet/vehicle images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fleet-images',
  'fleet-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Public read access for fleet images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload fleet images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update fleet images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete fleet images" ON storage.objects;

-- Allow public read access to fleet images
CREATE POLICY "Public read access for fleet images"
ON storage.objects FOR SELECT
USING (bucket_id = 'fleet-images');

-- Allow authenticated users to upload fleet images
CREATE POLICY "Authenticated users can upload fleet images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fleet-images' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update their fleet images
CREATE POLICY "Authenticated users can update fleet images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'fleet-images'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete fleet images
CREATE POLICY "Authenticated users can delete fleet images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'fleet-images'
  AND auth.role() = 'authenticated'
);

-- Create table for multiple vehicle images
CREATE TABLE IF NOT EXISTS vehicle_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  caption VARCHAR(255),
  display_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle ON vehicle_images(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_images_primary ON vehicle_images(vehicle_id, is_primary);

-- Add trigger to update updated_at
CREATE TRIGGER update_vehicle_images_updated_at 
BEFORE UPDATE ON vehicle_images 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one primary image per vehicle
CREATE OR REPLACE FUNCTION ensure_single_primary_vehicle_image()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    -- Set all other images for this vehicle to non-primary
    UPDATE vehicle_images 
    SET is_primary = false 
    WHERE vehicle_id = NEW.vehicle_id 
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_vehicle_img
BEFORE INSERT OR UPDATE ON vehicle_images
FOR EACH ROW
WHEN (NEW.is_primary = true)
EXECUTE FUNCTION ensure_single_primary_vehicle_image();

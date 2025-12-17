-- Create storage bucket for hotel images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hotel-images',
  'hotel-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Public read access for hotel images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload hotel images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update hotel images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete hotel images" ON storage.objects;

-- Allow public read access to hotel images
CREATE POLICY "Public read access for hotel images"
ON storage.objects FOR SELECT
USING (bucket_id = 'hotel-images');

-- Allow authenticated users to upload hotel images
CREATE POLICY "Authenticated users can upload hotel images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'hotel-images' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update their hotel images
CREATE POLICY "Authenticated users can update hotel images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'hotel-images'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete hotel images
CREATE POLICY "Authenticated users can delete hotel images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'hotel-images'
  AND auth.role() = 'authenticated'
);

-- Create table for multiple hotel images
CREATE TABLE IF NOT EXISTS hotel_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  caption VARCHAR(255),
  display_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_images_hotel ON hotel_images(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_images_primary ON hotel_images(hotel_id, is_primary);

-- Add trigger to update updated_at
CREATE TRIGGER update_hotel_images_updated_at 
BEFORE UPDATE ON hotel_images 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one primary image per hotel
CREATE OR REPLACE FUNCTION ensure_single_primary_hotel_image()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    -- Set all other images for this hotel to non-primary
    UPDATE hotel_images 
    SET is_primary = false 
    WHERE hotel_id = NEW.hotel_id 
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_hotel_img
BEFORE INSERT OR UPDATE ON hotel_images
FOR EACH ROW
WHEN (NEW.is_primary = true)
EXECUTE FUNCTION ensure_single_primary_hotel_image();

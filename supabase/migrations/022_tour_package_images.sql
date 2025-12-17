-- Create table for multiple tour package images
CREATE TABLE IF NOT EXISTS tour_package_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_package_id UUID NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  caption VARCHAR(255),
  display_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_package_images_package ON tour_package_images(tour_package_id);
CREATE INDEX IF NOT EXISTS idx_tour_package_images_primary ON tour_package_images(tour_package_id, is_primary);

-- Add trigger to update updated_at
CREATE TRIGGER update_tour_package_images_updated_at 
BEFORE UPDATE ON tour_package_images 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one primary image per package
CREATE OR REPLACE FUNCTION ensure_single_primary_image()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    -- Set all other images for this package to non-primary
    UPDATE tour_package_images 
    SET is_primary = false 
    WHERE tour_package_id = NEW.tour_package_id 
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_tour_image
BEFORE INSERT OR UPDATE ON tour_package_images
FOR EACH ROW
WHEN (NEW.is_primary = true)
EXECUTE FUNCTION ensure_single_primary_image();

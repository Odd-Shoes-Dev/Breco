-- Restore hotel_images table dropped during the Neon rewrite.
-- Original definition: supabase/migrations/023_hotel_images.sql
-- Referenced by /api/hotels/[id] (hotel detail GET, used by the hotels dashboard page).

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

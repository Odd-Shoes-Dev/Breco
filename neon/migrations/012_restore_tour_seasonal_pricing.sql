-- Restore tour_seasonal_pricing table dropped during the Neon rewrite.
-- Original definition: supabase/migrations/020_breco_safaris_transform.sql
-- Referenced by /api/tours/[id] (tour detail GET) and /api/tours/[id]/seasonal-pricing.

CREATE TABLE IF NOT EXISTS tour_seasonal_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_package_id UUID NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  season_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_adjustment_percent DECIMAL(5,2) DEFAULT 0,
  price_adjustment_fixed_usd DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_season_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_tour_seasonal_pricing_package ON tour_seasonal_pricing(tour_package_id);

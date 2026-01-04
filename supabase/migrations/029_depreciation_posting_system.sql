-- Depreciation Posting System
-- Migration: 029_depreciation_posting_system.sql

-- Create depreciation postings table (master record for each posting batch)
CREATE TABLE depreciation_postings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  posting_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_depreciation DECIMAL(15,2) NOT NULL DEFAULT 0,
  assets_count INTEGER NOT NULL DEFAULT 0,
  journal_entry_id UUID REFERENCES journal_entries(id),
  status VARCHAR(20) DEFAULT 'posted' CHECK (status IN ('posted', 'void')),
  notes TEXT,
  posted_by UUID NOT NULL REFERENCES user_profiles(id),
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  voided_by UUID REFERENCES user_profiles(id),
  voided_at TIMESTAMPTZ
);

-- Create depreciation posting details (individual asset depreciation)
CREATE TABLE depreciation_posting_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  posting_id UUID NOT NULL REFERENCES depreciation_postings(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  depreciation_amount DECIMAL(15,2) NOT NULL,
  accumulated_before DECIMAL(15,2) NOT NULL,
  accumulated_after DECIMAL(15,2) NOT NULL,
  book_value_before DECIMAL(15,2) NOT NULL,
  book_value_after DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_depreciation_postings_date ON depreciation_postings(posting_date);
CREATE INDEX idx_depreciation_postings_period ON depreciation_postings(period_start, period_end);
CREATE INDEX idx_depreciation_postings_status ON depreciation_postings(status);
CREATE INDEX idx_depreciation_posting_details_posting ON depreciation_posting_details(posting_id);
CREATE INDEX idx_depreciation_posting_details_asset ON depreciation_posting_details(asset_id);

-- Function to update asset accumulated depreciation and book value
CREATE OR REPLACE FUNCTION update_asset_depreciation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update asset with new accumulated depreciation and book value
    UPDATE fixed_assets
    SET 
      accumulated_depreciation = NEW.accumulated_after,
      book_value = NEW.book_value_after,
      updated_at = NOW()
    WHERE id = NEW.asset_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Reverse the depreciation (when posting is voided)
    UPDATE fixed_assets
    SET 
      accumulated_depreciation = OLD.accumulated_before,
      book_value = OLD.book_value_before,
      updated_at = NOW()
    WHERE id = OLD.asset_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update assets when depreciation is posted or voided
DROP TRIGGER IF EXISTS trg_update_asset_depreciation ON depreciation_posting_details;
CREATE TRIGGER trg_update_asset_depreciation
AFTER INSERT OR DELETE ON depreciation_posting_details
FOR EACH ROW
EXECUTE FUNCTION update_asset_depreciation();

-- Function to prevent duplicate postings for same period
CREATE OR REPLACE FUNCTION check_duplicate_depreciation_posting()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_existing_count
  FROM depreciation_postings
  WHERE period_start = NEW.period_start
    AND period_end = NEW.period_end
    AND status = 'posted'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
  
  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'Depreciation has already been posted for period % to %', 
      NEW.period_start, NEW.period_end;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check for duplicate postings
DROP TRIGGER IF EXISTS trg_check_duplicate_depreciation_posting ON depreciation_postings;
CREATE TRIGGER trg_check_duplicate_depreciation_posting
BEFORE INSERT OR UPDATE ON depreciation_postings
FOR EACH ROW
WHEN (NEW.status = 'posted')
EXECUTE FUNCTION check_duplicate_depreciation_posting();

-- Add comments
COMMENT ON TABLE depreciation_postings IS 'Batch depreciation posting records';
COMMENT ON TABLE depreciation_posting_details IS 'Individual asset depreciation amounts in each posting';
COMMENT ON COLUMN depreciation_postings.posting_date IS 'Date depreciation was posted to books';
COMMENT ON COLUMN depreciation_postings.period_start IS 'Start date of depreciation period';
COMMENT ON COLUMN depreciation_postings.period_end IS 'End date of depreciation period';
COMMENT ON COLUMN depreciation_postings.total_depreciation IS 'Total depreciation expense for all assets';
COMMENT ON COLUMN depreciation_postings.assets_count IS 'Number of assets included in posting';
COMMENT ON COLUMN depreciation_posting_details.accumulated_before IS 'Accumulated depreciation before this posting';
COMMENT ON COLUMN depreciation_posting_details.accumulated_after IS 'Accumulated depreciation after this posting';
COMMENT ON COLUMN depreciation_posting_details.book_value_before IS 'Book value before depreciation';
COMMENT ON COLUMN depreciation_posting_details.book_value_after IS 'Book value after depreciation';

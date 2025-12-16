-- Add scheduled reports functionality
-- This migration adds support for scheduling automatic report generation and delivery

CREATE TYPE report_format AS ENUM ('pdf', 'excel', 'csv');
CREATE TYPE schedule_frequency AS ENUM ('daily', 'weekly', 'monthly', 'quarterly');

CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type VARCHAR(100) NOT NULL,
  report_name VARCHAR(255) NOT NULL,
  
  -- Schedule configuration
  frequency schedule_frequency NOT NULL DEFAULT 'monthly',
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
  month_of_quarter INTEGER CHECK (month_of_quarter >= 1 AND month_of_quarter <= 3),
  time_of_day TIME NOT NULL DEFAULT '09:00:00',
  
  -- Email settings
  recipients TEXT[] NOT NULL,
  format report_format NOT NULL DEFAULT 'pdf',
  
  -- Report parameters (stored as JSONB for flexibility)
  parameters JSONB DEFAULT '{}',
  
  -- Status and tracking
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_run TIMESTAMP WITH TIME ZONE NOT NULL,
  last_run TIMESTAMP WITH TIME ZONE,
  run_count INTEGER NOT NULL DEFAULT 0,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_weekly_schedule CHECK (
    frequency != 'weekly' OR day_of_week IS NOT NULL
  ),
  CONSTRAINT valid_monthly_schedule CHECK (
    frequency != 'monthly' OR day_of_month IS NOT NULL
  ),
  CONSTRAINT valid_quarterly_schedule CHECK (
    frequency != 'quarterly' OR month_of_quarter IS NOT NULL
  ),
  CONSTRAINT recipients_not_empty CHECK (array_length(recipients, 1) > 0)
);

-- Create indexes for efficient querying
CREATE INDEX idx_scheduled_reports_user_id ON scheduled_reports(user_id);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run) WHERE is_active = true;
CREATE INDEX idx_scheduled_reports_report_type ON scheduled_reports(report_type);
CREATE INDEX idx_scheduled_reports_active ON scheduled_reports(is_active);

-- Create a function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_scheduled_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating updated_at
CREATE TRIGGER trigger_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_reports_updated_at();

-- Function to calculate next run time based on frequency
CREATE OR REPLACE FUNCTION calculate_next_run(
  p_frequency schedule_frequency,
  p_day_of_week INTEGER DEFAULT NULL,
  p_day_of_month INTEGER DEFAULT NULL,
  p_month_of_quarter INTEGER DEFAULT NULL,
  p_time_of_day TIME DEFAULT '09:00:00',
  p_from_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  next_run TIMESTAMP WITH TIME ZONE;
  base_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Start from the provided date
  base_date := p_from_date;
  
  CASE p_frequency
    WHEN 'daily' THEN
      next_run := date_trunc('day', base_date) + p_time_of_day;
      IF next_run <= base_date THEN
        next_run := next_run + INTERVAL '1 day';
      END IF;
      
    WHEN 'weekly' THEN
      -- Find the next occurrence of the specified day of week
      next_run := date_trunc('week', base_date) + 
                  (p_day_of_week * INTERVAL '1 day') + 
                  p_time_of_day;
      
      -- If we've passed this week's occurrence, move to next week
      IF next_run <= base_date THEN
        next_run := next_run + INTERVAL '1 week';
      END IF;
      
    WHEN 'monthly' THEN
      -- Set to the specified day of the current month
      next_run := date_trunc('month', base_date) + 
                  ((p_day_of_month - 1) * INTERVAL '1 day') + 
                  p_time_of_day;
      
      -- If we've passed this month's occurrence, move to next month
      IF next_run <= base_date THEN
        next_run := (date_trunc('month', base_date) + INTERVAL '1 month') + 
                    ((p_day_of_month - 1) * INTERVAL '1 day') + 
                    p_time_of_day;
      END IF;
      
    WHEN 'quarterly' THEN
      -- Find the current quarter and set to the specified month within that quarter
      DECLARE
        current_quarter INTEGER;
        quarter_start_month INTEGER;
        target_month INTEGER;
      BEGIN
        current_quarter := EXTRACT(quarter FROM base_date);
        quarter_start_month := (current_quarter - 1) * 3 + 1;
        target_month := quarter_start_month + (p_month_of_quarter - 1);
        
        next_run := make_date(
          EXTRACT(year FROM base_date)::INTEGER,
          target_month,
          1
        )::TIMESTAMP WITH TIME ZONE + p_time_of_day;
        
        -- If we've passed this quarter's occurrence, move to next quarter
        IF next_run <= base_date THEN
          next_run := next_run + INTERVAL '3 months';
        END IF;
      END;
  END CASE;
  
  RETURN next_run;
END;
$$ LANGUAGE plpgsql;

-- Function to update next_run when schedule parameters change
CREATE OR REPLACE FUNCTION update_next_run_on_schedule_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only recalculate if scheduling parameters changed
  IF (OLD.frequency != NEW.frequency OR 
      OLD.day_of_week IS DISTINCT FROM NEW.day_of_week OR
      OLD.day_of_month IS DISTINCT FROM NEW.day_of_month OR
      OLD.month_of_quarter IS DISTINCT FROM NEW.month_of_quarter OR
      OLD.time_of_day != NEW.time_of_day) THEN
    
    NEW.next_run := calculate_next_run(
      NEW.frequency,
      NEW.day_of_week,
      NEW.day_of_month,
      NEW.month_of_quarter,
      NEW.time_of_day
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic next_run calculation
CREATE TRIGGER trigger_update_next_run
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_next_run_on_schedule_change();

-- Insert sample data
INSERT INTO scheduled_reports (
  report_type,
  report_name,
  frequency,
  day_of_month,
  day_of_week,
  time_of_day,
  recipients,
  format,
  parameters,
  next_run
) VALUES 
(
  'profit-loss',
  'Monthly P&L Statement',
  'monthly',
  1, -- 1st of month
  NULL,
  '09:00:00',
  ARRAY['admin@brecosafaris.com', 'accounts@brecosafaris.com'],
  'pdf',
  '{}',
  calculate_next_run('monthly', NULL, 1, NULL, '09:00:00')
),
(
  'sales-by-customer',
  'Weekly Sales Analysis',
  'weekly',
  NULL,
  1, -- Monday (0=Sunday, 1=Monday)
  '08:30:00',
  ARRAY['operations@brecosafaris.com'],
  'excel',
  '{"sortBy": "totalSales", "customerType": "all"}',
  calculate_next_run('weekly', 1, NULL, NULL, '08:30:00')
);

-- Create RLS policies
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Policy for users to manage their own scheduled reports
CREATE POLICY scheduled_reports_user_policy ON scheduled_reports
  FOR ALL USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON scheduled_reports TO authenticated;
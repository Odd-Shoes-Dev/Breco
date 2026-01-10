-- Migration 036: Seed Fiscal Periods for 2025 and 2026
-- Creates years, quarters, and months for proper period locking

-- 2025 Year
INSERT INTO fiscal_periods (name, level, start_date, end_date, status)
VALUES ('FY 2025', 'annual', '2025-01-01', '2025-12-31', 'open')
ON CONFLICT DO NOTHING;

-- 2025 Quarters
INSERT INTO fiscal_periods (name, level, start_date, end_date, status)
VALUES 
  ('Q1 2025', 'quarterly', '2025-01-01', '2025-03-31', 'open'),
  ('Q2 2025', 'quarterly', '2025-04-01', '2025-06-30', 'open'),
  ('Q3 2025', 'quarterly', '2025-07-01', '2025-09-30', 'open'),
  ('Q4 2025', 'quarterly', '2025-10-01', '2025-12-31', 'open')
ON CONFLICT DO NOTHING;

-- 2025 Months
INSERT INTO fiscal_periods (name, level, start_date, end_date, status)
VALUES 
  ('Jan 2025', 'monthly', '2025-01-01', '2025-01-31', 'open'),
  ('Feb 2025', 'monthly', '2025-02-01', '2025-02-28', 'open'),
  ('Mar 2025', 'monthly', '2025-03-01', '2025-03-31', 'open'),
  ('Apr 2025', 'monthly', '2025-04-01', '2025-04-30', 'open'),
  ('May 2025', 'monthly', '2025-05-01', '2025-05-31', 'open'),
  ('Jun 2025', 'monthly', '2025-06-01', '2025-06-30', 'open'),
  ('Jul 2025', 'monthly', '2025-07-01', '2025-07-31', 'open'),
  ('Aug 2025', 'monthly', '2025-08-01', '2025-08-31', 'open'),
  ('Sep 2025', 'monthly', '2025-09-01', '2025-09-30', 'open'),
  ('Oct 2025', 'monthly', '2025-10-01', '2025-10-31', 'open'),
  ('Nov 2025', 'monthly', '2025-11-01', '2025-11-30', 'open'),
  ('Dec 2025', 'monthly', '2025-12-01', '2025-12-31', 'open')
ON CONFLICT DO NOTHING;

-- 2026 Year
INSERT INTO fiscal_periods (name, level, start_date, end_date, status)
VALUES ('FY 2026', 'annual', '2026-01-01', '2026-12-31', 'open')
ON CONFLICT DO NOTHING;

-- 2026 Quarters
INSERT INTO fiscal_periods (name, level, start_date, end_date, status)
VALUES 
  ('Q1 2026', 'quarterly', '2026-01-01', '2026-03-31', 'open'),
  ('Q2 2026', 'quarterly', '2026-04-01', '2026-06-30', 'open'),
  ('Q3 2026', 'quarterly', '2026-07-01', '2026-09-30', 'open'),
  ('Q4 2026', 'quarterly', '2026-10-01', '2026-12-31', 'open')
ON CONFLICT DO NOTHING;

-- 2026 Months
INSERT INTO fiscal_periods (name, level, start_date, end_date, status)
VALUES 
  ('Jan 2026', 'monthly', '2026-01-01', '2026-01-31', 'open'),
  ('Feb 2026', 'monthly', '2026-02-01', '2026-02-28', 'open'),
  ('Mar 2026', 'monthly', '2026-03-01', '2026-03-31', 'open'),
  ('Apr 2026', 'monthly', '2026-04-01', '2026-04-30', 'open'),
  ('May 2026', 'monthly', '2026-05-01', '2026-05-31', 'open'),
  ('Jun 2026', 'monthly', '2026-06-01', '2026-06-30', 'open'),
  ('Jul 2026', 'monthly', '2026-07-01', '2026-07-31', 'open'),
  ('Aug 2026', 'monthly', '2026-08-01', '2026-08-31', 'open'),
  ('Sep 2026', 'monthly', '2026-09-01', '2026-09-30', 'open'),
  ('Oct 2026', 'monthly', '2026-10-01', '2026-10-31', 'open'),
  ('Nov 2026', 'monthly', '2026-11-01', '2026-11-30', 'open'),
  ('Dec 2026', 'monthly', '2026-12-01', '2026-12-31', 'open')
ON CONFLICT DO NOTHING;

-- Add comment
COMMENT ON TABLE fiscal_periods IS 'Fiscal periods for period locking - prevents modification of historical financial data';

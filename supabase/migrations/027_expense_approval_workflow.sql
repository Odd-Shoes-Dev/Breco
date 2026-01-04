-- Add expense approval tracking fields
ALTER TABLE expenses
ADD COLUMN approved_by UUID REFERENCES user_profiles(id),
ADD COLUMN approved_at TIMESTAMPTZ,
ADD COLUMN rejected_by UUID REFERENCES user_profiles(id),
ADD COLUMN rejected_at TIMESTAMPTZ,
ADD COLUMN rejection_reason TEXT,
ADD COLUMN paid_by UUID REFERENCES user_profiles(id),
ADD COLUMN paid_at TIMESTAMPTZ;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_approved_by ON expenses(approved_by);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_approval_date ON expenses(approved_at);

-- Add comment
COMMENT ON COLUMN expenses.approved_by IS 'User who approved the expense';
COMMENT ON COLUMN expenses.approved_at IS 'Timestamp when expense was approved';
COMMENT ON COLUMN expenses.rejected_by IS 'User who rejected the expense';
COMMENT ON COLUMN expenses.rejected_at IS 'Timestamp when expense was rejected';
COMMENT ON COLUMN expenses.rejection_reason IS 'Reason for rejecting the expense';
COMMENT ON COLUMN expenses.paid_by IS 'User who marked expense as paid';
COMMENT ON COLUMN expenses.paid_at IS 'Timestamp when expense was marked as paid';

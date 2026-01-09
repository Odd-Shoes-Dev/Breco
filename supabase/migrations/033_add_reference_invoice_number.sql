-- Add reference_invoice_number column to invoices table for receipts
-- This allows receipts to reference the invoice they are paying

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS reference_invoice_number VARCHAR(50);

-- Add index for faster lookups when searching by reference invoice
CREATE INDEX IF NOT EXISTS idx_invoices_reference_invoice_number 
ON invoices(reference_invoice_number) 
WHERE document_type = 'receipt';

-- Add comment explaining the column
COMMENT ON COLUMN invoices.reference_invoice_number IS 'For receipts: references the invoice number being paid (can be system invoice or external)';

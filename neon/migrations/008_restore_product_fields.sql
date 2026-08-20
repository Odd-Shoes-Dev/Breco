-- =====================================================
-- Restore product fields dropped during the Supabase -> Neon migration
-- but still relied on by the inventory UI: currency, product_type,
-- quantity_reserved, reorder_quantity, tax_rate.
-- quantity_on_hand stays computed from inventory_movements (Neon design),
-- quantity_available is derived in application code as on_hand - reserved.
-- =====================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD';
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type VARCHAR(50) DEFAULT 'inventory';
ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity_reserved DECIMAL(15,4) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_quantity DECIMAL(15,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,4);

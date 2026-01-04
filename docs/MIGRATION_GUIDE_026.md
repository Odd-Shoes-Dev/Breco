# Migration Guide: Inventory & Booking Tracking

## Prerequisites
- Backup your database before running migrations
- Ensure you have Supabase CLI installed
- Test in development environment first

## Step 1: Apply Database Migration

```bash
# Navigate to project directory
cd c:\Users\HP\Desktop\Breco

# Apply the new migration
supabase db push

# Or if using remote database
supabase db push --db-url YOUR_DATABASE_URL
```

The migration will:
- Add capacity columns to `tour_packages` table
- Add booking tracking columns to `bookings` table
- Create triggers for automatic capacity management
- Create `check_tour_availability()` function
- Set default capacity (20) for existing tour packages

## Step 2: Verify Migration

Run these SQL queries to verify:

```sql
-- Check tour_packages has new columns
SELECT 
  id, name, max_capacity, available_slots, slots_reserved 
FROM tour_packages 
LIMIT 5;

-- Check bookings has new columns
SELECT 
  id, booking_number, number_of_people, booking_confirmed_at 
FROM bookings 
LIMIT 5;

-- Verify triggers exist
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE trigger_name IN ('booking_availability_trigger', 'booking_insert_trigger');

-- Test availability function
SELECT check_tour_availability(
  (SELECT id FROM tour_packages LIMIT 1),
  5
);
```

## Step 3: Deploy Code Changes

The following files have been updated and need to be deployed:

### New Files:
- `src/lib/accounting/inventory-server.ts`
- `docs/INVENTORY_BOOKING_IMPLEMENTATION.md`
- `supabase/migrations/026_tour_capacity_tracking.sql`

### Updated Files:
- `src/app/api/invoices/route.ts`
- `src/app/api/invoices/[id]/route.ts`
- `src/app/api/bills/route.ts`
- `src/app/api/bills/[id]/route.ts`
- `src/app/api/bookings/route.ts`
- `src/app/api/bookings/[id]/route.ts`
- `src/types/breco.ts`

### Deploy:
```bash
# Build the application
npm run build

# Deploy to production (adjust based on your deployment method)
# For Vercel:
vercel --prod

# Or push to Git and let CI/CD handle it
git add .
git commit -m "Implement comprehensive inventory and booking tracking"
git push
```

## Step 4: Post-Deployment Verification

### Test Inventory Tracking:

1. **Test Product Purchase (Bill):**
   - Create a bill with products
   - Approve the bill
   - Check product quantity increased in database
   - Verify inventory movement created
   - Verify journal entry created

2. **Test Product Sale (Invoice):**
   - Create an invoice with products
   - Post the invoice
   - Check product quantity decreased
   - Verify inventory movement created
   - Verify journal entry created

3. **Test Quotation Reservation:**
   - Create a quotation
   - Check quantity_reserved increased
   - Delete the quotation
   - Verify quantity_reserved decreased

4. **Test Invoice Void:**
   - Post an invoice
   - Void the invoice
   - Verify quantity restored

### Test Booking Availability:

1. **Test Tour Capacity:**
   - Update a tour package: Set max_capacity=5, available_slots=5
   - Create confirmed booking for 3 people
   - Verify available_slots=2
   - Try to book 4 more people → Should fail

2. **Test Cancellation:**
   - Cancel the booking
   - Verify available_slots=5 (restored)

3. **Test Status Changes:**
   - Create pending booking (no capacity change)
   - Change to confirmed (capacity should reduce)
   - Change to cancelled (capacity should restore)

## Step 5: Update Tour Packages

After migration, you should review and set appropriate capacity for each tour:

```sql
-- Update specific tour packages with realistic capacity
UPDATE tour_packages 
SET 
  max_capacity = 12,
  available_slots = 12
WHERE package_code = 'PKG-001';

-- For small group tours
UPDATE tour_packages 
SET 
  max_capacity = 6,
  available_slots = 6
WHERE tour_type = 'private';

-- For larger group tours
UPDATE tour_packages 
SET 
  max_capacity = 25,
  available_slots = 25
WHERE tour_type = 'group';
```

## Step 6: Monitor and Adjust

### Monitor These Metrics:
1. Inventory movement frequency
2. Negative inventory incidents
3. Booking rejections due to capacity
4. Journal entry creation success rate

### Check Logs:
```bash
# Check for inventory errors
grep "Failed to update inventory" /var/log/app.log

# Check for booking availability errors
grep "Insufficient availability" /var/log/app.log
```

## Troubleshooting

### Issue: Negative Inventory
**Symptom:** Products show negative quantity_on_hand

**Solution:**
```sql
-- Find products with negative inventory
SELECT id, name, sku, quantity_on_hand 
FROM products 
WHERE quantity_on_hand < 0;

-- Adjust manually
UPDATE products 
SET quantity_on_hand = 0 
WHERE quantity_on_hand < 0;

-- Then investigate why it happened
SELECT * FROM inventory_movements 
WHERE product_id = 'PROBLEM_PRODUCT_ID' 
ORDER BY created_at DESC 
LIMIT 20;
```

### Issue: Tour Package Overbooked
**Symptom:** available_slots is negative

**Solution:**
```sql
-- Find overbooked tours
SELECT id, name, max_capacity, available_slots, slots_reserved 
FROM tour_packages 
WHERE available_slots < 0;

-- Reset capacity (adjust numbers as needed)
UPDATE tour_packages 
SET 
  available_slots = max_capacity - slots_reserved,
  slots_reserved = (
    SELECT COUNT(*) * COALESCE(number_of_people, 1)
    FROM bookings 
    WHERE tour_package_id = tour_packages.id 
    AND status = 'confirmed'
  )
WHERE available_slots < 0;
```

### Issue: Inventory Not Updating
**Check:**
1. Product has `track_inventory = true`
2. Invoice/Bill status is 'posted' or 'approved'
3. Check server logs for errors
4. Verify user permissions

### Issue: Journal Entries Not Created
**Check:**
1. Account codes exist (1200 for AR, 2000 for AP, etc.)
2. User is authenticated
3. Check `journal_entries` table for errors
4. Verify RPC function `generate_journal_entry_number` exists

## Rollback Procedure

If you need to rollback:

### 1. Revert Code:
```bash
git revert HEAD
git push
```

### 2. Revert Database (if necessary):
```sql
-- Remove triggers
DROP TRIGGER IF EXISTS booking_availability_trigger ON bookings;
DROP TRIGGER IF EXISTS booking_insert_trigger ON bookings;

-- Remove function
DROP FUNCTION IF EXISTS update_tour_availability();
DROP FUNCTION IF EXISTS check_tour_availability(UUID, INTEGER);

-- Remove columns (optional - data will be lost)
ALTER TABLE tour_packages 
DROP COLUMN IF EXISTS max_capacity,
DROP COLUMN IF EXISTS available_slots,
DROP COLUMN IF EXISTS slots_reserved;

ALTER TABLE bookings
DROP COLUMN IF EXISTS number_of_people,
DROP COLUMN IF EXISTS booking_confirmed_at,
DROP COLUMN IF EXISTS cancellation_date,
DROP COLUMN IF EXISTS cancellation_reason;
```

## Support

For issues or questions:
1. Check the implementation documentation: `docs/INVENTORY_BOOKING_IMPLEMENTATION.md`
2. Review error logs
3. Test in development environment first
4. Create a backup before making changes

## Success Criteria

✅ Migration runs without errors  
✅ All API routes return 200/201 for valid requests  
✅ Inventory reduces when invoices posted  
✅ Inventory increases when bills approved  
✅ Quotations reserve inventory  
✅ Bookings reduce tour capacity  
✅ Cancellations restore capacity  
✅ Cannot overbook tours  
✅ Cannot oversell products  
✅ Journal entries created automatically  

---

**Last Updated:** 2024  
**Migration Version:** 026

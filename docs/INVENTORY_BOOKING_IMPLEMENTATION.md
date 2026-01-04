# Inventory and Booking Tracking Implementation

## Overview
This document summarizes the comprehensive inventory tracking and booking availability system implementation for Breco Safaris Ltd.

## Changes Implemented

### 1. Server-Side Inventory Management (`src/lib/accounting/inventory-server.ts`)
Created new helper library for server-side inventory operations:

#### Functions Implemented:
- **`reduceInventoryForInvoice()`**: Reduces inventory when invoices are posted/sent
  - Checks `track_inventory` flag on products
  - Validates sufficient inventory available
  - Updates `quantity_on_hand`
  - Records inventory movements with `movement_type='sale'`
  
- **`reserveInventoryForQuotation()`**: Reserves inventory for quotations/proformas
  - Updates `quantity_reserved` field
  - Checks availability before reservation
  - Records movement with `movement_type='reserved'`
  
- **`releaseReservedInventory()`**: Releases reserved inventory
  - Called when quotations expire or are cancelled
  - Reduces `quantity_reserved` back to available pool
  
- **`increaseInventoryForBill()`**: Increases inventory when bills are approved
  - Updates `quantity_on_hand` with purchased quantity
  - Calculates weighted average cost
  - Creates inventory lots for FIFO tracking
  - Records movement with `movement_type='purchase'`
  
- **`restoreInventoryForInvoice()`**: Restores inventory when invoices are voided
  - Adds quantity back to `quantity_on_hand`
  - Records movement with `movement_type='return'`

### 2. Invoice API Updates (`src/app/api/invoices/route.ts`)
**POST Method Enhancement:**
- Added inventory imports
- Implemented inventory handling based on document type:
  - **Quotations/Proformas**: Reserve inventory on creation
  - **Invoices (posted/sent)**: Reduce inventory immediately
- Rollback invoice creation if inventory insufficient
- Return clear error messages about stock availability

### 3. Invoice Detail API Updates (`src/app/api/invoices/[id]/route.ts`)
**PATCH Method Enhancement:**
- Get existing invoice with lines for status comparison
- Handle status change scenarios:
  - **Draft → Sent/Posted**: Reduce inventory for regular invoices
  - **Quotation/Proforma → Posted**: Release reservation, then reduce actual inventory
  - Validate sufficient inventory before status change
- Use `createInvoiceJournalEntry()` helper for journal entries
- Update journal entry reference on invoice

**DELETE Method Enhancement:**
- Get invoice with lines before deletion
- **Delete (draft only)**: Release reservations for quotations/proformas
- **Void**: Restore inventory for posted/sent invoices
- Ensure inventory is properly restored to prevent stock discrepancies

### 4. Bill API Updates (`src/app/api/bills/route.ts`)
**POST Method Enhancement:**
- Import `increaseInventoryForBill()` function
- Call inventory increase for posted/approved bills
- Update inventory with bill lines including:
  - Product ID
  - Quantity received
  - Unit cost
  - Line total
  - Description
- Log errors but don't fail bill creation for inventory issues
- Create journal entries after inventory update

### 5. Bill Detail API Updates (`src/app/api/bills/[id]/route.ts`)
**PATCH Method Enhancement:**
- Get existing bill with lines for status tracking
- Track status changes (draft → approved/posted)
- Call `increaseInventoryForBill()` when status changes to approved/posted
- Use `createBillJournalEntry()` for journal entries
- Update journal entry reference on bill
- Handle both new lines and existing lines properly

### 6. Database Migration: Tour Capacity Tracking (`supabase/migrations/026_tour_capacity_tracking.sql`)
**Schema Changes:**
```sql
ALTER TABLE tour_packages ADD COLUMN:
- max_capacity INTEGER
- available_slots INTEGER
- slots_reserved INTEGER

ALTER TABLE bookings ADD COLUMN:
- number_of_people INTEGER
- booking_confirmed_at TIMESTAMPTZ
- cancellation_date TIMESTAMPTZ
- cancellation_reason TEXT
```

**Triggers Created:**
- **`update_tour_availability()`**: Function to handle capacity updates
  - Reduces `available_slots` when booking confirmed
  - Increases `slots_reserved` when booking confirmed
  - Restores `available_slots` when booking cancelled
  - Reduces `slots_reserved` when booking cancelled
  - Sets confirmation/cancellation timestamps

- **`booking_availability_trigger`**: Executes on booking status UPDATE
- **`booking_insert_trigger`**: Executes on booking INSERT (if status=confirmed)

**Helper Functions:**
- **`check_tour_availability(p_tour_package_id, p_number_of_people)`**: 
  - Returns boolean indicating if tour has enough slots
  - Used for validation before booking

**Constraints:**
- `CHECK (available_slots >= 0)`: Prevents overbooking

**Data Migration:**
- Set default capacity of 20 for existing tour packages

### 7. Booking API Updates (`src/app/api/bookings/route.ts`)
**POST Method Enhancement:**
- Check tour package availability before creating confirmed bookings
- Call `check_tour_availability()` RPC function
- Return error if insufficient slots available
- Include `number_of_people` in booking creation (default: 1)
- Trigger automatically updates tour package availability

### 8. Booking Detail API Updates (`src/app/api/bookings\[id]\route.ts`)
**PATCH Method Enhancement:**
- Get existing booking for status comparison
- Check availability when changing status to 'confirmed'
- Validate sufficient slots before allowing status change
- Return clear error message if insufficient availability
- Trigger handles actual slot reduction/restoration

### 9. TypeScript Type Updates (`src/types/breco.ts`)
**TourPackage Interface:**
```typescript
interface TourPackage {
  // ... existing fields
  max_capacity: number;
  available_slots: number;
  slots_reserved: number;
}
```

**Booking Interface:**
```typescript
interface Booking {
  // ... existing fields
  number_of_people: number;
  booking_confirmed_at: string | null;
  cancellation_date: string | null;
  cancellation_reason: string | null;
}
```

## Inventory Tracking Workflow

### Purchase Flow (Bills)
1. Bill created with status 'draft' → No inventory change
2. Bill approved/posted → `increaseInventoryForBill()` called
3. System updates:
   - Increases `quantity_on_hand`
   - Calculates new weighted average `cost_price`
   - Creates inventory movement record
   - Creates inventory lot for FIFO tracking
4. Journal entry created for expense recognition

### Sales Flow (Invoices)
1. **Regular Invoice:**
   - Draft → No inventory change
   - Sent/Posted → `reduceInventoryForInvoice()` called
   - Reduces `quantity_on_hand`
   - Creates sale movement record
   - Creates journal entry for revenue recognition

2. **Quotation/Proforma:**
   - Created → `reserveInventoryForQuotation()` called
   - Increases `quantity_reserved`
   - Creates reservation movement
   - Conversion to invoice → Release reservation, reduce actual inventory

3. **Invoice Void:**
   - `restoreInventoryForInvoice()` called
   - Adds quantity back to `quantity_on_hand`
   - Records return movement

### Booking Flow (Tours)
1. **Booking Created:**
   - Status = 'pending' → No capacity change
   - Status = 'confirmed' → Trigger updates tour package:
     - Reduces `available_slots`
     - Increases `slots_reserved`
     - Sets `booking_confirmed_at`

2. **Booking Status Change:**
   - Pending → Confirmed → Check availability first, then reduce slots
   - Confirmed → Cancelled → Restore `available_slots`, reduce `slots_reserved`

3. **Availability Check:**
   - Before confirmation: Call `check_tour_availability()`
   - Returns false if `available_slots < number_of_people`
   - Prevents overbooking

## Key Features

### Inventory Management
✅ **Automatic inventory reduction** on invoice posting
✅ **Automatic inventory increase** on bill approval
✅ **Reservation system** for quotations and proformas
✅ **Inventory restoration** when invoices are voided
✅ **Weighted average costing** for purchases
✅ **FIFO lot tracking** for cost of goods sold
✅ **Movement history** for all inventory changes
✅ **Validation** to prevent overselling

### Booking Management
✅ **Capacity tracking** for tour packages
✅ **Availability checking** before confirmation
✅ **Automatic slot management** via database triggers
✅ **Overbooking prevention** with check constraints
✅ **Cancellation handling** with slot restoration
✅ **Confirmation timestamps** for audit trail

### Integration Points
✅ **Journal entries** created automatically
✅ **Balance updates** via existing triggers
✅ **Error handling** with proper rollbacks
✅ **Clear error messages** for user feedback
✅ **Logging** for troubleshooting

## Testing Recommendations

### Inventory Testing
1. Create product with `track_inventory=true`
2. Create bill (approved) → Verify quantity increases
3. Create invoice (posted) → Verify quantity decreases
4. Create quotation → Verify reservation
5. Void invoice → Verify quantity restoration
6. Try to sell more than available → Verify error

### Booking Testing
1. Set tour package capacity to 5
2. Create confirmed booking for 3 people → Verify slots = 2
3. Create pending booking → Verify no slot change
4. Confirm pending booking for 3 people → Verify error (insufficient slots)
5. Cancel first booking → Verify slots restored to 5
6. Try to book 6 people → Verify error

### Edge Cases
- Editing invoice lines after posting
- Changing invoice status multiple times
- Concurrent bookings for same tour
- Bill approval with missing product IDs
- Products with `track_inventory=false`

## Migration Steps

1. **Apply database migration:**
   ```bash
   # Run migration 026
   supabase db push
   ```

2. **Verify schema changes:**
   - Check tour_packages has capacity columns
   - Check bookings has new columns
   - Verify triggers exist
   - Test RPC functions

3. **Deploy code changes:**
   - Deploy all API route updates
   - Deploy inventory server functions
   - Deploy type updates

4. **Data verification:**
   - Check existing tour packages have capacity set
   - Verify no negative inventory quantities
   - Check inventory movements are being recorded

## Rollback Plan

If issues occur:
1. Revert API route changes (invoices, bills, bookings)
2. Remove inventory-server.ts imports
3. Keep migration (capacity tracking is beneficial even without full automation)
4. Manually manage inventory until issues resolved

## Benefits

### For Operations
- Real-time inventory visibility
- Prevents overselling products
- Prevents overbooking tours
- Accurate availability information

### For Accounting
- Automatic journal entries
- Proper FIFO costing
- Weighted average cost calculation
- Complete audit trail

### For Management
- Accurate financial reports
- Better demand planning
- Reduced manual errors
- Improved customer satisfaction

## Future Enhancements

Potential improvements:
1. Inventory low-stock alerts
2. Automatic reorder points
3. Inventory valuation reports
4. Tour package seasonal capacity variations
5. Partial booking confirmations
6. Waitlist management for fully booked tours
7. Batch inventory adjustments
8. Integration with supplier portals

---

**Implementation Date:** 2024
**Status:** ✅ Complete
**Documentation Version:** 1.0

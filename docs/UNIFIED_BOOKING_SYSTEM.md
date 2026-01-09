# Unified Booking System Implementation Plan

## Overview
The bookings module will handle ALL types of bookings in one place:
- **Tour Packages** (safari tours with accommodations, meals, activities)
- **Hotels Only** (standalone accommodation bookings)
- **Fleet/Car Hire** (vehicle rentals, airport transfers, self-drive)
- **Custom Combinations** (hotel + vehicle, no tour package)

## Database Structure (Migration 034)

### Enhanced Bookings Table
```sql
bookings {
  -- Core fields
  id, booking_number, customer_id, booking_date
  
  -- Booking Type (what are they booking?)
  booking_type: 'tour', 'hotel', 'car_hire', 'custom'
  
  -- References (can have one or multiple)
  tour_package_id → tour_packages  (optional)
  hotel_id → hotels                (optional)
  assigned_vehicle_id → fleet      (optional)
  
  -- Dates (always required)
  travel_start_date, travel_end_date
  
  -- Group details
  num_adults, num_children, num_infants
  
  -- Hotel-specific fields
  room_type: 'Single', 'Double', 'Suite', etc.
  num_rooms: 1, 2, 3, etc.
  
  -- Vehicle-specific fields
  rental_type: 'self_drive', 'with_driver', 'airport_transfer'
  pickup_location, dropoff_location
  
  -- Pricing (handles all booking types)
  subtotal, discount_amount, tax_amount, total
  amount_paid, balance_due, currency, exchange_rate
  
  -- Assignment
  assigned_guide_id (for tours)
  
  -- Status, notes, etc.
}
```

## Booking Form Flow

### Step 1: Select Booking Type
User chooses what they want to book:
```
[ Tour Package ]  [ Hotel Only ]  [ Car Hire ]  [ Custom Combo ]
```

### Step 2: Form Adjusts Based on Type

**A) Tour Package Booking (existing flow)**
- Select customer
- Select tour package → auto-fills duration, price
- Select dates
- Number of travelers
- Special requests
- Calculate total

**B) Hotel Only Booking**
- Select customer
- Select hotel
- Select dates (check-in, check-out)
- Room type (Single, Double, Suite)
- Number of rooms
- Number of guests (adults/children)
- Special requests (early check-in, late checkout)
- Enter rate per night → calculate total

**C) Car Hire Booking**
- Select customer
- Select vehicle from fleet
- Rental type: Self-drive / With driver / Airport transfer
- Select dates (pickup, return)
- Pickup location
- Drop-off location
- Number of days → calculate total
- Driver assignment (if with driver)

**D) Custom Combination**
- Select customer
- Check boxes: [ ] Hotel  [ ] Vehicle
- If hotel: show hotel fields
- If vehicle: show vehicle fields
- Select dates
- Calculate combined total

## Booking List View

### Columns
| Booking # | Type | Customer | Item | Dates | Status | Total | Actions |
|-----------|------|----------|------|-------|--------|-------|---------|
| BK-0001 | 🏔️ Tour | John Smith | 7-Day Safari | Jan 15-22 | Confirmed | $3,500 | View Edit |
| BK-0002 | 🏨 Hotel | Jane Doe | Kampala Serena | Jan 10-12 | Paid | $450 | View Edit |
| BK-0003 | 🚗 Car Hire | Mike Jones | Land Cruiser | Jan 5-10 | In Progress | $800 | View Edit |

### Filters
- Booking Type: All / Tour / Hotel / Car Hire
- Status: All / Inquiry / Confirmed / etc.
- Date range

## Revenue Tracking

Different booking types post to different revenue accounts:

**Tour Package Bookings**
- Revenue Account: 4110 (Safari Packages)

**Hotel Bookings**
- Revenue Account: 4300 (Accommodation Commissions)

**Car Hire Bookings**
- Revenue Account: 4200 (Car Hire Revenue)
- If airport transfer: 4400 (Airport Transfers)

## Invoicing

All booking types can be converted to invoices:

**Tour Package Invoice**
```
Line Items:
- 7-Day Safari Package × 2 travelers @ $1,750 = $3,500
- Gorilla permit × 2 @ $700 = $1,400
Subtotal: $4,900
Tax (18%): $882
Total: $5,782
```

**Hotel Invoice**
```
Line Items:
- Kampala Serena Hotel - Deluxe Room × 3 nights @ $150 = $450
Subtotal: $450
Tax (18%): $81
Total: $531
```

**Car Hire Invoice**
```
Line Items:
- Land Cruiser rental × 5 days @ $160 = $800
- Driver fee × 5 days @ $30 = $150
Subtotal: $950
Tax (18%): $171
Total: $1,121
```

## Advantages of Unified System

✅ **Single entry point** - All bookings in one place
✅ **Consistent workflow** - Same process for all types
✅ **Easier reporting** - One table, one query
✅ **Flexible combinations** - Can mix tour + custom hotel + custom vehicle
✅ **Simpler codebase** - No duplicate logic
✅ **Better customer view** - See all bookings together
✅ **Revenue tracking** - Proper account categorization

## Implementation Steps

1. ✅ **Migration Created** - `034_unified_booking_system.sql`
   - Adds hotel_id, room_type, num_rooms
   - Adds rental_type, pickup/dropoff locations
   - Creates proper foreign keys
   - Adds constraints

2. **Next: Update Booking Form**
   - Add booking type selector at top
   - Show/hide fields based on type
   - Add hotel selection dropdown
   - Add fleet selection dropdown
   - Add hotel-specific fields (room_type, num_rooms)
   - Add vehicle-specific fields (rental_type, locations)

3. **Next: Update Booking List**
   - Show booking type icon/label
   - Display appropriate "item" (tour/hotel/vehicle name)
   - Add type filter

4. **Next: Update Booking Detail Page**
   - Conditional display based on booking_type
   - Show tour package section if tour
   - Show hotel details if hotel booking
   - Show vehicle details if car hire
   - Can show multiple sections for custom combos

5. **Next: Update Invoice Generation**
   - Detect booking type
   - Use appropriate revenue account
   - Format line items correctly

## Migration Command

Run this to enable the unified booking system:
```bash
# Apply the migration
supabase db push

# Or in psql:
psql $DATABASE_URL -f supabase/migrations/034_unified_booking_system.sql
```

## Testing Checklist

After implementation, test:
- [ ] Create tour package booking (existing flow)
- [ ] Create hotel-only booking
- [ ] Create car hire booking
- [ ] Create custom combination booking
- [ ] View all booking types in list
- [ ] Filter by booking type
- [ ] View details of each booking type
- [ ] Convert each type to invoice
- [ ] Verify revenue accounts are correct
- [ ] Test date validation
- [ ] Test pricing calculations

## Questions?

This unified approach keeps everything simple while supporting all your business needs. Let me know if you'd like me to proceed with updating the booking form!

# Currency Handling in Booking-Invoice Integration

## Overview
The Breco Safaris system supports multi-currency transactions with automatic conversion when synchronizing payments between invoices and bookings.

## Supported Currencies
- **USD** - US Dollar (default)
- **EUR** - Euro  
- **GBP** - British Pound
- **UGX** - Ugandan Shilling (no decimal places)

## How Currency Conversion Works

### Database Functions
The system uses PostgreSQL functions for currency conversion:
- `get_exchange_rate(from_currency, to_currency, date)` - Get exchange rate for a specific date
- `convert_currency(amount, from_currency, to_currency, date)` - Convert amount between currencies

### Exchange Rate Storage
Exchange rates are stored in the `exchange_rates` table with:
- Historical tracking (date-based)
- Automatic updates via API (exchangerate-api.com)
- Manual override capability
- Rate precision to 8 decimal places

## Booking-Invoice Currency Handling

### Invoice Generation
1. **Currency Inheritance**: Invoices automatically inherit the booking's currency
2. **Currency Override**: Users can change invoice currency if needed (e.g., for international customers)
3. **Warning Display**: System warns when invoice currency differs from booking currency

### Payment Synchronization
When payments are recorded on invoices:

1. **Same Currency**: If invoice currency matches booking currency
   - Payment amounts are added directly
   - No conversion needed

2. **Different Currency**: If currencies differ
   - System automatically converts payment to booking currency
   - Uses latest exchange rate from database
   - Logs conversion for audit trail
   - Shows warning if conversion rate unavailable

### Auto-Sync Logic
The system syncs payments from invoices to bookings in three scenarios:

1. **Payment Recording** (`/api/invoices/[id]/payments`)
   - When a new payment is recorded on an invoice
   - Calculates total paid across ALL invoices for the booking
   - Converts each invoice's payments to booking currency
   - Updates booking `amount_paid` and `status`

2. **Invoice Status Change** (`/api/invoices/[id]`)
   - When marking invoice as "paid" or "partial"
   - Performs same currency-aware calculation
   - Ensures booking reflects accurate payment status

3. **Page Load Sync** (`/dashboard/bookings/[id]`)
   - Frontend performs currency conversion on page load
   - Fixes any discrepancies in existing data
   - Shows toast warning if conversion rates unavailable

## UI Indicators

### Currency Badges
- **Related Invoices List**: Shows orange badge when invoice currency differs from booking
- **Invoice Generation Modal**: Displays currency mismatch warning with list of affected invoices
- **Payment History**: (Future) Will show original currency + converted amount

### Warnings
```
⚠️ Currency Mismatch Detected
Some invoices use different currencies than the booking (USD). 
Payments will be auto-converted.
• INV-001: GBP
• INV-002: EUR
```

## Example Scenario

### Booking Details
- Booking Total: **10,000 USD**
- Currency: USD

### Invoices
1. **INV-001** (Deposit)
   - Amount: 2,000 GBP
   - Paid: 2,000 GBP
   - Converted to USD: ~2,540 USD (at 1.27 rate)

2. **INV-002** (Balance)
   - Amount: 7,500 USD  
   - Paid: 5,000 USD
   - No conversion needed

### Booking Payment Status
- **Total Paid**: 2,540 + 5,000 = **7,540 USD** (in booking currency)
- **Balance Due**: 10,000 - 7,540 = **2,460 USD**
- **Status**: `deposit_paid` (automatically updated)

## Best Practices

### For Users
1. **Consistent Currency**: Use the same currency for all invoices when possible
2. **Check Exchange Rates**: Verify rates are up-to-date before generating multi-currency invoices
3. **Monitor Warnings**: Pay attention to currency mismatch warnings
4. **Update Rates**: Run exchange rate updates regularly (recommended: daily)

### For Developers
1. **Always Convert**: Never add amounts in different currencies directly
2. **Use Database Functions**: Leverage `convert_currency()` for consistency
3. **Handle Nulls**: Check for null conversion results (indicates missing rate)
4. **Log Conversions**: Log currency conversions for debugging
5. **Fallback Strategy**: Have a fallback if conversion fails (currently: use amount as-is)

## Exchange Rate Management

### Updating Rates
```typescript
import { updateExchangeRates } from '@/lib/currency';

// Update from external API
await updateExchangeRates(supabase);
```

### Manual Rate Entry
Rates can be manually inserted into `exchange_rates` table:
```sql
INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date, source)
VALUES ('USD', 'UGX', 3700.00, CURRENT_DATE, 'manual');
```

## Known Limitations

1. **Rate Availability**: System requires exchange rates to be pre-loaded
2. **Real-time Rates**: Not real-time; uses daily snapshot
3. **Rounding**: Conversions rounded to 2 decimal places
4. **Crypto/Exotic Currencies**: Not supported
5. **Historical Accuracy**: Old conversions use rate from conversion date, not payment date

## Future Enhancements

- [ ] Real-time exchange rate fetching
- [ ] Show original + converted amounts in payment history
- [ ] Currency conversion audit trail
- [ ] Multi-currency reports
- [ ] Automatic rate update scheduling
- [ ] Support for more currencies (KES, TZS, etc.)

## Testing Checklist

- [ ] Create booking in USD
- [ ] Generate invoice in GBP
- [ ] Record payment on GBP invoice
- [ ] Verify booking shows correct converted amount
- [ ] Check currency badge displays on invoice
- [ ] Confirm mismatch warning appears in modal
- [ ] Test with missing exchange rate
- [ ] Verify auto-sync on page load
- [ ] Test with 3+ invoices in different currencies

## Related Files

- `src/lib/currency.ts` - Currency utilities and conversion functions
- `src/app/api/invoices/[id]/payments/route.ts` - Payment recording with conversion
- `src/app/api/invoices/[id]/route.ts` - Invoice updates with conversion
- `src/app/dashboard/bookings/[id]/page.tsx` - Booking detail with currency display
- `supabase/migrations/017_add_multi_currency_support.sql` - Database schema

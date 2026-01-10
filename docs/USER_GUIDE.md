# Breco Safaris Operations & Finance System
## Complete User Guide

**Version:** 2.0  
**Last Updated:** January 11, 2026  
**System:** Breco Safaris Management Platform

**Recent Updates:**
- **NEW: Row-Level Security (RLS)** - Enhanced data security with role-based access policies
- **NEW: Fiscal Period Locking** - Close quarters/months to prevent changes to historical data
- **NEW: Cafe Operations Module** - Separate dashboard and revenue tracking for cafe business
- Updated user permission system (Admin, Accountant, Operations, Sales, Guide)
- Department-based expense tracking (Operations, Cafe, Administration, Sales, Maintenance)
- Manual sales entry for daily/weekly/monthly cafe revenue
- Dedicated cafe chart of accounts (42xx revenue, 52xx COGS, 63xx expenses)
- Enhanced expense approval workflow with department filtering
- Added quotation and proforma invoice support with conversion workflow
- Multi-currency invoice support with automatic conversion

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Dashboard Overview](#3-dashboard-overview)
4. [Cafe Operations](#4-cafe-operations)
5. [Tour Operations](#5-tour-operations)
6. [Finance Management](#6-finance-management)
7. [Fiscal Period Management](#7-fiscal-period-management)
8. [HR & Payroll](#8-hr--payroll)
9. [Inventory & Assets](#9-inventory--assets)
10. [Bank & Cash](#10-bank--cash)
11. [Reports & Analytics](#11-reports--analytics)
12. [System Settings](#12-system-settings)
13. [Common Questions & Answers](#13-common-questions--answers)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Introduction

### 1.1 What is Breco Safaris System?

Breco Safaris Operations & Finance System is a comprehensive business management platform designed specifically for tour and safari operations. It integrates:

- **Cafe Operations** - Separate module for cafe business tracking with dedicated revenue/expense management
- **Unified Booking System** - Handle tour packages, hotel bookings, and car hire from one interface
- **Tour Operations Management** - Packages, itineraries, destinations, guides
- **Financial Accounting** - Full double-entry accounting, invoicing, expenses
- **HR & Payroll** - Employee management, salary processing, payslips
- **Inventory & Assets** - Stock management, fixed asset tracking
- **Multi-Currency Support** - Handle transactions in multiple currencies
- **Automated Reporting** - Financial statements, profit/loss, balance sheets

### 1.2 Who Should Use This System?

- **Tour Operators** - Manage bookings and tour packages
- **Accountants** - Handle financial transactions and reporting
- **HR Managers** - Manage employees and process payroll
- **Inventory Managers** - Track stock and assets
- **Management** - View reports and analytics

### 1.3 System Requirements

- **Web Browser**: Chrome, Firefox, Safari, or Edge (latest versions)
- **Internet Connection**: Required for all operations
- **Screen Resolution**: 1280x720 minimum (responsive design)
- **Permissions**: Role-based access (Admin, Manager, Accountant, Viewer)

---

## 2. Getting Started

### 2.1 Logging In

1. Navigate to your Breco Safaris system URL
2. Enter your email address
3. Enter your password
4. Click **Sign In**

**First-time login?** Contact your administrator for credentials.

### 2.2 Understanding User Roles & Permissions

The system uses a 5-tier role-based access control system with Row-Level Security (RLS) to protect sensitive data.

**🔴 Admin** (Highest Access)
- Full system access to all modules and data
- Create, edit, and delete all records
- Manage user accounts and permissions
- Close/open fiscal periods
- Configure system settings
- Access all financial and operational reports
- Override period locks when necessary

**🟠 Accountant** (Financial Access)
- Full access to all financial data:
  - Chart of accounts, journal entries, ledgers
  - Invoices, bills, payments (create/edit/delete)
  - Bank accounts, reconciliations, cash management
  - Payroll processing, employee compensation
  - Asset depreciation and financial reporting
- View-only access to operational data (bookings, tours)
- Create and manage expenses
- Cannot modify user permissions or close periods

**🟡 Operations** (Operational Access)
- Full access to operational modules:
  - Bookings, tours, hotels, vehicles
  - Inventory management, stock takes
  - Purchase orders, goods receipts
  - Asset assignments and maintenance
  - Vendor management
- Limited financial access (can view, cannot manage)
- Create expenses for approval
- Cannot access payroll or sensitive employee data

**🟢 Sales** (Customer-Facing Access)
- Customer management (create/edit customers)
- Create and manage invoices, quotations, proformas
- Booking creation and management
- View tour packages and pricing
- Create expenses for approval
- View reports related to sales performance
- Cannot access bank accounts, payroll, or bills

**🔵 Guide** (Read-Only Access)
- View-only access to assigned tours and bookings
- View customer information for assigned tours
- View tour packages and itineraries
- Cannot create, edit, or delete any records
- Limited reporting access

### 2.3 Data Security & Privacy

**Row-Level Security (RLS)**
The system enforces data access at the database level:
- Users only see data appropriate for their role
- Sensitive information (payroll, bank details, passport numbers) restricted to authorized roles
- All queries automatically filtered based on user permissions
- Audit trail of all data access attempts

**Default Role for New Users**
- New user signups automatically receive "Sales" role
- Admins can upgrade roles as needed from Settings → Users

**Role Change Process**
1. Only Admins can change user roles
2. Go to Settings → Users
3. Select user and update role
4. Changes take effect immediately

### 2.4 Navigation Basics

**Sidebar Menu** (Left side)
- Click any menu item to navigate
- Sections expand to show sub-items
- Your current page is highlighted

**Quick Actions** (Top bar)
- Search functionality
- Notifications
- User profile menu

**Breadcrumbs** (Top of page)
- Shows your current location
- Click to navigate back

---

## 3. Dashboard Overview

### 3.1 Main Dashboard

When you log in, you'll see the main dashboard with:

**Summary Cards**
- Total Revenue (current month/year)
- Outstanding Invoices
- Total Expenses
- Net Profit/Loss

**Recent Activity**
- Latest invoices created
- Recent payments received
- Upcoming bookings
- Pending approvals

**Quick Stats**
- Active tours
- Employee count
- Asset value
- Bank balance

### 3.2 Dashboard Widgets

**Revenue Chart**
- Visual representation of monthly revenue
- Compare current vs previous period
- Click to view detailed report

**Expense Breakdown**
- Pie chart of expense categories
- Identify top spending areas

**Booking Pipeline**
- Upcoming tours and bookings
- Occupancy rates
- Revenue forecast

---

## 4. Cafe Operations

### 4.1 Overview

The Cafe Operations module is a dedicated system for managing your cafe business separately from the main safari operations. It provides:

- **Dedicated Dashboard** - Real-time revenue, expenses, and profitability metrics
- **Simple Revenue Entry** - Manually record daily, weekly, or monthly sales
- **Department Tracking** - All cafe transactions are tagged with "Cafe" department
- **Separate Chart of Accounts** - Dedicated accounting structure for cafe financials
- **Staff Management** - Track cafe employees and payroll separately

### 4.2 Accessing Cafe Dashboard

1. In the sidebar, go to **Cafe Operations → Cafe Dashboard**
2. View key performance indicators (KPIs):
   - **Revenue (This Month)** - Total sales from cafe accounts (42xx)
   - **Expenses (This Month)** - All expenses with department = "Cafe"
   - **Profit (This Month)** - Revenue minus expenses
   - **Profit Margin** - Percentage profitability
   - **Cafe Staff** - Number of employees and monthly payroll

### 4.3 Recording Cafe Sales

The cafe system allows you to manually record sales on a daily, weekly, or monthly basis.

**How to Record Sales:**

1. From the **Cafe Dashboard**, click **Record Sales** button
2. Fill in the sales form:
   - **Sale Date** - The date of the sales (for accounting records)
   - **Period** - Select Daily Sales, Weekly Sales, or Monthly Sales
   - **Food Sales (USD)** - Amount of food revenue
   - **Beverage Sales (USD)** - Amount of beverage revenue
   - **Catering Sales (USD)** - Amount of catering revenue
   - **Payment Method** - How payment was received (Cash, Bank Transfer, Credit Card, Mobile Money)
   - **Notes** - Optional notes about the sales
3. Review the **Total Sales** amount
4. Click **Record Sales**

**What Happens:**
- A journal entry is created automatically
- Cash account (1010) is debited (asset increase)
- Revenue accounts are credited:
  - Food Sales → Account 4210 (Food Sales)
  - Beverage Sales → Account 4220 (Beverage Sales)
  - Catering Sales → Account 4230 (Catering Services)
- Revenue appears immediately in the cafe dashboard

**Example:**
```
Date: January 10, 2026
Period: Daily Sales
Food Sales: $150.00
Beverage Sales: $75.00
Catering Sales: $0.00
Payment: Cash
Total: $225.00
```

This creates a journal entry crediting $150 to Food Sales account and $75 to Beverage Sales account.

### 4.4 Recording Cafe Expenses

Track all cafe-related costs using the department field.

**How to Record Cafe Expense:**

1. From **Cafe Dashboard**, click **Add Expense** button (or go to Finance → Expenses → New)
2. Fill in the expense form:
   - **Date** - Expense date
   - **Category** - Select expense type (Office Supplies, Utilities, etc.)
   - **Department** - **Important:** Select "Cafe" from the dropdown
   - **Vendor** - Who you paid (optional)
   - **Amount** - Total expense amount
   - **Payment Method** - How you paid
   - **Description** - What the expense was for
3. Click **Save Expense**

**Important:** Always select **Department = "Cafe"** for cafe expenses. This ensures they appear in the cafe dashboard and reports.

**Common Cafe Expense Categories:**
- Food & ingredients purchases (use dedicated COGS accounts 52xx)
- Kitchen supplies
- Utilities (electricity, water)
- Salaries (cafe staff)
- Maintenance & repairs
- Marketing for cafe

### 4.5 Cafe Chart of Accounts

The cafe uses dedicated account codes to keep finances separate:

**Revenue Accounts (4200-4299)**
- **4200** - Cafe Sales Revenue (general)
- **4210** - Food Sales
- **4220** - Beverage Sales
- **4230** - Catering Services

**Cost of Goods Sold (5250-5259)**
- **5250** - Cafe Food Costs
- **5251** - Cafe Beverage Costs
- **5252** - Cafe Supplies Used
- **5253** - Cafe Catering Costs

**Operating Expenses (6350-6359)**
- **6350** - Cafe Utilities
- **6351** - Cafe Equipment Maintenance
- **6352** - Cafe Marketing
- **6353** - Cafe Licenses & Permits
- **6354** - Cafe Miscellaneous

### 4.6 Managing Cafe Staff

Track cafe employees separately from safari operations staff.

**Adding Cafe Employee:**

1. Go to **HR & Payroll → Employees**
2. Click **Add Employee**
3. Fill in employee details
4. **Important:** Set **Department = "Cafe"**
5. Enter salary information
6. Click **Save**

**Viewing Cafe Staff:**
- From **Cafe Dashboard**, click **View Cafe Staff** in Quick Actions
- This filters the employee list to show only cafe department employees
- The cafe dashboard shows total cafe staff count and monthly payroll

### 4.7 Cafe Reports & Analytics

**Dashboard Charts:**

1. **Revenue Trend (Last 6 Months)**
   - Bar chart showing monthly revenue from cafe accounts
   - Helps identify seasonal patterns
   - Compare month-over-month performance

2. **Expense Breakdown (This Month)**
   - Pie chart of expense categories
   - Shows where cafe money is being spent
   - Helps control costs

**Detailed Financial Reports:**

1. **Cafe Profit & Loss Statement**
   - From **Cafe Dashboard**, click **Cafe P&L Report** in Quick Actions
   - Shows detailed revenue and expenses by account
   - Filters to accounts 42xx (cafe accounts only)
   - View for custom date ranges

2. **General Ledger (Cafe Accounts)**
   - Go to **Finance → General Ledger**
   - Filter by account code starting with "42" to see cafe transactions
   - View all journal entries affecting cafe accounts

### 4.8 Best Practices

**Recording Sales:**
- Record sales at consistent intervals (daily is recommended)
- Use the appropriate period type (daily for daily totals, monthly for month-end)
- Always specify payment method for cash flow tracking
- Add notes for unusual sales or special events

**Managing Expenses:**
- Always set Department = "Cafe" for cafe-related expenses
- Use specific expense categories for better reporting
- Keep receipts and reference numbers
- Approve expenses promptly

**Staff Management:**
- Keep cafe staff department consistent
- Update salaries when changes occur
- Track attendance and performance

**Financial Review:**
- Check cafe dashboard at least weekly
- Review profit margin trends
- Compare actual vs. budgeted performance
- Adjust pricing or costs based on profitability

### 4.9 Common Workflows

**Daily Cafe Operations:**
1. Record daily sales at end of day
2. Enter any expenses incurred
3. Review running totals on dashboard

**Weekly Review:**
1. Check week-to-date revenue vs. target
2. Review expense breakdown
3. Ensure all transactions recorded
4. Process staff timesheets if applicable

**Monthly Close:**
1. Record all final sales for the month
2. Ensure all expenses are entered and approved
3. Review Cafe P&L Statement
4. Compare to budget
5. Plan adjustments for next month

### 4.10 Troubleshooting

**Issue:** Sales not showing in cafe dashboard
- **Solution:** Check that you recorded sales using the "Record Sales" form (not regular invoices)
- Sales must be credited to accounts 4210, 4220, or 4230
- Check the date range - dashboard shows current month only

**Issue:** Expenses not appearing in cafe reports
- **Solution:** Ensure Department field is set to "Cafe" on expense record
- Edit existing expenses to add department if missing
- Department filter is case-sensitive - use exact spelling "Cafe"

**Issue:** Revenue showing incorrect amounts
- **Solution:** Check General Ledger for account 42xx for any incorrect entries
- Verify all sales entries were recorded with correct amounts
- Contact accounting if journal entries need to be corrected

---

## 5. Tour Operations

### 4.1 Tour Packages

**Creating a New Tour Package**

1. Go to **Tour Operations → Tour Packages**
2. Click **New Package**
3. Fill in package details:
   - Package Name
   - Duration (days/nights)
   - Base Price
   - Max Capacity
   - Description
   - Included Services
4. Upload images
5. Click **Save**

**Package Management**
- **Active/Inactive**: Toggle package availability
- **Pricing**: Set seasonal pricing variations
- **Itinerary**: Add daily schedule details
- **Inclusions/Exclusions**: Specify what's covered

### 4.2 Bookings & Invoice Integration

The unified booking system handles all types of reservations and seamlessly integrates with invoicing for payment tracking:
- **Tour Packages** - Multi-day safari tours
- **Hotel Bookings** - Accommodation only
- **Car Hire** - Vehicle rentals
- **Custom Bookings** - Combined hotel + vehicle packages

**Creating a New Booking**

1. Go to **Tour Operations → Bookings**
2. Click **New Booking**
3. **Select Booking Type**:
   - Click the type button at the top: Tour Package, Hotel, Car Hire, or Custom
   - The form adapts to show relevant fields for your selection

4. **Customer Information**:
   - Select existing customer or create new
   - Enter name, email, phone
   - Add country, ID/Passport if needed

5. **Fill Type-Specific Details**:

   **For Tour Package:**
   - Select tour package from dropdown
   - System auto-fills duration and pricing
   - Enter number of travelers (adults/children/infants)
   - Select travel dates
   
   **For Hotel:**
   - Select hotel from dropdown
   - Choose room type (single, double, suite, etc.)
   - Enter number of rooms
   - Select check-in and check-out dates
   - System calculates nights and total cost
   
   **For Car Hire:**
   - Select vehicle from fleet
   - Choose rental type (self-drive or with driver)
   - Enter pickup and dropoff locations
   - Select rental dates
   - System calculates daily rate and total
   
   **For Custom:**
   - Select hotel AND/OR vehicle
   - All relevant fields appear for both
   - System calculates combined total

6. **Additional Details**:
   - Add special requests
   - Enter dietary requirements
   - Add internal notes
   - Apply discounts if applicable

7. **Review & Create**:
   - System automatically calculates totals
   - Review pricing breakdown
   - Click **Create Booking**

**Booking List Features**

The bookings list now shows all booking types together:
- **Type Filter**: Filter by Tour, Hotel, Car Hire, or Custom
- **Type Icons**: Visual indicators for each booking type
  - 🗺️ Tour Package
  - 🏢 Hotel
  - 🚗 Car Hire
  - ✨ Custom
- **Details Column**: Shows relevant item (package name, hotel name, or vehicle)
- **Status Filter**: Filter by booking status
- **Date Filter**: View upcoming or past bookings

**Booking Statuses**
- **Inquiry**: Initial customer inquiry - not yet confirmed
- **Confirmed**: Booking confirmed by customer (ready for invoicing)
- **Deposit Paid**: Partial payment received (tracks automatically)
- **Fully Paid**: Complete payment received (updates from invoices)
- **Completed**: Service finished
- **Cancelled**: Booking cancelled

**Note:** Payment-related statuses (Deposit Paid, Fully Paid) are automatically updated when payments are recorded on related invoices.

**Viewing Booking Details**

Click any booking to see complete information:

**Main Details Section:**
- **Tour bookings**: Package details, itinerary, duration, travelers
- **Hotel bookings**: Hotel name, star rating, room type, number of rooms, photos
- **Car hire**: Vehicle type, registration, rental type, pickup/dropoff locations, photos
- **Custom bookings**: Combined hotel and vehicle information with images

**Pricing Summary Card:**

The revenue/pricing breakdown for each booking:

**Revenue Calculation:**
1. **Subtotal**: Base price before discounts and taxes
   - For **Tour Package**: Package base price × number of adults (children/infants may have different rates)
   - For **Hotel**: Room rate × number of rooms × number of nights
   - For **Car Hire**: Daily rate × number of days
   - For **Custom**: Combined hotel + vehicle totals

2. **Discount Amount**: Any discounts applied
   - Can be fixed amount or percentage
   - Reduces the subtotal
   - Shows as negative/red if applied

3. **Tax Amount**: Applicable taxes
   - Calculated on subtotal after discounts
   - Based on tax rate (e.g., 18% VAT)
   - Can be 0 if no tax applies

4. **Total Booking Value**: Final amount customer owes
   - Formula: `Total = Subtotal - Discount + Tax`
   - This is the revenue for this booking
   - Displayed prominently in large font

5. **Amount Paid**: Total payments received (auto-synced from invoices)
   - Updates automatically when payments recorded on invoices
   - Converted to booking currency if multi-currency invoices
   - Shows in green

6. **Balance Due**: Outstanding amount
   - Formula: `Balance = Total - Amount Paid`
   - Auto-calculated, not editable
   - Shows in amber/gold color
   - Becomes $0.00 when fully paid

**Example Calculation:**
```
Tour Package: 5-Day Safari
Base Price: $2,000 per person
Travelers: 2 adults, 1 child (50% rate)

Subtotal: ($2,000 × 2) + ($2,000 × 0.5 × 1) = $5,000
Discount: 10% early bird = -$500
Tax: 18% VAT on $4,500 = +$810
──────────────────────────────────────
Total Booking Value: $5,310 (Revenue)
Amount Paid: $2,655 (50% deposit)
Balance Due: $2,655
```

**Currency Support**: All amounts display in booking currency (USD, EUR, GBP, UGX)

**Related Invoices Card:**
Shows all invoices generated for this booking:
- Invoice number with clickable link
- Invoice status badge (Draft, Sent, Partial, Paid)
- Currency badge if different from booking currency (⚠️ Orange badge)
- Amount and balance due for each invoice
- **Summary totals**:
  - Total invoiced across all invoices
  - Total paid (in booking currency)
  - Outstanding balance
- **Invoicing progress**: Shows percentage invoiced vs booking total

**Payment History Card:**
Complete timeline of all payments received:
- Numbered payment sequence (most recent first)
- Payment date and amount
- Payment method badges (Cash, Bank Transfer, Credit Card, etc.)
- Reference numbers for bank transfers
- Running total showing cumulative payments
- Links to original invoices
- Payment notes if applicable
- **Total payments summary** at bottom

**Currency Handling:**
- System automatically converts payments to booking currency
- Orange badges show invoices in different currencies
- Warning displays if currency mismatch detected
- Exchange rates applied from database

**Generate Invoice from Booking**

The most powerful feature - create invoices directly from bookings:

1. **From Booking Detail Page**:
   - Scroll to "Actions" card in right sidebar
   - Click **"Generate Invoice"** button
   
2. **Invoice Generation Modal Opens**:
   
   **Smart Suggestions** (system automatically analyzes and shows):
   - **First invoice?** → Suggests deposit invoice
   - **Partially invoiced?** → Shows percentage invoiced and remaining balance
   - **Fully invoiced?** → Green badge confirms complete invoicing
   - **Over-invoiced?** → Red warning if invoices exceed booking total
   - **Currency mismatch?** → Orange warning listing invoices in different currencies

3. **Select Invoice Type**:
   
   **Full Invoice** (Default: Total booking amount)
   - Creates invoice for complete booking value
   - Best for: Fully paid bookings, pre-paid packages
   - Warning shows if this would exceed remaining balance
   
   **Deposit Invoice** (Percentage-based)
   - Default: 30% deposit
   - Adjust slider: 1% to 100%
   - Shows calculated amount: "30% = $3,000"
   - Validation: Prevents deposit exceeding remaining balance
   - Best for: Securing bookings, payment plans
   
   **Balance Invoice** (Remaining amount)
   - Automatically calculates: Booking Total - Already Invoiced
   - Shows exact remaining balance
   - Disabled if booking already fully invoiced
   - Best for: Final payment after deposit

4. **Review Pre-filled Information**:
   - Booking number (automatically linked)
   - Customer name and contact
   - Booking total and currency
   - Already invoiced amount (if any)
   - Remaining balance to invoice

5. **Click "Generate Invoice"**:
   - System validates amounts
   - Pre-fills invoice creation form with:
     - Customer details
     - Booking reference
     - Correct currency
     - Line item description (based on booking type)
     - Calculated amount
   - Redirects to invoice creation page

6. **Complete Invoice Creation**:
   - Review auto-filled details
   - Add/modify line items if needed
   - Adjust payment terms
   - Add notes
   - Click **Create Invoice**

**Smart Validation & Warnings:**

System automatically prevents common errors:

✅ **First Invoice - Blue Info Badge**
```
"This booking has no invoices yet. Consider starting with a deposit invoice."
```

⚠️ **Partially Invoiced - Amber Warning**
```
"45% Invoiced
$4,500 of $10,000 invoiced.
Remaining: $5,500"
```

✅ **Fully Invoiced - Green Success**
```
"Fully Invoiced
This booking has been fully invoiced (2 invoices)."
```

❌ **Over-Invoicing Attempt - Red Error**
```
"Warning: This booking already has $10,500 invoiced.
Creating a full invoice for $10,000 will exceed the booking total.
Remaining balance to invoice: -$500.

Do you want to continue anyway?"
```

🔶 **Currency Mismatch - Orange Alert**
```
"Currency Mismatch Detected
Some invoices use different currencies than the booking (USD).
Payments will be auto-converted.
• INV-001: GBP
• INV-002: EUR"
```

**Payment Tracking & Auto-Sync**

Once invoices are created, payments are automatically synchronized:

**When Payment is Recorded on Invoice:**
1. Go to invoice detail page
2. Click **"Record Payment"**
3. Enter payment details (amount, method, date)
4. Click **Save**

**System Automatically:**
- Updates invoice `amount_paid`
- Changes invoice status (Partial → Paid)
- **Syncs to booking**: Updates booking `amount_paid`
- **Converts currencies**: If invoice currency differs from booking
- **Updates booking status**:
  - Any payment → `deposit_paid`
  - Full payment → `fully_paid`
- Appears in booking's Payment History
- Recalculates remaining balance

**Multiple Invoice Scenario:**

Example: $10,000 USD booking with 2 invoices:
- **Invoice 1**: £2,000 GBP deposit (paid in full)
- **Invoice 2**: $7,500 USD balance (paid $5,000)

**Booking Shows:**
- Amount Paid: $7,540 USD (£2,000 converted + $5,000)
- Balance Due: $2,460 USD
- Status: `deposit_paid`
- Payment History: 2 payments listed with conversion notes

**Auto-Sync on Page Load:**
- System checks invoice payments when viewing booking
- Fixes any discrepancies automatically
- Ensures booking always reflects current payment state
- Handles legacy data without manual intervention

**Best Practices for Invoicing:**

1. **Start with Deposit**:
   - Create 30-50% deposit invoice
   - Secure the booking with partial payment
   - Generate balance invoice closer to travel date

2. **Consistent Currency**:
   - Use same currency for all invoices when possible
   - System handles conversions but simpler is better
   - Check exchange rates before generating multi-currency invoices

3. **Track Progress**:
   - Monitor "Related Invoices" card on booking page
   - Check percentage invoiced
   - Ensure total invoices don't exceed booking total

4. **Payment Recording**:
   - Always record payments on invoices (not directly on bookings)
   - Booking payment status updates automatically
   - Maintains proper audit trail

5. **Multiple Invoices**:
   - No limit on invoices per booking
   - Common pattern: Deposit → Balance → Additional charges
   - Each invoice can be in different currency if needed

**Common Scenarios:**

**Scenario 1: Standard Deposit + Balance**
1. Create booking: $10,000
2. Generate 30% deposit invoice: $3,000
3. Send to customer, record payment
4. Booking status → `deposit_paid`
5. Before travel, generate balance invoice: $7,000
6. Record payment
7. Booking status → `fully_paid`

**Scenario 2: International Client (Multi-Currency)**
1. Create booking: $10,000 USD
2. Client prefers GBP, generate invoice: £7,874 GBP
3. Record payment in GBP
4. System converts to USD (~$10,000)
5. Booking shows payment in USD
6. Orange currency badge visible on invoice

**Scenario 3: Payment Plan (3 Invoices)**
1. Create booking: $15,000
2. Generate deposit: $5,000 (33%)
3. Generate 2nd payment: $5,000
4. Generate final: $5,000
5. All track separately in "Related Invoices"
6. Payment history shows all 3 payments
7. Booking totals accurate

**Troubleshooting:**

**Problem**: "Booking amount_paid doesn't match invoice payments"
- **Solution**: Open booking page - auto-sync runs on load

**Problem**: "Can't generate invoice - over booking total"
- **Solution**: Check "Related Invoices" - may already be fully invoiced

**Problem**: "Currency mismatch warning showing"
- **Solution**: Normal if using different currencies - system handles conversion

**Problem**: "Payment not showing in booking history"
- **Solution**: Ensure payment recorded on invoice, not as standalone receipt

**Other Booking Actions**
- **Edit Booking**: Modify dates, travelers, or details
- **Change Status**: Manually update if needed (usually automatic)
- **Print**: Generate booking confirmation
- **Cancel**: Cancel booking (status → Cancelled)
- **Add Notes**: Internal notes and updates

### 4.3 Hotels Management

**Adding a Hotel**

1. Go to **Tour Operations → Hotels**
2. Click **Add Hotel**
3. Enter hotel details:
   - Name and location
   - Star rating
   - Contact information
   - Room types and rates
   - Amenities
4. Upload photos
5. Click **Save**

**Hotel Bookings**
- Link hotels to tour packages
- Track room allocations
- Manage hotel commissions

### 4.4 Fleet Management

**Adding a Vehicle**

1. Go to **Tour Operations → Fleet**
2. Click **Add Vehicle**
3. Enter vehicle details:
   - Type (4x4, van, bus)
   - Registration number
   - Capacity
   - Driver assignment
   - Insurance details
4. Upload photos
5. Click **Save**

**Fleet Tracking**
- **Availability**: Check vehicle schedule
- **Maintenance**: Schedule service
- **Fuel Logs**: Track fuel consumption
- **Trip Assignments**: Assign to tours

---

## 6. Finance Management

### 6.1 Chart of Accounts

**Understanding Accounts**

The Chart of Accounts is the foundation of your accounting system. Every financial transaction must be categorized using these account numbers.

**Account Types:**
- **Assets**: What you own (cash, inventory, equipment)
- **Liabilities**: What you owe (loans, payables)
- **Equity**: Owner's investment
- **Revenue**: Income from sales
- **Expenses**: Business costs

**Viewing the Chart of Accounts**

1. Go to **Settings → Financial** tab
2. Scroll down to find **"Chart of Accounts"** section
3. Click **"View Chart"** button
4. Or navigate directly to **Finance → Chart of Accounts**

**What You'll See:**
- Complete list of all account numbers and names
- Accounts grouped by type (Assets, Expenses, Revenue, etc.)
- Search functionality to find specific accounts
- Filter by account type
- Quick reference guide for common accounts

**Common Account Number Ranges:**

**5000-5999: Cost of Services (Direct Costs)**
- **5100** - Park Entry Fees
- **5110** - Gorilla Permits Cost
- **5120** - Chimpanzee Permits Cost
- **5200** - Accommodation Costs
- **5300** - Guide & Porter Fees
- **5400** - Meals for Clients
- **5500** - Activity Costs (boat hire, equipment rental)

**6000-6999: Operating Expenses**
- **6100** - Salaries & Wages
- **6200** - Office Rent
- **6210** - Utilities
- **6220** - Telephone & Internet
- **6300** - Insurance
- **6400** - Office Supplies
- **6500** - Professional Fees
- **6600** - Bank Charges

**7000-7999: Other Expenses**
- **7000** - Marketing & Advertising
- **7500** - Fleet Expenses
- **7510** - Fuel & Diesel
- **7520** - Vehicle Servicing
- **7600** - Travel & Entertainment
- **7700** - Repairs & Maintenance

**4000-4999: Revenue Accounts**
- **4100** - Tour Revenue
- **4110** - Safari Packages
- **4200** - Car Hire Revenue
- **4300** - Accommodation Commissions
- **4400** - Airport Transfers

**How to Use Account Numbers:**

When creating bills, expenses, or journal entries, you'll select an account number. Choose the one that best describes your transaction:

**Examples:**
- Paying for gorilla permits → Use **5110** (Gorilla Permits Cost)
- Employee salaries → Use **6100** (Salaries & Wages)
- Vehicle fuel → Use **7510** (Fuel & Diesel)
- Safari package sale → Use **4110** (Safari Packages)

**Searching for Accounts:**
1. Use the search box to find accounts by number or name
2. Type keywords like "fuel" or "5510"
3. Filter by account type (Expenses, Revenue, etc.)
4. Click on any account to see its details

**Best Practices:**
- Always use the most specific account available
- Consult the Chart of Accounts when unsure
- Consistent categorization helps with accurate reporting
- Contact your accountant if you need a new account category

### 5.2 Customer Invoices

**Creating an Invoice**

1. Go to **Finance → Invoices**
2. Click **New Invoice**
3. Fill in details:
   - **Customer**: Select or create
   - **Invoice Date**: Usually today
   - **Due Date**: Payment deadline
   - **Currency**: USD, EUR, UGX, etc.
4. Add line items:
   - Description (e.g., "Safari Package - 5 Days")
   - Quantity
   - Unit Price
   - Tax (if applicable)
5. Review totals
6. Click **Save** or **Save & Send**

**Invoice Statuses**
- **Draft**: Not yet sent
- **Sent**: Emailed to customer
- **Partially Paid**: Some payment received
- **Paid**: Fully paid
- **Overdue**: Past due date

**Invoice Actions**
- **Send**: Email to customer
- **Record Payment**: Mark as paid
- **Download PDF**: Print invoice
- **Void**: Cancel invoice
- **Duplicate**: Create copy

**Automatic Inventory Tracking:**

When you create invoices with products that have inventory tracking enabled, the system automatically manages stock levels:

**What Happens Automatically:**
1. **Draft Invoice**: No inventory change
2. **Sent/Posted Invoice**: 
   - System checks if enough stock available
   - Reduces `quantity_on_hand` for each product
   - Creates inventory movement record (type: "sale")
   - Prevents sending if insufficient stock
   - Shows error: "Insufficient inventory for [Product]. Available: X, Required: Y"

**Example:**
```
Product: Safari T-Shirt
Stock before invoice: 50 units
Invoice created (Draft): 50 units (no change)
Invoice sent to customer: 10 units
Stock after sending: 40 units (automatically reduced)
```

**Important Notes:**
- Only affects products with "Track Inventory" enabled
- Service products (non-inventory) are not affected
- Voiding an invoice does NOT restore inventory (manual adjustment needed)
- Inventory movements are logged for audit trail
- Can view movement history in Inventory → Movements

**Tips:**
- Always attach booking reference
- Use clear descriptions
- Set realistic payment terms
- Follow up on overdue invoices

### 5.2.1 Document Types (Invoice, Quotation, Proforma)

**Understanding Document Types**

The system supports multiple document types for different stages of the sales process:

1. **Quotation (QUO-2026-00001)**
   - Price estimate or proposal for customer
   - Reserves inventory (prevents overselling)
   - Can be converted to invoice when accepted
   - Separate numbering sequence
   - Does not affect customer balance

2. **Proforma Invoice (PRO-2026-00001)**
   - Advance invoice sent before delivery/service
   - Used for customs, down payments, or pre-approvals
   - Can be converted to invoice upon delivery
   - Separate numbering sequence
   - Does not affect customer balance

3. **Invoice (INV-2026-00001)**
   - Final billing document
   - Reduces inventory when sent
   - Updates customer balance
   - Can accept payments and generate receipts
   - Standard invoice numbering

**Creating a Quotation or Proforma**

1. Go to **Finance → Invoices**
2. Click **New Invoice**
3. In the form, locate **Document Type** dropdown
4. Select:
   - **Quotation** for price estimates
   - **Proforma** for advance invoices
   - **Invoice** for standard billing
5. Fill in customer details, line items, and amounts
6. Click **Create**

The document will have the appropriate number prefix (QUO-, PRO-, or INV-).

**Filtering by Document Type**

To view only quotations or proformas:

1. Go to **Finance → Invoices**
2. Look for **All Types** dropdown filter (top of list)
3. Select:
   - **Quotation** to see only quotations
   - **Proforma** to see only proformas
   - **Invoice** to see only invoices
   - **All Types** to see everything

**Converting Quotation or Proforma to Invoice**

When a quotation is accepted or a proforma needs to be finalized:

1. Go to **Finance → Invoices**
2. Click on the quotation or proforma to open details
3. In the actions section (top right), click **"Convert to Invoice"** button
   - This button only appears for quotations and proformas
   - Hidden if already converted or posted
4. Confirm the conversion
5. System automatically:
   - Generates a new invoice number (INV-2026-00XXX)
   - Changes document type to "Invoice"
   - Releases reserved inventory (quotations only)
   - Marks original as converted
   - Sets status to "Draft"
6. Page refreshes with new invoice number

**Important Notes:**
- Conversion is permanent and cannot be undone
- Original quotation/proforma number is preserved in system
- Inventory reservations are handled automatically
- Customer can now make payments against the invoice
- All line items, taxes, and amounts are preserved

**Example Workflow:**

```
1. Customer requests quote
   → Create Quotation (QUO-2026-00015)
   → Inventory reserved: 10 Safari T-Shirts
   
2. Customer accepts quote
   → Open QUO-2026-00015
   → Click "Convert to Invoice"
   → New Invoice created: INV-2026-00042
   → Reservation released (will reduce when invoice sent)
   
3. Send invoice to customer
   → Inventory reduced: 10 units
   → Customer can pay
```

### 5.3 Recording Payments (Receipts)

**Understanding Receipts**

Receipts serve two purposes:
1. **Proof of payment** for an invoice you issued
2. **Standalone receipt** for walk-in sales or cash transactions

**Creating a Receipt for an Invoice Payment**

1. Go to **Finance → Receipts**
2. Click **New Receipt**
3. Select **Customer**
4. In **Related Invoice Number** field:
   - Click dropdown to see unpaid/partial invoices for this customer
   - Select the invoice being paid
   - System auto-fills all line items, taxes, and amounts from invoice
   - Pre-fills "Amount Paid" with invoice balance
5. Adjust amount if partial payment
6. Select **Payment Method** (Cash, Bank Transfer, etc.)
7. Add reference number if applicable
8. Click **Create Receipt**

**What Happens Automatically:**
- Invoice line items populate in receipt
- Amount Paid defaults to invoice balance
- Invoice status updates (Partial or Paid)
- Invoice amount_paid increases
- Payment recorded in audit trail

**Creating a Standalone Receipt (No Invoice)**

For walk-in sales, external invoices, or cash sales:

1. Go to **Finance → Receipts**
2. Click **New Receipt**
3. Select **Customer**
4. **Related Invoice Number**: 
   - **Currency**: USD, UGX, EUR, etc.
4. Add line items:
   - **Description**: What you're paying for
   - **Quantity**: Number of units
   - **Unit Cost**: Price per unit
   - **Account**: **IMPORTANT** - Select account number that describes the expense
     - Example: Gorilla permits → 5110
     - Example: Fuel → 7510
     - Example: Office rent → 6200
   - **Tax Rate**: If applicable
5. Review total
6. Click **Save**

**Selecting the Right Account:**

When adding line items to a bill, the "Account" dropdown shows account numbers. These categorize your expenses:

- **Don't know which account?** Go to **Settings → Financial → View Chart** for reference
- Search for the expense type (e.g., "fuel", "permits")
- Use the most specific account available
- Common accounts are listed in the Chart of Accounts

**Bill Statuses:**
- **Draft**: Being prepared
- **Pending Approval**: Awaiting approval
- **Approved**: Ready for payment
- **Partial**: Some payment made
- **Paid**: Fully paid
- **Overdue**: Past due date

**Bill Payment**

1. Open the bill
2. Click **Record Payment**
3. Enter:
   - **Payment Date**: When paid
   - **Amount**: How much (can be partial)
   - **Payment Method**: Bank Transfer, Cash, etc.
   - **Bank Account**: Which account paid from
   - **Reference**: Check number or transfer ID
   - **Notes**: Any additional info
4. Click **Save**

**What Happens:**
- Bill status updates (Partial or Paid)
- Bank account balance reduces
- Journal entry created automatically
- Payment recorded in audit trail

**Multi-Currency Bills:**
- Select currency when creating bill
- Exchange rate applied automatically
- Converts to base currency (USD) for reporting
- Can change currency - items convert automatically
If you created a receipt without an invoice and need to record another payment:

1. Open the receipt
2. If balance due shows > $0, click **"Record Payment"** button
3. Enter:
   - Payment amount
   - Payment method
   - Notes (optional)
4. Click **Save**

**Note:** Receipts linked to invoices don't show "Record Payment" button because they already documented the invoice payment.

**Payment Methods:**
- Cash
- Bank Transfer
- Credit Card
- Mobile Money
- Check
- Stripe

**Important Notes:**
- Receipts that reference invoices automatically update the invoice
- Can't edit receipt after creation (void and recreate if needed)
- Amount paid cannot exceed receipt total
- System handles floating-point precision automatically

**Viewing Receipt History:**
1. Go to **Finance → Receipts**
2. Search by receipt number, customer, or invoice number
3. Click receipt to view details
4. See related invoice link (if applicable)
5. Print or email receipt to customer

### 5.4 Vendor Bills

**Recording a Bill from Supplier**

1. Go to **Finance → Bills**
2. Click **New Bill**
3. Enter details:
   - **Vendor**: Hotel, supplier, etc.
   - **Bill Date**: Date on bill
   - **Due Date**: Payment deadline
   - **Reference**: Supplier's invoice #
4. Add line items:
   - Description
   - Amount
   - Account (Expense category)
5. Click **Save**

**Automatic Inventory Tracking:**

When you create bills with products that have inventory tracking enabled, the system automatically manages stock levels:

**What Happens Automatically:**
1. **Draft/Pending Bill**: No inventory change
2. **Approved/Posted Bill**: 
   - Increases `quantity_on_hand` for each product
   - Updates product `cost_price` using weighted average method
   - Creates inventory movement record (type: "purchase")
   - Creates inventory lot for FIFO tracking
   - Records total cost and unit cost

**Example:**
```
Product: Coffee Beans
Stock before bill: 20 kg @ $5/kg (total value: $100)
Bill approved: Purchase 30 kg @ $6/kg
New stock: 50 kg
New weighted average cost: ($100 + $180) / 50 = $5.60/kg
```

**Weighted Average Cost Calculation:**
```
New Cost = (Old Qty × Old Cost + New Qty × New Cost) / Total Qty
         = (20 × $5 + 30 × $6) / 50
         = ($100 + $180) / 50
         = $5.60 per kg
```

**Important Notes:**
- Only affects products with "Track Inventory" enabled
- Service products and non-inventory items are not affected
- Bill approval automatically increases stock
- Cost price updates help track true product value
- FIFO lots created for first-in-first-out tracking
- Can view movement history in Inventory → Movements

**Bill Payment**
1. Open the bill
2. Click **Record Payment**
3. Select bank account
4. Enter payment date and amount
5. Click **Save**

### 5.5 Expenses

**Recording Direct Expenses**

1. Go to **Finance → Expenses**
2. Click **New Expense**
3. Fill in:
   - **Date**: When expense occurred
   - **Vendor**: Who you paid (optional)
   - **Category**: Fuel, Meals, Supplies, etc.
   - **Amount**: How much
   - **Payment Method**: How paid
   - **Bank Account**: Which account
   - **Description**: What it was for
4. **Attach Receipt**: Upload photo/PDF
5. Click **Save**

**Expense Categories:**
- Fuel & Transport
- Meals & Entertainment
- Office Supplies
- Utilities
- Marketing
- Repairs & Maintenance
- Insurance
- Professional Fees

**Best Practices:**
- Always attach receipts
- Use clear descriptions
- Categorize correctly for reports
- Submit expenses promptly

### 5.6 Journal Entries

**Manual Accounting Entries**

Use for:
- Depreciation
- Corrections
- Period adjustments
- Accruals

**Creating Journal Entry**
1. Go to **Finance → Journal Entries**
2. Click **New Entry**
3. Enter:
   - Date
   - Reference
   - Description
4. Add lines (must balance):
   - Account
   - Debit amount
   - Credit amount
5. Verify: Total Debits = Total Credits
6. Click **Save**

**Important:** Debits must equal credits!

---

## 6. HR & Payroll

### 6.1 Employee Management

**Adding a New Employee**

1. Go to **HR & Payroll → Employees**
2. Click **New Employee**
3. **Personal Information:**
   - First Name, Last Name
   - Date of Birth
   - National ID/Passport
   - Gender
   - Contact: Phone, Email, Address
4. **Employment Details:**
   - Employee Number (auto-generated)
   - Department
   - Position/Job Title
   - Hire Date
   - Employment Type (Full-time, Part-time, Contract)
5. **Salary Information:**
   - Basic Salary
   - Payment Frequency (Monthly, Bi-weekly)
   - Bank Account Details
6. **Allowances:**
   - Housing Allowance
   - Transport Allowance
   - Other Allowances
7. **Deductions:**
   - NSSF Contribution
   - PAYE Tax
   - Other Deductions
8. Click **Save**

**Employee Status:**
- **Active**: Currently employed
- **On Leave**: Temporary absence
- **Terminated**: No longer employed

### 6.2 Payroll Processing

**Running Monthly Payroll**

1. Go to **HR & Payroll → Payroll**
2. Click **New Pay Period**
3. Set period:
   - Start Date (e.g., Jan 1, 2026)
   - End Date (e.g., Jan 31, 2026)
   - Payment Date (e.g., Feb 5, 2026)
4. System automatically:
   - Lists all active employees
   - Calculates gross salary
   - Applies allowances
   - Calculates PAYE tax
   - Deducts NSSF
   - Calculates net pay
5. Review calculations
6. Click **Process Payroll**
7. Status changes to "Processed"

**After Processing:**
- Generate payslips
- Create payment journal entry
- Export for bank transfer

**Payroll Components:**

**Gross Pay = Basic Salary + Allowances**

**Statutory Deductions:**
- PAYE (Pay As You Earn Tax)
- NSSF (National Social Security Fund)
- NHIF (if applicable)

**Net Pay = Gross Pay - Deductions**

### 6.3 Payslips

**Generating Payslips**

1. Open processed payroll period
2. Select employee or "All Employees"
3. Click **Generate Payslips**
4. Actions available:
   - **View**: See payslip on screen
   - **Download PDF**: Save to computer
   - **Send Email**: Email to employee
   - **Print**: Print hard copy

**Payslip Contents:**
- Company details
- Employee details
- Pay period
- Earnings breakdown
- Deductions breakdown
- Net pay
- Payment date

**Bulk Actions:**
- Generate all payslips at once
- Email to all employees
- Download as ZIP file

### 6.4 Leave Management

**Requesting Leave**

1. Go to **HR & Payroll → Leave**
2. Click **New Leave Request**
3. Enter:
   - Employee
   - Leave Type (Annual, Sick, Unpaid)
   - Start Date
   - End Date
   - Number of Days
   - Reason
4. Click **Submit**

**Approving Leave**

1. View pending leave requests
2. Click request to review
3. Options:
   - **Approve**: Grant leave
   - **Reject**: Deny with reason
   - **Request Info**: Ask for details

**Leave Balance:**
- Track available days
- Carried forward days
- Used days
- Remaining balance

---

## 7. Fiscal Period Management

### 7.1 Overview

Fiscal Period Management allows administrators to close accounting periods (months, quarters, or years) to prevent unauthorized changes to historical financial data. This ensures data integrity and compliance with accounting standards.

**Key Features:**
- Close periods to lock historical transactions
- Prevent modifications to closed period data
- Reopen periods when corrections are needed (Admin only)
- Automatic validation when creating/editing transactions
- Visual status indicators (Open, Closed, Locked)

**Who Can Use This:**
- **Close Periods**: Admin only
- **Reopen Periods**: Admin only
- **View Periods**: All users

### 7.2 Accessing Fiscal Periods

1. Go to **Settings** in the sidebar
2. Click **Fiscal Periods** (with lock icon)
3. View the list of all fiscal periods

**Fiscal Period Structure:**
- **Annual Periods**: Full financial years (e.g., 2025, 2026)
- **Quarterly Periods**: Q1, Q2, Q3, Q4 for each year
- **Monthly Periods**: All 12 months for each year

### 7.3 Closing a Period

**When to Close Periods:**
- At month-end after all transactions are recorded and reconciled
- At quarter-end before filing quarterly reports
- At year-end before annual financial statement preparation
- When preparing audited financials

**Steps to Close a Period:**

1. Navigate to **Settings → Fiscal Periods**
2. Find the period you want to close (e.g., "December 2025" or "Q4 2025")
3. Verify the period status shows **Open** (green badge)
4. Click the **Close Period** button for that period
5. Confirm the action in the popup dialog
6. Period status changes to **Closed** (yellow badge)

**⚠️ Important Notes:**
- Only Admins can close periods
- Closing a period prevents ALL users (including Admins) from:
  - Creating new transactions dated in that period
  - Editing existing transactions in that period
  - Deleting transactions from that period
- Affected transaction types:
  - Invoices, Bills, Payments
  - Expenses
  - Journal Entries
  - Cafe Sales
  - Bank Transactions

**Best Practice:**
Close periods in order (close January before February, Q1 before Q2, etc.)

### 7.4 Reopening a Period

Sometimes you need to reopen a closed period to make corrections or add missing transactions.

**Steps to Reopen:**

1. Go to **Settings → Fiscal Periods**
2. Find the closed period (yellow **Closed** badge)
3. Click **Reopen Period**
4. Confirm the action
5. Period status changes to **Open** (green badge)

**When to Reopen:**
- Discovered accounting error in closed period
- Need to record a late transaction
- Auditor requested adjustments
- Bank reconciliation discrepancy found

**⚠️ Security Warning:**
Reopening periods should be rare and documented. Consider:
1. Document the reason for reopening
2. Make necessary corrections
3. Close the period again immediately
4. Update dependent periods if needed

### 7.5 Period Status Indicators

**🟢 Open** (Green Badge)
- Transactions can be created/edited/deleted
- Normal operations allowed
- Default state for current and future periods

**🟡 Closed** (Yellow Badge)
- No modifications allowed
- Data locked for historical accuracy
- Can be reopened by Admin if needed

**🔴 Locked** (Red Badge - Future Feature)
- Permanently locked
- Cannot be reopened
- Used for audited periods

### 7.6 Transaction Validation

When creating or editing a transaction, the system automatically checks if the period is closed:

**Error Message Example:**
```
Cannot create transaction: Period is closed
The fiscal period for January 2025 has been closed.
Only Admins can reopen periods to make changes.
```

**What to Do:**
1. **If the date is wrong**: Change the transaction date to an open period
2. **If the date is correct**: Contact your Admin to reopen the period
3. **If unsure**: Ask your accountant before proceeding

### 7.7 Common Workflows

**Month-End Close Process:**
1. Complete all bank reconciliations for the month
2. Review and approve all pending expenses
3. Verify all invoices and payments are recorded
4. Run Profit & Loss and Balance Sheet reports
5. Review for accuracy and completeness
6. Close the monthly period
7. Close the quarterly period (if last month of quarter)

**Year-End Close Process:**
1. Complete month-end close for December
2. Process year-end adjustments (depreciation, accruals)
3. Close all 12 monthly periods
4. Close all 4 quarterly periods
5. Run annual financial statements
6. Close the annual period
7. Begin new fiscal year

**Making Corrections to Closed Periods:**
1. Document the error and required correction
2. Admin reopens the affected period
3. Make ONLY the necessary corrections
4. Re-run affected reports to verify
5. Admin closes the period immediately
6. Update any dependent reports

### 7.8 Fiscal Period Calendar

**Typical Setup:**
- **Fiscal Year**: January 1 - December 31
- **Q1**: Jan-Mar
- **Q2**: Apr-Jun
- **Q3**: Jul-Sep
- **Q4**: Oct-Dec

**System Defaults:**
- New periods are created as "Open"
- Current period remains open
- Past periods should be progressively closed
- Future periods are typically left open for planning

### 7.9 Troubleshooting Period Issues

**Issue: Can't create an invoice**
- **Cause**: Invoice date falls in closed period
- **Solution**: Change invoice date OR have Admin reopen period

**Issue: "Period is closed" error on expense**
- **Cause**: Expense date is in a closed month
- **Solution**: Update expense date to current month OR get period reopened

**Issue: Need to edit closed period transaction**
- **Cause**: Period was closed after transaction creation
- **Solution**: Admin must reopen period temporarily

**Issue: Button says "Closed" but I need it open**
- **Cause**: Period was previously closed
- **Solution**: Click "Reopen Period" (Admin only)

### 7.10 Period Management Best Practices

✅ **Do:**
- Close periods promptly after month-end reconciliation
- Document reasons for reopening periods
- Close periods in chronological order
- Keep current month open until month-end
- Review transactions before closing

❌ **Don't:**
- Close the current period (locks ongoing work)
- Reopen periods without documentation
- Leave critical periods open indefinitely
- Skip period reviews before closing
- Close periods with unreconciled accounts

**Recommended Schedule:**
- **Weekly**: Review current month transactions
- **Monthly**: Close previous month by the 5th
- **Quarterly**: Close quarter within 10 days of quarter-end
- **Annually**: Close year by January 31st

---

## 9. Inventory & Assets

### 9.1 Product Management

**Adding a Product**

1. Go to **Inventory → Products**
2. Click **New Product**
3. Choose type:
   - **Inventory**: Physical goods
   - **Service**: Non-physical offerings
4. Fill in details:
   - Product Name
   - SKU (Stock Keeping Unit)
   - Category
   - Unit (pcs, kg, liters)
   - Cost Price
   - Selling Price
   - Reorder Point (minimum stock)
   - Supplier
5. Click **Save**

**Stock Tracking:**
- Current stock automatically updated
- View movement history
- Low stock alerts

### 7.2 Purchase Orders

**Creating a Purchase Order**

1. Go to **Inventory → Purchase Orders**
2. Click **New Purchase Order**
3. Select vendor
4. Add products:
   - Product name
   - Quantity needed
   - Unit price
   - Total
5. Review total amount
6. Click **Save**

**PO Workflow:**
1. **Draft**: Being prepared
2. **Submitted**: Sent to vendor
3. **Approved**: Management approved
4. **Partially Received**: Some items delivered
5. **Received**: All items delivered
6. **Cancelled**: Order cancelled

### 7.3 Goods Receipt

**Receiving Stock**

1. Go to **Inventory → Goods Receipts**
2. Click **New Receipt**
3. Select Purchase Order
4. System shows expected quantities
5. Enter actual received:
   - Quantity received
   - Condition notes
6. Click **Post Receipt**

**What Happens:**
- Inventory increases automatically
- PO status updates
- Can generate supplier bill

### 7.4 Stock Adjustments

**Adjusting Stock Levels**

1. Go to **Inventory → Adjustments**
2. Click **New Adjustment**
3. Select product
4. Enter:
   - Current quantity
   - New quantity (or adjustment amount)
   - Reason: Damage, Theft, Count Correction
   - Notes
5. Click **Save**

**Common Reasons:**
- Physical count variance
- Damage/spoilage
- Theft/loss
- Quality issues

### 7.5 Stock Takes

**Physical Inventory Count**

1. Go to **Inventory → Stock Takes**
2. Click **New Stock Take**
3. Select:
   - Location (warehouse)
   - Type: Full Count, Cycle Count, Spot Check
   - Date
4. System loads all products
5. Count physical stock:
   - Enter counted quantity
   - Add notes if variance
6. Review variances
7. Click **Approve**
8. System creates adjustments automatically

**Best Practices:**
- Count regularly (monthly/quarterly)
- Two-person verification
- Count during low activity
- Document variances

### 7.6 Fixed Assets

**Adding a Fixed Asset**

1. Go to **Assets → Fixed Assets**
2. Click **New Asset**
3. Enter:
   - Asset Name
   - Category (Vehicle, Equipment, Furniture)
   - Asset Tag/Number
   - Purchase Date
   - Purchase Price
   - Useful Life (years)
   - Residual Value
   - Depreciation Method
   - Current Location
4. Upload photos/documents
5. Click **Save**

**Depreciation Methods:**
- **Straight Line**: Equal amounts each period
- **Declining Balance**: Higher initially, decreases

**Asset Lifecycle:**
1. **Active**: In use
2. **Under Maintenance**: Being serviced
3. **Disposed**: Sold/scrapped
4. **Written Off**: Lost value

### 7.7 Asset Maintenance

**Scheduling Maintenance**

1. Go to **Assets → Maintenance**
2. Click **Schedule Maintenance**
3. Select asset
4. Enter:
   - Maintenance Type: Preventive, Corrective
   - Scheduled Date
   - Description
   - Expected Cost
   - Assigned To (employee or vendor)
5. Click **Save**

**After Completion:**
1. Open maintenance record
2. Click **Mark Complete**
3. Enter:
   - Actual date
   - Actual cost
   - Work performed
   - Next maintenance date
4. Click **Save**

### 7.8 Asset Assignment

**Assigning Asset to Employee**

1. Go to **Assets → Assignments**
2. Click **New Assignment**
3. Select:
   - Asset
   - Employee
   - Assignment Date
   - Expected Return Date
   - Condition: Excellent, Good, Fair, Poor
   - Purpose/Notes
4. Click **Save**

**Returning Asset:**
1. Open assignment
2. Click **Return Asset**
3. Enter:
   - Return date
   - Return condition
   - Notes
4. Click **Save**

---

## 10. Bank & Cash

### 8.1 Bank Accounts

**Setting Up Bank Account**

1. Go to **Bank & Cash → Bank Accounts**
2. Click **Add Account**
3. Enter:
   - Bank Name
   - Account Number
   - Account Type (Checking, Savings)
   - Currency
   - Opening Balance
   - Branch
4. Click **Save**

**Multiple Accounts:**
- Can have multiple bank accounts
- Different currencies supported
- Track each separately

### 8.2 Bank Transfers

**Transferring Between Accounts**

1. Go to **Bank & Cash → Transfers**
2. Click **New Transfer**
3. Enter:
   - From Account
   - To Account
   - Amount
   - Date
   - Reference
   - Description
4. Click **Save**

**What Happens:**
- Deducted from source account
- Added to destination account
- Creates journal entry automatically

### 8.3 Bank Transactions

**Importing Bank Statement**

1. Go to **Bank & Cash → Transactions**
2. Select bank account
3. Click **Import**
4. Upload CSV/Excel file
5. Map columns:
   - Date
   - Description
   - Amount
   - Reference
6. Click **Import**

**Manual Entry:**
1. Click **New Transaction**
2. Enter:
   - Date
   - Description
   - Debit or Credit
   - Amount
   - Category
3. Click **Save**

### 8.4 Bank Reconciliation

**Reconciling Bank Statement**

1. Go to **Bank & Cash → Reconciliation**
2. Select bank account
3. Enter statement details:
   - Statement Date
   - Ending Balance (per statement)
4. Match transactions:
   - ✅ Check items that appear on statement
   - System calculates difference
5. Investigate unmatched items:
   - Missing receipts
   - Timing differences
   - Errors
6. When balanced, click **Complete Reconciliation**

**Reconciliation Status:**
- **Green**: Balanced
- **Red**: Discrepancy
- Difference amount shown

---

## 11. Reports & Analytics

### 9.1 Financial Reports

**Profit & Loss Statement**

1. Go to **Reports → Profit & Loss**
2. Set date range
3. View:
   - Total Revenue
   - Cost of Goods Sold
   - Gross Profit
   - Operating Expenses
   - Net Profit/Loss
4. Export to PDF/Excel

**What It Shows:**
- How much money you made
- What you spent
- Final profit or loss

**Balance Sheet**

1. Go to **Reports → Balance Sheet**
2. Select date
3. View:
   - **Assets**: Cash, Inventory, Equipment
   - **Liabilities**: Loans, Payables
   - **Equity**: Capital, Retained Earnings
4. Export if needed

**What It Shows:**
- What you own (Assets)
- What you owe (Liabilities)
- Net worth (Equity)

**Cash Flow Statement**

1. Go to **Reports → Cash Flow**
2. Set date range
3. View:
   - Operating Activities
   - Investing Activities
   - Financing Activities
   - Net Cash Flow
4. Export if needed

### 9.2 Sales Reports

**Sales by Customer**
- Revenue per customer
- Top customers
- Outstanding balances

**Sales by Product**
- Best-selling items
- Revenue by product
- Profit margins

**Sales by Period**
- Daily, weekly, monthly sales
- Trends over time
- Year-over-year comparison

### 9.3 Expense Reports

**Expense by Category**
- Spending breakdown
- Compare to budget
- Identify high-cost areas

**Expense by Vendor**
- Top suppliers
- Payment history
- Outstanding bills

**Expense Trends**
- Monthly spending patterns
- Cost control analysis

### 9.4 Tour Reports

**Booking Report**
- Total bookings
- Revenue by tour package
- Occupancy rates
- Cancellation rates

**Customer Report**
- New vs returning customers
- Customer demographics
- Booking preferences

### 9.5 Payroll Reports

**Payroll Summary**
- Total payroll cost
- Department breakdown
- Tax summaries
- NSSF contributions

**Employee Earnings**
- Individual earnings
- Overtime analysis
- Allowances summary

### 9.6 Inventory Reports

**Stock Valuation**
- Current stock value
- By category
- By location

**Stock Movement**
- Items sold
- Items purchased
- Adjustments made
Financial Settings

**Accessing Financial Settings**

1. Go to **Settings**
2. Click **Financial** tab
3. Configure fiscal year, tax rates, and view Chart of Accounts

**Fiscal Year Settings**
- Set fiscal year start month (e.g., January)
- Default payment terms (e.g., 30 days)
- Default tax rate

**Chart of Accounts**

The Chart of Accounts is your complete list of account categories for financial transactions:

**Accessing:**
1. In Settings → Financial tab
2. Find "Chart of Accounts" section (green box)
3. Click **"View Chart"** button
4. Opens complete account reference page

**Features:**
- **Search**: Find accounts by number or name
- **Filter**: View by type (Assets, Expenses, Revenue, etc.)
- **Groups**: Accounts organized by category
- **Quick Reference**: Common account guides included

**Using Account Numbers:**

Every bill, expense, and transaction needs an account category. The Chart of Accounts shows all available accounts with their numbers:

**Example Accounts:**
- **5110** - Gorilla Permits Cost
- **6100** - Salaries & Wages
- **7510** - Fuel & Diesel
- **4110** - Safari Package Revenue

**When to Reference:**
- Creating bills (selecting expense account)
- Recording expenses (categorizing)
- Creating journal entries
- Understanding financial reports

**Multi-Currency Support**

**Base Currency:** USD (US Dollar)

**Additional Currencies:**
- EUR (Euro)
- GBP (British Pound)
- UGX (Ugandan Shilling)

**Exchange Rates:**
1. In Settings → Financial tab
2. Scroll to "Exchange Rates" section
3. Click **"Refresh Exchange Rates"** button
4. Fetches latest rates from exchangerate-api.com
5. Rates cached in database

**Using Multiple Currencies:**
- Create invoices in any currency
- Create bills in any currency
- System converts to base currency automatically
- Exchange rates applied at transaction time
- Change currency on forms - amounts convert automatically
- Financial reports show in base currency (USD)
- Exchange gains/losses tracked

**Currency Conversion:**
- Automatic when selecting products
- Manual currency change converts all line items
- Real-time exchange rates from API
- Historical rates preserved on transactions
- Book values
- By category

**Maintenance History**
- Maintenance costs
- By asset
- By period

---

## 12. System Settings

### 10.1 Company Settings

**Updating Company Information**

1. Go to **Settings → Company**
2. Edit:
   - Company Name
   - Address
   - Phone, Email
   - Tax ID
   - Logo
   - Fiscal Year Start
3. Click **Save**

### 10.2 Currency Settings

**Multi-Currency Setup**

1. Go to **Settings → Currencies**
2. Base currency is set (e.g., USD)
3. Add additional currencies:
   - Currency Code (EUR, UGX)
   - Exchange Rate
   - Update Date
4. Click **Save**

**Using Multiple Currencies:**
- Invoices can be in any currency
- System converts to base currency
- Exchange gains/losses tracked

### 10.3 Tax Settings

**Configuring Taxes**

1. Go to **Settings → Taxes**
2. Add tax rate:
   - Name (e.g., VAT 18%)
   - Rate (18.00)
   - Type (Sales Tax, VAT)
   - Account (Tax Payable)
3. Click **Save**

**AppWhat's the difference between an Invoice and a Receipt?**
A: An **Invoice** requests payment from customer. A **Receipt** proves payment was received. Create invoice first, then receipt when customer pays.

**Q: Can I create a receipt for a walk-in customer without an invoice?**
A: Yes! Create a standalone receipt. Leave the "Related Invoice Number" blank or enter an external reference. Add line items manually.

**Q: How do I link a receipt to an invoice?**
A: When creating a receipt, select the customer, then choose their unpaid invoice from the dropdown. System auto-fills all details from the invoice.

**Q: What happens when I create a receipt for an invoice?**
A: The invoice automatically updates: amount_paid increases, status changes to "Partial" or "Paid", and the invoice balance adjusts.

**Q: Which account number do I use for expenses?**
A: Go to **Settings → Financial → View Chart** to see all accounts. Search by description (e.g., "fuel" shows 7510). Use the most specific account available.

**Q: How do I find the right account number?**
A: Open the Chart of Accounts from Settings. Search for keywords or browse by category. Common accounts are listed in the quick reference guide.

**Q: Can I record partial payments?**
A: Yes! For invoices: use "Record Payment" and enter partial amount. For receipts: enter the amount paid when creating the receipt. System tracks balance automatically.

**Q: How do I handle refunds?**
A: Create a Credit Note for the invoice amount, then create a payment (negative amount) from the customer's account.

**Q: Can I edit an invoice after it's sent?**
A: You cannot edit a sent invoice. Instead, void it and create a new one, or create a credit note for adjustments.

**Q: How do I track cash in hand?**
A: Set up a "Petty Cash" bank account. Record cash receipts and expenses through this account. Reconcile regularly.

**Q: What if I make a mistake in accounting?**
A: Contact your accountant or admin. They can create correcting journal entries. Never delete posted transactions.

**Q: How often should I reconcile bank accounts?**
A: Best practice is monthly, but weekly is even better. This helps catch errors early.

**Q: What's a journal entry and when do I need it?**
A: A journal entry is a manual accounting record. Use for depreciation, corrections, or complex transactions not covered by standard forms.

**Q: Why can't I pay more than the balance due?**
A: System prevents overpayment for accuracy. If you need to pay more, create a separate transaction for the additional amount.

**Q: How does multi-currency work?**
A: Select currency when creating invoices/bills. System uses real-time exchange rates to convert. Reports show in base currency (USD). Can change currency mid-entry - amounts convert automatically.

**Q: Where do exchange rates come from?**
A: From exchangerate-api.com. Refresh rates in Settings → Financial. Rates update automatically but you can manually refresh anytime

### 10.5 User Management

**Adding a User**

1. Go to **Settings → Users**
2. Click **New User**
3. Enter:
   - Name
   - Email
   - Role (Admin, Manager, Accountant, Viewer)
   - Password (temporary)
4. Click **Send Invitation**

**Managing Permissions:**
- Each role has predefined permissions
- Can customize per user
- Audit log tracks user actions

### 10.6 Email Settings

**Configuring Email**

1. Go to **Settings → Email**
2. Enter SMTP details:
   - Server
   - Port
   - Username
   - Password
3. Set email templates
4. Test configuration
5. Click **Save**

**Email Templates:**
- Invoice emails
- Receipt confirmations
- Payslip emails
- Booking confirmations

### 10.7 Backup & Security

**Data Backup**
- System backs up daily automatically
- Download backup anytime
- Restore from backup if needed

**Security Best Practices:**
- Use strong passwords
- Change passwords regularly
- Enable two-factor authentication
- Log out when done
- Don't share credentials

---

## 13. Common Questions & Answers

### General Questions

**Q: Can I access the system from my phone?**
A: Yes! The system is fully responsive and works on any device with a web browser - desktop, tablet, or smartphone.

**Q: What if I forget my password?**
A: Click "Forgot Password" on the login page. Enter your email and you'll receive a password reset link.

**Q: Can multiple people use the system at the same time?**
A: Yes, unlimited concurrent users can access the system simultaneously.

**Q: Is my data secure?**
A: Yes. The system uses Row-Level Security (RLS) to control access at the database level. Data is encrypted, backed up daily, and stored securely. Only users with appropriate roles can access sensitive information like payroll, bank accounts, and employee personal data.

**Q: What are user roles and what can each role do?**
A: The system has 5 roles:
- **Admin**: Full access to everything including user management and period locking
- **Accountant**: All financial data including payroll, bank accounts, and bills
- **Operations**: Bookings, inventory, assets, and vendor management
- **Sales**: Customers, invoices, bookings (no access to payroll or bank accounts)
- **Guide**: Read-only access to assigned tours and bookings

**Q: Can I change my own role?**
A: No. Only Admins can change user roles through Settings → Users.

**Q: Can I customize the system?**
A: Yes. You can customize company settings, create custom fields, and configure workflows to match your business.

---

### Finance Questions

**Q: How do I know if an invoice has been paid?**
A: Go to Invoices and check the status column. "Paid" means fully paid, "Partially Paid" means some payment received, and you can click to see payment history.

**Q: What's the difference between a Bill and an Expense?**
A: A **Bill** is from a supplier/vendor (they sent you an invoice). An **Expense** is a direct payment you made (like fuel or meals). Both are expenses, but bills have a payment process.

**Q: How do I handle refunds?**
A: Create a Credit Note for the invoice amount, then create a payment (negative amount) from the customer's account.

**Q: Can I edit an invoice after it's sent?**
A: You cannot edit a sent invoice. Instead, void it and create a new one, or create a credit note for adjustments.

**Q: How do I track cash in hand?**
A: Set up a "Petty Cash" bank account. Record cash receipts and expenses through this account. Reconcile regularly.

**Q: What if I make a mistake in accounting?**
A: Contact your accountant or admin. They can create correcting journal entries. Never delete posted transactions.

**Q: How often should I reconcile bank accounts?**
A: Best practice is monthly, but weekly is even better. This helps catch errors early.

**Q: What's a journal entry and when do I need it?**
A: A journal entry is a manual accounting record. Use for depreciation, corrections, or complex transactions not covered by standard forms.

**Q: What does "Period is closed" mean?**
A: This means the fiscal period (month, quarter, or year) has been locked to prevent changes. You cannot create or edit transactions dated in a closed period. Contact your Admin if you need the period reopened.

**Q: How do I close a month or quarter?**
A: Only Admins can close periods. Go to Settings → Fiscal Periods, find the period, and click "Close Period". This locks all transactions in that period to prevent accidental changes.

**Q: Can I reopen a closed period?**
A: Yes, but only Admins can reopen periods. This should be done carefully and documented. After making corrections, the period should be closed again immediately.

**Q: Why can't I edit an old invoice?**
A: If the invoice date falls in a closed fiscal period, you cannot edit it. This is intentional to maintain historical accuracy. If you need to make changes, ask your Admin to reopen the period.

**Q: I'm getting a "Cannot create transaction" error. Why?**
A: Check the transaction date. If it's in a closed period, change the date to an open period or contact your Admin to reopen the period temporarily.

---

### Tour Operations Questions

**Q: Can I block dates when vehicles are unavailable?**
A: Yes. Go to Fleet, select the vehicle, and add maintenance/unavailability periods. The system will show the vehicle as unavailable during those dates.

**Q: How do I handle group bookings?**
A: Create one booking and set the number of travelers. You can add multiple guests with their individual details.

**Q: Can I create custom tour packages?**
A: Yes. You can create unlimited tour packages with different durations, prices, and itineraries.

**Q: What if a customer wants to change their booking date?**
A: Open the booking, click "Modify", change the dates, and save. The invoice will update automatically if pricing changes.

**Q: How do I track tour guide assignments?**
A: Add employees as tour guides, then assign them to bookings under the "Assignments" section.

**Q: Can I send booking confirmations automatically?**
A: Yes. Enable automatic emails in Settings. Confirmations will be sent when bookings are created or modified.

---

### Payroll Questions

**Q: How is PAYE tax calculated?**
A: PAYE is calculated based on Uganda's tax bands. The system uses the official URA tax tables and calculates automatically.

**Q: Can I process payroll for contractors?**
A: Yes. Add them as employees with employment type "Contract" and configure their payment terms.

**Q: What if an employee is on leave during payroll?**
A: If unpaid leave, reduce their salary manually for that period. If paid leave, process payroll normally - their salary continues.

**Q: How do I handle salary advances?**
A: Record it as a deduction in that month's payroll, or create a loan that deducts monthly until repaid.

**Q: Can I print payslips in bulk?**
A: Yes. Select all employees and click "Download All Payslips". You'll get a PDF with all payslips combined.

**Q: What if there's an error in processed payroll?**
A: Contact your admin immediately. They may need to reverse the payroll and reprocess. Don't try to fix it yourself.

**Q: How do I track overtime?**
A: Add overtime as an allowance in the employee's payroll record for that period.

**Q: Why can't I see payroll information?**
A: Payroll data is restricted to Admin and Accountant roles only for privacy and security. If you need access, contact your Admin to review your role assignment.

---

### Permission & Access Questions

**Q: I can't create/edit a record. What's wrong?**
A: Check your user role. Different roles have different permissions:
- Sales users cannot access payroll or bank accounts
- Operations users cannot manage bills or journal entries  
- Only Accountants and Admins can access full financial data
- Contact your Admin if you need additional permissions

**Q: Why can't I see certain reports?**
A: Report access is role-based. Financial reports require Accountant or Admin role. If you need access, your Admin can upgrade your role.

**Q: Can I view other people's expenses?**
A: Yes, all users can view all expenses (unless department filtering is applied). However, only Accountants and Admins can approve/reject expenses.

**Q: I used to be able to do something, but now I can't. Why?**
A: The system recently implemented Row-Level Security (RLS). Your Admin may need to review and update your role to ensure appropriate access.

**Q: What's the difference between closing a period and restricting access?**
A: Period locking prevents everyone (including Admins) from modifying historical data. Role-based permissions control what types of data users can access in any period.

---

### Inventory Questions

**Q: How often should I do stock takes?**
A: Monthly for high-value items, quarterly for others. More frequent counts give better accuracy.

**Q: What's the difference between a stock adjustment and stock take?**
A: A **stock adjustment** is for one or a few items. A **stock take** is a full physical count of all inventory.

**Q: Can the system alert me when stock is low?**
A: Yes. Set reorder points for each product. You'll get alerts when stock falls below that level.

**Q: How do I handle damaged/expired goods?**
A: Create a stock adjustment with reason "Damage" or "Expired". This reduces stock and records the loss.

**Q: Can I track inventory in multiple warehouses?**
A: Yes. Set up multiple locations and assign stock to each. Track transfers between locations.

**Q: What if a supplier delivers less than ordered?**
A: When receiving, enter the actual quantity received. The PO will show as "Partially Received" until complete.

---

### Asset Questions

**Q: What's the difference between depreciation methods?**
A: **Straight Line** = same amount each year. **Declining Balance** = more initially, less later. Most businesses use straight line.

**Q: How often is depreciation calculated?**
A: Monthly, automatically. Run the depreciation API at month-end to generate entries.

**Q: Can I change an asset's useful life?**
A: Yes, but this requires a journal entry to adjust. Consult your accountant.

**Q: What happens when an asset is fully depreciated?**
A: It stays in the system at its residual value (salvage value). You can still use it, but no more depreciation.

**Q: How do I record selling an asset?**
A: Create a journal entry: Debit Cash (sale price), Credit Asset (book value), and the difference goes to Gain/Loss on Sale.

**Q: Should I track small items like staplers?**
A: No. Only track significant assets (usually over $500-1000). Small items are office expenses.

---

### Reporting Questions

**Q: Can I export reports to Excel?**
A: Yes. Most reports have an "Export" button that downloads to Excel or CSV format.

**Q: How do I share reports with management?**
A: Export to PDF and email, or give them viewer access to see reports online.

**Q: Can I compare this year to last year?**
A: Yes. Most reports let you select comparative periods. Set both date ranges and view side-by-side.

**Q: What's the most important report to review regularly?**
A: **Profit & Loss** (monthly), **Cash Flow** (weekly), and **Balance Sheet** (quarterly) are essential.

**Q: Why don't my numbers match my expectations?**
A: Check: (1) Date ranges are correct, (2) All transactions are posted, (3) Bank reconciliation is done, (4) No pending approvals.

**Q: Can I schedule reports to email automatically?**
A: Yes. Set up scheduled reports in Settings to email daily, weekly, or monthly.

---

### Technical Questions

**Q: What browsers are supported?**
A: Chrome, Firefox, Safari, and Edge (latest versions). Chrome recommended for best performance.

**Q: Why is the system slow?**
A: Check your internet connection. Clear browser cache. If problem persists, contact support.

**Q: Can I undo an action?**
A: Some actions like creating drafts can be deleted. Posted transactions cannot be deleted - use reversals instead.

**Q: How do I upload files?**
A: Look for "Attach" or "Upload" buttons. Drag and drop also works. Max file size is usually 10MB.

**Q: What file formats are supported for import?**
A: CSV and Excel (.xlsx) for data imports. PDF and images for attachments.

**Q: Can I use the system offline?**
A: No, internet connection is required. However, data is cached so brief disconnections won't lose your work.

---

## 14. Troubleshooting

### Common Issues & Solutions

**Problem: Can't log in**
- **Solution**: Check email is correct, password is case-sensitive, try password reset, clear browser cache

**Problem: Numbers don't add up**
- **Solution**: Run bank reconciliation, check for duplicate entries, verify date ranges, ensure all transactions are posted

**Problem: Invoice won't save**
- **Solution**: Check all required fields are filled, ensure customer is selected, verify line items have amounts, check network connection

**Problem: Report is blank**
- **Solution**: Verify date range includes data, check filters aren't too restrictive, ensure transactions are posted, refresh page

**Problem: Can't find a transaction**
- **Solution**: Check you're in the right section (invoice vs bill vs expense), use search function, verify date range, check if it was deleted

**Problem: Email not sending**
- **Solution**: Verify email settings in Settings → Email, check recipient email is correct, check spam folder, test email configuration

**Problem: Payroll totals seem wrong**
- **Solution**: Verify all employees are active, check tax settings are correct, ensure allowances/deductions are configured, review individual payslip calculations

**Problem: Stock levels don't match physical count**
- **Solution**: Do a stock take, check for unposted receipts, review recent adjustments, look for duplicate transactions

**Problem: Can't delete a record**
- **Solution**: You may lack permission, record may be referenced elsewhere, try voiding instead, contact admin if needed

**Problem: System is slow**
- **Solution**: Check internet speed, close unused browser tabs, clear browser cache, try different browser, report to support if persists

---

### Getting Help

**In-System Help**
- Look for **?** icons for context help
- Hover over field labels for tooltips
- Check error messages for guidance

**Contact Support**
- Email: support@brecosafaris.com
- Phone: +256 782 884 933
- Include: Your name, screenshot of issue, steps to reproduce

**Training & Resources**
- This user guide
- Video tutorials (if available)
- Request on-site training
- Schedule remote training sessions

---

## Best Practices Summary

### Daily Tasks
✅ Record all cash/bank transactions  
✅ Process customer payments received  
✅ Create invoices for completed work  
✅ Review dashboard for alerts  
✅ Check upcoming tour bookings

### Weekly Tasks
✅ Review outstanding invoices  
✅ Pay supplier bills due  
✅ Reconcile main bank account  
✅ Review low stock alerts  
✅ Update booking confirmations

### Monthly Tasks
✅ Process payroll  
✅ Generate and send payslips  
✅ Reconcile all bank accounts  
✅ Run depreciation  
✅ Review financial reports  
✅ Do stock take (if scheduled)  
✅ Review expense reports  
✅ Archive completed tours

### Quarterly Tasks
✅ Full inventory count  
✅ Review asset register  
✅ Deep clean old records  
✅ Review user permissions  
✅ Tax return preparation  
✅ Budget vs actual analysis

### Annually
✅ Year-end closing  
✅ Annual depreciation review  
✅ Employee performance reviews  
✅ Update salary scales  
✅ Archive old financial data  
✅ System backup verification  
✅ Insurance renewals  
✅ License renewals

---

## Data Entry Standards

### Naming Conventions
- **Customers**: First Name Last Name (John Smith)
- **Products**: Descriptive name (5-Day Masai Mara Safari)
- **References**: Prefix-Number (INV-00123, PO-00045)
- **Descriptions**: Clear and concise, avoid jargon

### Date Formats
- System displays: Jan 15, 2026 (or based on settings)
- Always use actual transaction dates
- For recurring items, use the date it actually occurred

### Currency & Numbers
- Always specify currency
- Use decimal points (1234.56)
- Don't use currency symbols in amount fields
- System formats automatically

### Attachments
- Use clear file names
- Include date if relevant
- Keep files under 10MB
- Supported: PDF, JPG, PNG, Excel

---

## Security & Compliance

### Password Requirements
- Minimum 8 characters
- Include uppercase, lowercase, number
- Change every 90 days
- Never share passwords

### Data Privacy
- Only access data you need
- Don't share customer information
- Log out when leaving computer
- Report suspicious activity

### Audit Trail
- All actions are logged
- Can't be deleted
- Admins can review activity
- Used for compliance

### Backup & Recovery
- Automatic daily backups
- Can restore to any point
- Keep offline backups too
- Test restore procedures

---

## Keyboard Shortcuts

**General**
- `Ctrl + S` - Save
- `Ctrl + F` - Search
- `Esc` - Close modal
- `Tab` - Next field

**Navigation**
- `Alt + D` - Dashboard
- `Alt + I` - Invoices
- `Alt + E` - Expenses
- `Alt + R` - Reports

**Forms**
- `Ctrl + Enter` - Save and close
- `Alt + N` - New line item
- `Alt + S` - Save draft

---

## Glossary of Terms

**Accounts Payable**: Money you owe to suppliers  
**Accounts Receivable**: Money customers owe you  
**Accrual**: Recording income/expense when earned/incurred, not when cash moves  
**Assets**: Things of value you own  
**Chart of Accounts**: List of all accounts in your accounting system  
**Credit Note**: Refund document reducing amount owed  
**Depreciation**: Spreading asset cost over its useful life  
**Equity**: Owner's investment plus retained profits  
**Fiscal Year**: Your accounting year (may differ from calendar year)  
**Journal Entry**: Manual accounting record  
**Liabilities**: Debts and obligations  
**Net Income**: Profit after all expenses  
**PAYE**: Pay As You Earn tax (income tax)  
**Purchase Order**: Document ordering goods from supplier  
**Reconciliation**: Matching your records to bank statements  
**Revenue**: Income from sales  
**Trial Balance**: Report showing all account balances  
**Variance**: Difference between expected and actual

---

## Conclusion

This comprehensive guide covers the essential operations of the Breco Safaris Operations & Finance System. Remember:

1. **Start Simple**: Master basic functions before advanced features
2. **Stay Organized**: Regular data entry prevents backlogs
3. **Verify Everything**: Double-check before finalizing transactions
4. **Ask for Help**: Contact support when unsure
5. **Keep Learning**: System evolves with new features

**Regular use and practice will make you proficient!**

For additional assistance, training, or questions not covered here, please contact:

**Breco Safaris Support Team**  
Email: support@brecosafaris.com  
Phone: +256 782 884 933  
Address: Buzzi Close Kajjansi, Entebbe Road, Kampala

---

**Document Version**: 1.0  
**Last Updated**: January 5, 2026  
**Next Review**: July 2026

**© 2026 Breco Safaris Ltd. All rights reserved.**

# Breco Safaris Operations & Finance System
## Complete User Guide

**Version:** 1.1  
**Last Updated:** January 9, 2026  
**System:** Breco Safaris Management Platform

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Dashboard Overview](#3-dashboard-overview)
4. [Tour Operations](#4-tour-operations)
5. [Finance Management](#5-finance-management)
6. [HR & Payroll](#6-hr--payroll)
7. [Inventory & Assets](#7-inventory--assets)
8. [Bank & Cash](#8-bank--cash)
9. [Reports & Analytics](#9-reports--analytics)
10. [System Settings](#10-system-settings)
11. [Common Questions & Answers](#11-common-questions--answers)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Introduction

### 1.1 What is Breco Safaris System?

Breco Safaris Operations & Finance System is a comprehensive business management platform designed specifically for tour and safari operations. It integrates:

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

### 2.2 Understanding User Roles

**Admin**
- Full system access
- Can create/edit all records
- Manage users and settings
- Access all reports

**Manager**
- View and create most records
- Cannot delete major transactions
- Limited settings access
- Full reporting access

**Accountant**
- Finance module access
- Create invoices, bills, expenses
- Bank reconciliation
- Financial reports

**Viewer**
- Read-only access
- View reports and dashboards
- Cannot create or edit records

### 2.3 Navigation Basics

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

## 4. Tour Operations

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

### 4.2 Bookings

The booking system handles all types of reservations in one unified interface:
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
- **Inquiry**: Initial customer inquiry
- **Quote Sent**: Quotation sent to customer
- **Confirmed**: Booking confirmed by customer
- **Deposit Paid**: Partial payment received
- **Fully Paid**: Complete payment received
- **In Progress**: Service is ongoing
- **Completed**: Service finished
- **Cancelled**: Booking cancelled
- **Refunded**: Payment refunded

**Viewing Booking Details**

Click any booking to see:
- **Tour bookings**: Package details, itinerary, duration, travelers
- **Hotel bookings**: Hotel name, star rating, room type, number of rooms
- **Car hire**: Vehicle type, registration, rental type, pickup/dropoff locations
- **Custom bookings**: Combined hotel and vehicle information

**Booking Actions**
- **Convert to Invoice**: Generate invoice for payment
- **Send Confirmation**: Email booking details
- **Modify**: Change dates or details
- **Change Status**: Update booking status
- **Cancel**: Cancel booking (with reason)
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

## 5. Finance Management

### 5.1 Chart of Accounts

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

**Tips:**
- Always attach booking reference
- Use clear descriptions
- Set realistic payment terms
- Follow up on overdue invoices

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

## 7. Inventory & Assets

### 7.1 Product Management

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

## 8. Bank & Cash

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

## 9. Reports & Analytics

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

## 10. System Settings

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

## 11. Common Questions & Answers

### General Questions

**Q: Can I access the system from my phone?**
A: Yes! The system is fully responsive and works on any device with a web browser - desktop, tablet, or smartphone.

**Q: What if I forget my password?**
A: Click "Forgot Password" on the login page. Enter your email and you'll receive a password reset link.

**Q: Can multiple people use the system at the same time?**
A: Yes, unlimited concurrent users can access the system simultaneously.

**Q: Is my data secure?**
A: Yes. Data is encrypted, backed up daily, and stored securely. Only authorized users can access your information.

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

## 12. Troubleshooting

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

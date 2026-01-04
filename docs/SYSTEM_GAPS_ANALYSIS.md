# System Gaps and Missing Functionalities Analysis

## Date: January 4, 2026

This document identifies remaining gaps, incomplete features, and missing functionalities in the Breco Safaris financial system after implementing inventory and booking tracking.

---

## CRITICAL GAPS (High Priority - Core Functionality Missing)

### 1. ❌ Customer Payment Recording (Receipts API)

**Status:** MISSING - Critical gap in AR workflow

**Current Situation:**
- Table `payments_received` exists in database
- Table `payment_applications` exists to link payments to invoices
- **Only Stripe webhook creates payment records**
- No manual way to record cash, check, or bank transfer payments

**Impact:**
- Cannot record non-Stripe customer payments
- AR (Accounts Receivable) workflow is incomplete
- Manual cash/check payments cannot be tracked
- Bank deposits cannot be recorded against invoices

**What's Needed:**
```
POST /api/receipts - Record customer payment
- Create payments_received record
- Create payment_applications to apply to invoices
- Update invoice amount_paid and status
- Create journal entry (Debit: Cash/Bank, Credit: AR)
- Update customer balance via existing trigger

GET /api/receipts - List all customer payments
GET /api/receipts/[id] - Get payment details
DELETE /api/receipts/[id] - Void payment (with proper reversals)
```

**Database Support:** ✅ Already exists
**Trigger Support:** ✅ Customer balance trigger exists (migration 025)
**Journal Entry Helper:** ✅ `createReceiptJournalEntry()` exists

**Why This Matters:**
Without this, companies that accept cash/check payments have no way to record them. This is a fundamental accounting feature.

---

### 2. ❌ Expense Approval Workflow

**Status:** PARTIALLY IMPLEMENTED - Status field exists but no approval API

**Current Situation:**
- Expenses have `status` field (pending, approved, paid, rejected)
- No API endpoint for managers to approve/reject expenses
- Status changes happen manually via database or generic PATCH
- No approval history or audit trail
- No approval notifications

**Impact:**
- No formal approval process
- Cannot track who approved expenses
- Cannot prevent unauthorized expense payments
- No workflow for expense reimbursements

**What's Needed:**
```
POST /api/expenses/[id]/approve - Approve expense
- Change status from 'pending' to 'approved'
- Record approver_id and approval_date
- Trigger notification to requester
- Create journal entry if auto-posting enabled

POST /api/expenses/[id]/reject - Reject expense
- Change status to 'rejected'
- Record rejection reason
- Notify requester

POST /api/expenses/[id]/pay - Mark as paid
- Change status to 'paid'
- Create journal entry for payment
- Update bank account balance
```

**Database Changes Needed:**
```sql
ALTER TABLE expenses
ADD COLUMN approved_by UUID REFERENCES user_profiles(id),
ADD COLUMN approved_at TIMESTAMPTZ,
ADD COLUMN rejected_by UUID REFERENCES user_profiles(id),
ADD COLUMN rejected_at TIMESTAMPTZ,
ADD COLUMN rejection_reason TEXT;
```

---

### 3. ❌ Bank Reconciliation System

**Status:** FIELD EXISTS - No reconciliation workflow or UI

**Current Situation:**
- `bank_transactions` table has `is_reconciled` boolean field
- No reconciliation API or workflow
- No way to match transactions to statements
- Cannot mark transactions as cleared
- No reconciliation reports

**Impact:**
- Cannot reconcile bank accounts
- Cannot identify missing transactions
- Cannot detect errors or fraud
- Bank balances may not match actual balances

**What's Needed:**
```
POST /api/bank-reconciliation/[bank_account_id] - Start reconciliation
- Create reconciliation record
- Capture statement ending balance
- Capture statement date

POST /api/bank-reconciliation/[id]/match - Match transaction
- Mark transaction as reconciled
- Link to reconciliation session

POST /api/bank-reconciliation/[id]/complete - Complete reconciliation
- Verify reconciled balance matches statement
- Lock reconciled transactions
- Generate reconciliation report

GET /api/bank-reconciliation/[bank_account_id] - Get reconciliation status
```

**Database Changes Needed:**
```sql
CREATE TABLE bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id UUID REFERENCES bank_accounts(id),
  reconciliation_date DATE NOT NULL,
  statement_ending_balance DECIMAL(15,2) NOT NULL,
  statement_date DATE NOT NULL,
  reconciled_balance DECIMAL(15,2),
  difference DECIMAL(15,2),
  status VARCHAR(20) DEFAULT 'in_progress',
  completed_by UUID REFERENCES user_profiles(id),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reconciliation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reconciliation_id UUID REFERENCES bank_reconciliations(id),
  transaction_id UUID REFERENCES bank_transactions(id),
  matched_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## MODERATE GAPS (Important - Partial Implementation)

### 4. ⚠️ Automated Depreciation Posting

**Status:** CALCULATIONS EXIST - No automated posting

**Current Situation:**
- `calculateMonthlyDepreciation()` function exists in `src/lib/accounting/assets.ts`
- Depreciation report can calculate depreciation
- No scheduled job to post monthly depreciation
- No API endpoint to manually post depreciation
- Depreciation journal entries must be created manually

**Impact:**
- Depreciation not reflected in monthly financials until manually posted
- Accumulated depreciation not automatically updated
- Book values become inaccurate over time

**What's Needed:**
```
POST /api/assets/depreciation/post - Post monthly depreciation
- Calculate depreciation for all active assets
- Create journal entries (Debit: Depreciation Expense, Credit: Accumulated Depreciation)
- Update accumulated_depreciation on each asset
- Record posting in depreciation_history table

GET /api/assets/depreciation/preview - Preview next month's depreciation
- Calculate what will be posted
- Show which assets will be affected

Scheduled Job:
- Run on 1st of each month
- Auto-post depreciation if setting enabled
```

**Database Changes Needed:**
```sql
CREATE TABLE depreciation_postings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  posting_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_depreciation DECIMAL(15,2) NOT NULL,
  assets_count INTEGER NOT NULL,
  journal_entry_id UUID REFERENCES journal_entries(id),
  posted_by UUID REFERENCES user_profiles(id),
  posted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE depreciation_posting_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  posting_id UUID REFERENCES depreciation_postings(id),
  asset_id UUID REFERENCES assets(id),
  depreciation_amount DECIMAL(15,2) NOT NULL,
  accumulated_before DECIMAL(15,2) NOT NULL,
  accumulated_after DECIMAL(15,2) NOT NULL
);
```

---

### 5. ⚠️ Payroll Processing System

**Status:** SCHEMA EXISTS - Limited API implementation

**Current Situation:**
- Database tables exist: `payroll_periods`, `payslips`
- Only `/api/payroll/[id]` route exists (single payroll retrieval)
- No API to:
  - Create payroll periods
  - Generate payslips
  - Process payroll
  - Post payroll journal entries
  - Generate payroll reports

**Impact:**
- Cannot run payroll through the system
- Manual payroll processing required
- No payroll history tracking
- Payroll expenses not automatically recorded

**What's Needed:**
```
POST /api/payroll/periods - Create payroll period
GET /api/payroll/periods - List payroll periods
GET /api/payroll/periods/[id] - Get period details

POST /api/payroll/periods/[id]/generate - Generate payslips
- Create payslip for each active employee
- Calculate gross pay, deductions, net pay
- Create status: 'draft'

POST /api/payroll/periods/[id]/process - Process payroll
- Validate all payslips
- Create journal entries
- Update payroll_periods.status to 'processed'
- Generate payment files/reports

POST /api/payroll/payslips/[id] - Update individual payslip
DELETE /api/payroll/payslips/[id] - Delete payslip (if period not processed)
```

**Journal Entry Required:**
```
Debit: Salary Expense
Debit: Benefits Expense
Debit: Employer Tax Expense
Credit: Payroll Payable (net pay)
Credit: Tax Payable (employee taxes)
Credit: Benefits Payable (employee deductions)
```

---

### 6. ⚠️ Expense Individual Update/Delete

**Status:** NO DETAIL ENDPOINT

**Current Situation:**
- `/api/expenses` POST and GET exist
- No `/api/expenses/[id]` route
- Cannot update individual expense
- Cannot delete expense
- Cannot change expense status

**What's Needed:**
```
GET /api/expenses/[id] - Get expense details
PATCH /api/expenses/[id] - Update expense
DELETE /api/expenses/[id] - Delete expense
```

---

## MINOR GAPS (Nice to Have - Enhanced Functionality)

### 7. 📋 Invoice Credit Notes/Refunds

**Status:** NOT IMPLEMENTED

**What's Missing:**
- No credit note functionality
- Cannot issue refunds against invoices
- Cannot handle sales returns
- No negative invoices

**Suggested Implementation:**
- Add `document_type = 'credit_note'` to invoices table
- Credit notes reference original invoice
- Restore inventory on credit note posting
- Create reversing journal entry

---

### 8. 📋 Purchase Returns (Credit from Vendor)

**Status:** NOT IMPLEMENTED

**What's Missing:**
- No way to return purchased items to vendors
- Cannot get credit from vendors
- Bill payments cannot be negative

**Suggested Implementation:**
- Vendor credit notes table
- Reference original bill
- Reduce inventory on return
- Create reversing journal entry

---

### 9. 📋 Budget Tracking

**Status:** NOT IMPLEMENTED

**What's Missing:**
- No budget tables
- Cannot set budgets by account/department
- Cannot track budget vs actual
- No budget variance reports

---

### 10. 📋 Multi-Step Invoice Approval

**Status:** SIMPLE STATUS ONLY

**Current Situation:**
- Invoices have simple status (draft, sent, paid)
- No approval workflow for quotes
- No manager review before sending
- No approval hierarchy

---

### 11. 📋 Vendor Payment Batching

**Status:** INDIVIDUAL PAYMENTS ONLY

**Current Situation:**
- Bill payments are individual
- No way to batch multiple vendor payments
- No payment run functionality
- No batch payment file generation

---

### 12. 📋 Recurring Transactions

**Status:** TABLES EXIST - No automation

**Database:**
- `recurring_transactions` table exists
- `recurring_frequency` enum exists
- No scheduled job to create transactions
- No API to manage recurring transactions

---

## RECOMMENDATIONS BY PRIORITY

### 🔴 IMMEDIATE (Must Have - Core Accounting)
1. **Customer Payment Recording (Receipts API)** - Cannot operate without this
2. **Expense Approval Workflow** - Critical for expense management
3. **Expense Detail API** - Need PATCH/DELETE for individual expenses

### 🟡 HIGH PRIORITY (1-2 Months)
4. **Bank Reconciliation** - Critical for month-end closing
5. **Automated Depreciation Posting** - Needed for accurate financials
6. **Payroll Processing API** - If company pays employees through system

### 🟢 MEDIUM PRIORITY (3-6 Months)
7. **Credit Notes/Refunds** - Handle customer returns
8. **Purchase Returns** - Handle vendor returns
9. **Recurring Transactions Automation** - Reduce manual work

### 🔵 LOW PRIORITY (Future Enhancements)
10. **Budget Tracking** - Advanced planning feature
11. **Invoice Approval Workflow** - Process improvement
12. **Vendor Payment Batching** - Efficiency improvement

---

## IMPLEMENTATION ESTIMATE

### Phase 1: Critical Gaps (2-3 weeks)
- Customer Payment Recording API: 3-4 days
- Expense Approval Workflow: 2-3 days
- Expense Detail API: 1 day

### Phase 2: Core Features (3-4 weeks)
- Bank Reconciliation: 5-7 days
- Automated Depreciation: 3-4 days
- Payroll Processing: 7-10 days

### Phase 3: Enhancements (4-6 weeks)
- Credit Notes: 3-4 days
- Purchase Returns: 3-4 days
- Recurring Transactions: 4-5 days

---

## ARCHITECTURE NOTES

### Patterns to Follow:
1. **Server-side helpers** (like inventory-server.ts)
2. **Journal entry helpers** (already established)
3. **Database triggers** for automatic updates
4. **Comprehensive error handling**
5. **Proper rollback on failures**

### Testing Requirements:
- Unit tests for calculation functions
- Integration tests for API endpoints
- Database transaction tests
- Rollback scenario tests

---

## CONCLUSION

The system has a strong foundation with:
✅ Comprehensive database schema
✅ Journal entry automation
✅ Inventory tracking
✅ Booking management
✅ Bill payment system
✅ Automatic balance updates

**Critical Gaps to Address:**
1. Customer payment recording (receipts)
2. Expense approval workflow
3. Bank reconciliation

Once these three are implemented, the system will have complete basic accounting functionality for a tour operator business.

---

**Analysis Date:** January 4, 2026  
**Analyst:** AI System Review  
**Status:** Pending Implementation

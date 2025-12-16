// =====================================================
// Financial Reports
// Breco Safaris Ltd Financial System
// =====================================================

import { supabase } from '@/lib/supabase/client';
import { getAccountBalance, getAccountBalanceForPeriod } from './general-ledger';
import type {
  TrialBalanceRow,
  BalanceSheet,
  BalanceSheetSection,
  ProfitLoss,
  ProfitLossSection,
  ARAgingReport,
  APAgingReport,
  AgingBucket,
} from '@/types';
import Decimal from 'decimal.js';

/**
 * Generates Trial Balance as of a specific date
 */
export async function generateTrialBalance(
  asOfDate: string
): Promise<{ rows: TrialBalanceRow[]; totalDebits: number; totalCredits: number }> {
  // Get all active accounts
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .order('code');

  if (error) throw new Error(`Failed to get accounts: ${error.message}`);

  const rows: TrialBalanceRow[] = [];
  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);

  for (const account of accounts || []) {
    const balance = await getAccountBalance(account.id, asOfDate);
    
    if (!balance.equals(0)) {
      const isDebit = account.normal_balance === 'debit';
      const debit = isDebit && balance.greaterThan(0) ? balance.toNumber() : 
                   (!isDebit && balance.lessThan(0) ? balance.abs().toNumber() : 0);
      const credit = !isDebit && balance.greaterThan(0) ? balance.toNumber() :
                    (isDebit && balance.lessThan(0) ? balance.abs().toNumber() : 0);

      rows.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.account_type,
        debit,
        credit,
      });

      totalDebits = totalDebits.plus(debit);
      totalCredits = totalCredits.plus(credit);
    }
  }

  return {
    rows,
    totalDebits: totalDebits.toNumber(),
    totalCredits: totalCredits.toNumber(),
  };
}

/**
 * Generates Balance Sheet as of a specific date
 */
export async function generateBalanceSheet(asOfDate: string): Promise<BalanceSheet> {
  // Get all active accounts grouped by type and subtype
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .in('account_type', ['asset', 'liability', 'equity'])
    .order('code');

  if (error) throw new Error(`Failed to get accounts: ${error.message}`);

  // Group accounts by subtype
  const assetSubtypes = ['cash', 'bank', 'receivable', 'inventory', 'fixed_asset', 'other_asset'];
  const liabilitySubtypes = ['payable', 'accrued', 'loan', 'other_liability'];
  const equitySubtypes = ['capital', 'retained_earnings', 'other_equity'];

  const buildSection = async (
    subtypes: string[],
    accountType: string
  ): Promise<BalanceSheetSection[]> => {
    const sections: BalanceSheetSection[] = [];

    for (const subtype of subtypes) {
      const subtypeAccounts = (accounts || []).filter(
        (a) => a.account_type === accountType && a.account_subtype === subtype
      );

      if (subtypeAccounts.length === 0) continue;

      const accountBalances = await Promise.all(
        subtypeAccounts.map(async (account) => {
          const balance = await getAccountBalance(account.id, asOfDate);
          return {
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            balance: balance.toNumber(),
          };
        })
      );

      const nonZeroAccounts = accountBalances.filter((a) => a.balance !== 0);
      if (nonZeroAccounts.length > 0) {
        sections.push({
          title: subtype.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          accounts: nonZeroAccounts,
          total: nonZeroAccounts.reduce((sum, a) => sum + a.balance, 0),
        });
      }
    }

    return sections;
  };

  const assets = await buildSection(assetSubtypes, 'asset');
  const liabilities = await buildSection(liabilitySubtypes, 'liability');
  const equity = await buildSection(equitySubtypes, 'equity');

  const totalAssets = assets.reduce((sum, s) => sum + s.total, 0);
  const totalLiabilities = liabilities.reduce((sum, s) => sum + s.total, 0);
  const totalEquity = equity.reduce((sum, s) => sum + s.total, 0);

  return {
    asOfDate,
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    equity,
    totalEquity,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
  };
}

/**
 * Generates Profit & Loss Statement for a period
 */
export async function generateProfitLoss(
  startDate: string,
  endDate: string
): Promise<ProfitLoss> {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .in('account_type', ['revenue', 'expense'])
    .order('code');

  if (error) throw new Error(`Failed to get accounts: ${error.message}`);

  const buildSection = async (
    subtypes: string[],
    accountType: string
  ): Promise<ProfitLossSection[]> => {
    const sections: ProfitLossSection[] = [];

    for (const subtype of subtypes) {
      const subtypeAccounts = (accounts || []).filter(
        (a) => a.account_type === accountType && a.account_subtype === subtype
      );

      if (subtypeAccounts.length === 0) continue;

      const accountAmounts = await Promise.all(
        subtypeAccounts.map(async (account) => {
          const amount = await getAccountBalanceForPeriod(
            account.id,
            startDate,
            endDate
          );
          return {
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            amount: amount.toNumber(),
          };
        })
      );

      const nonZeroAccounts = accountAmounts.filter((a) => a.amount !== 0);
      if (nonZeroAccounts.length > 0) {
        sections.push({
          title: subtype.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          accounts: nonZeroAccounts,
          total: nonZeroAccounts.reduce((sum, a) => sum + a.amount, 0),
        });
      }
    }

    return sections;
  };

  const revenueSubtypes = ['sales', 'service', 'other_income'];
  const cogsSubtypes = ['cost_of_goods'];
  const expenseSubtypes = ['operating', 'administrative', 'marketing', 'depreciation', 'tax', 'other_expense'];

  const revenue = await buildSection(revenueSubtypes, 'revenue');
  const costOfGoodsSold = await buildSection(cogsSubtypes, 'expense');
  const expenses = await buildSection(expenseSubtypes, 'expense');

  const totalRevenue = revenue.reduce((sum, s) => sum + s.total, 0);
  const totalCogs = costOfGoodsSold.reduce((sum, s) => sum + s.total, 0);
  const grossProfit = totalRevenue - totalCogs;
  const totalExpenses = expenses.reduce((sum, s) => sum + s.total, 0);
  const netIncome = grossProfit - totalExpenses;

  return {
    periodStart: startDate,
    periodEnd: endDate,
    revenue,
    totalRevenue,
    costOfGoodsSold,
    totalCogs,
    grossProfit,
    expenses,
    totalExpenses,
    netIncome,
  };
}

/**
 * Generates AR Aging Report
 */
export async function generateARAgingReport(asOfDate: string): Promise<ARAgingReport> {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*, customers(name)')
    .in('status', ['sent', 'partial', 'overdue'])
    .gt('balance_due', 0);

  if (error) throw new Error(`Failed to get invoices: ${error.message}`);

  const asOf = new Date(asOfDate);
  const customerAging = new Map<string, {
    customerId: string;
    customerName: string;
    current: number;
    days30: number;
    days60: number;
    days90: number;
    over90: number;
  }>();

  for (const invoice of invoices || []) {
    const dueDate = new Date(invoice.due_date);
    const daysPastDue = Math.floor(
      (asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const balance = invoice.balance_due;

    if (!customerAging.has(invoice.customer_id)) {
      customerAging.set(invoice.customer_id, {
        customerId: invoice.customer_id,
        customerName: invoice.customers?.name || 'Unknown',
        current: 0,
        days30: 0,
        days60: 0,
        days90: 0,
        over90: 0,
      });
    }

    const aging = customerAging.get(invoice.customer_id)!;

    if (daysPastDue <= 0) {
      aging.current += balance;
    } else if (daysPastDue <= 30) {
      aging.days30 += balance;
    } else if (daysPastDue <= 60) {
      aging.days60 += balance;
    } else if (daysPastDue <= 90) {
      aging.days90 += balance;
    } else {
      aging.over90 += balance;
    }
  }

  const customers = Array.from(customerAging.values()).map((c) => ({
    ...c,
    total: c.current + c.days30 + c.days60 + c.days90 + c.over90,
  }));

  const totals: AgingBucket = {
    current: customers.reduce((sum, c) => sum + c.current, 0),
    days30: customers.reduce((sum, c) => sum + c.days30, 0),
    days60: customers.reduce((sum, c) => sum + c.days60, 0),
    days90: customers.reduce((sum, c) => sum + c.days90, 0),
    over90: customers.reduce((sum, c) => sum + c.over90, 0),
    total: customers.reduce((sum, c) => sum + c.total, 0),
  };

  return {
    asOfDate,
    customers,
    totals,
  };
}

/**
 * Generates AP Aging Report
 */
export async function generateAPAgingReport(asOfDate: string): Promise<APAgingReport> {
  const { data: bills, error } = await supabase
    .from('bills')
    .select('*, vendors(name)')
    .in('status', ['approved', 'partial', 'overdue'])
    .gt('balance_due', 0);

  if (error) throw new Error(`Failed to get bills: ${error.message}`);

  const asOf = new Date(asOfDate);
  const vendorAging = new Map<string, {
    vendorId: string;
    vendorName: string;
    current: number;
    days30: number;
    days60: number;
    days90: number;
    over90: number;
  }>();

  for (const bill of bills || []) {
    const dueDate = new Date(bill.due_date);
    const daysPastDue = Math.floor(
      (asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const balance = bill.balance_due;

    if (!vendorAging.has(bill.vendor_id)) {
      vendorAging.set(bill.vendor_id, {
        vendorId: bill.vendor_id,
        vendorName: bill.vendors?.name || 'Unknown',
        current: 0,
        days30: 0,
        days60: 0,
        days90: 0,
        over90: 0,
      });
    }

    const aging = vendorAging.get(bill.vendor_id)!;

    if (daysPastDue <= 0) {
      aging.current += balance;
    } else if (daysPastDue <= 30) {
      aging.days30 += balance;
    } else if (daysPastDue <= 60) {
      aging.days60 += balance;
    } else if (daysPastDue <= 90) {
      aging.days90 += balance;
    } else {
      aging.over90 += balance;
    }
  }

  const vendors = Array.from(vendorAging.values()).map((v) => ({
    ...v,
    total: v.current + v.days30 + v.days60 + v.days90 + v.over90,
  }));

  const totals: AgingBucket = {
    current: vendors.reduce((sum, v) => sum + v.current, 0),
    days30: vendors.reduce((sum, v) => sum + v.days30, 0),
    days60: vendors.reduce((sum, v) => sum + v.days60, 0),
    days90: vendors.reduce((sum, v) => sum + v.days90, 0),
    over90: vendors.reduce((sum, v) => sum + v.over90, 0),
    total: vendors.reduce((sum, v) => sum + v.total, 0),
  };

  return {
    asOfDate,
    vendors,
    totals,
  };
}

/**
 * Gets dashboard statistics
 */
export async function getDashboardStats(
  periodStart: string,
  periodEnd: string
): Promise<{
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  cashBalance: number;
  accountsReceivable: number;
  accountsPayable: number;
  inventoryValue: number;
  overdueInvoices: number;
  overdueBills: number;
}> {
  const today = new Date().toISOString().split('T')[0];

  // Get P&L data
  const pnl = await generateProfitLoss(periodStart, periodEnd);

  // Get cash balance (accounts with subtype 'cash' or 'bank')
  const { data: cashAccounts } = await supabase
    .from('accounts')
    .select('id')
    .in('account_subtype', ['cash', 'bank'])
    .eq('is_active', true);

  let cashBalance = new Decimal(0);
  for (const account of cashAccounts || []) {
    const balance = await getAccountBalance(account.id, today);
    cashBalance = cashBalance.plus(balance);
  }

  // Get AR balance
  const { data: arAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', '1200')
    .single();

  const arBalance = arAccount
    ? await getAccountBalance(arAccount.id, today)
    : new Decimal(0);

  // Get AP balance
  const { data: apAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', '2000')
    .single();

  const apBalance = apAccount
    ? await getAccountBalance(apAccount.id, today)
    : new Decimal(0);

  // Get inventory value
  const { data: inventoryAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', '1300')
    .single();

  const inventoryValue = inventoryAccount
    ? await getAccountBalance(inventoryAccount.id, today)
    : new Decimal(0);

  // Count overdue invoices
  const { count: overdueInvoices } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'overdue');

  // Count overdue bills
  const { count: overdueBills } = await supabase
    .from('bills')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'overdue');

  return {
    totalRevenue: pnl.totalRevenue,
    totalExpenses: pnl.totalCogs + pnl.totalExpenses,
    netIncome: pnl.netIncome,
    cashBalance: cashBalance.toNumber(),
    accountsReceivable: arBalance.toNumber(),
    accountsPayable: apBalance.toNumber(),
    inventoryValue: inventoryValue.toNumber(),
    overdueInvoices: overdueInvoices || 0,
    overdueBills: overdueBills || 0,
  };
}

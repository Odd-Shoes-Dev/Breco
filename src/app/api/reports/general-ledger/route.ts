import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface GeneralLedgerEntry {
  entryId: string;
  date: string;
  accountCode: string;
  accountName: string;
  accountType: 'Assets' | 'Liabilities' | 'Equity' | 'Revenue' | 'Expenses';
  description: string;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
  journalType: 'General Journal' | 'Sales Journal' | 'Purchase Journal' | 'Cash Receipts' | 'Cash Disbursements' | 'Payroll Journal';
}

interface AccountSummary {
  accountCode: string;
  accountName: string;
  accountType: 'Assets' | 'Liabilities' | 'Equity' | 'Revenue' | 'Expenses';
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  entryCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const accountFilter = searchParams.get('accountFilter') || 'all';
    const journalType = searchParams.get('journalType') || 'all';
    const searchTerm = searchParams.get('searchTerm') || '';

    // Fetch journal entries with lines
    const journalEntries = await sql`
      SELECT
        je.id, je.entry_number, je.entry_date, je.description,
        je.reference_type, je.status,
        jl.id AS line_id, jl.line_number, jl.account_id,
        jl.debit, jl.credit, jl.description AS line_description,
        a.id AS acct_id, a.code AS acct_code, a.name AS acct_name, a.account_type
      FROM journal_entries je
      JOIN journal_lines jl ON jl.journal_entry_id = je.id
      LEFT JOIN accounts a ON a.id = jl.account_id
      WHERE je.entry_date >= ${startDate}
        AND je.entry_date <= ${endDate}
        AND je.status = 'posted'
      ORDER BY je.entry_date ASC, je.entry_number ASC
    `;

    // Map source_module to journal type
    const getJournalType = (sourceModule: string | null): GeneralLedgerEntry['journalType'] => {
      if (!sourceModule) return 'General Journal';
      switch (sourceModule.toLowerCase()) {
        case 'sales':
        case 'invoices':
          return 'Sales Journal';
        case 'purchases':
        case 'bills':
          return 'Purchase Journal';
        case 'receipts':
          return 'Cash Receipts';
        case 'payments':
        case 'disbursements':
          return 'Cash Disbursements';
        case 'payroll':
          return 'Payroll Journal';
        default:
          return 'General Journal';
      }
    };

    // Map account_type to our type format
    const mapAccountType = (accountType: string): GeneralLedgerEntry['accountType'] => {
      const type = accountType.toLowerCase();
      if (type.includes('asset')) return 'Assets';
      if (type.includes('liab')) return 'Liabilities';
      if (type.includes('equity')) return 'Equity';
      if (type.includes('revenue') || type.includes('income')) return 'Revenue';
      if (type.includes('expense') || type.includes('cost')) return 'Expenses';
      return 'Assets';
    };

    const entries: GeneralLedgerEntry[] = journalEntries
      .filter((row: any) => row.acct_code)
      .map((row: any) => ({
        entryId: `${row.entry_number}-${row.line_number}`,
        date: row.entry_date,
        accountCode: row.acct_code,
        accountName: row.acct_name,
        accountType: mapAccountType(row.account_type),
        description: row.line_description || row.description || '',
        reference: row.entry_number,
        debit: parseFloat(row.debit) || 0,
        credit: parseFloat(row.credit) || 0,
        runningBalance: 0,
        journalType: getJournalType(row.reference_type)
      }));

    // Calculate running balances for each account
    const accountBalances = new Map<string, number>();
    entries.forEach(entry => {
      const currentBalance = accountBalances.get(entry.accountCode) || 0;
      let newBalance = currentBalance;

      if (entry.accountType === 'Assets' || entry.accountType === 'Expenses') {
        newBalance = currentBalance + entry.debit - entry.credit;
      } else {
        newBalance = currentBalance + entry.credit - entry.debit;
      }

      entry.runningBalance = newBalance;
      accountBalances.set(entry.accountCode, newBalance);
    });

    // Apply filters
    let filteredEntries = entries;

    if (accountFilter !== 'all') {
      filteredEntries = filteredEntries.filter(entry => entry.accountType === accountFilter);
    }

    if (journalType !== 'all') {
      filteredEntries = filteredEntries.filter(entry => entry.journalType === journalType);
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredEntries = filteredEntries.filter(entry =>
        entry.accountCode.toLowerCase().includes(searchLower) ||
        entry.accountName.toLowerCase().includes(searchLower) ||
        entry.description.toLowerCase().includes(searchLower) ||
        entry.reference.toLowerCase().includes(searchLower)
      );
    }

    filteredEntries.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.entryId.localeCompare(b.entryId);
    });

    const totalDebits = filteredEntries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredits = filteredEntries.reduce((sum, entry) => sum + entry.credit, 0);
    const balanceDifference = totalDebits - totalCredits;
    const inBalance = Math.abs(balanceDifference) < 0.01;

    const accountMap = new Map<string, AccountSummary>();

    filteredEntries.forEach(entry => {
      const key = entry.accountCode;
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          accountCode: entry.accountCode,
          accountName: entry.accountName,
          accountType: entry.accountType,
          openingBalance: 0,
          totalDebits: 0,
          totalCredits: 0,
          closingBalance: 0,
          entryCount: 0
        });
      }

      const account = accountMap.get(key)!;
      account.totalDebits += entry.debit;
      account.totalCredits += entry.credit;
      account.entryCount += 1;

      if (account.accountType === 'Assets' || account.accountType === 'Expenses') {
        account.closingBalance = account.openingBalance + account.totalDebits - account.totalCredits;
      } else {
        account.closingBalance = account.openingBalance + account.totalCredits - account.totalDebits;
      }
    });

    const accountSummaries = Array.from(accountMap.values()).sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const accountTypes = {
      assets: {
        accounts: accountSummaries.filter(a => a.accountType === 'Assets').length,
        balance: accountSummaries.filter(a => a.accountType === 'Assets').reduce((sum, a) => sum + a.closingBalance, 0)
      },
      liabilities: {
        accounts: accountSummaries.filter(a => a.accountType === 'Liabilities').length,
        balance: accountSummaries.filter(a => a.accountType === 'Liabilities').reduce((sum, a) => sum + a.closingBalance, 0)
      },
      equity: {
        accounts: accountSummaries.filter(a => a.accountType === 'Equity').length,
        balance: accountSummaries.filter(a => a.accountType === 'Equity').reduce((sum, a) => sum + a.closingBalance, 0)
      },
      revenue: {
        accounts: accountSummaries.filter(a => a.accountType === 'Revenue').length,
        balance: accountSummaries.filter(a => a.accountType === 'Revenue').reduce((sum, a) => sum + a.closingBalance, 0)
      },
      expenses: {
        accounts: accountSummaries.filter(a => a.accountType === 'Expenses').length,
        balance: accountSummaries.filter(a => a.accountType === 'Expenses').reduce((sum, a) => sum + a.closingBalance, 0)
      }
    };

    const response = {
      reportPeriod: {
        startDate,
        endDate
      },
      summary: {
        totalAccounts: accountSummaries.length,
        totalDebits,
        totalCredits,
        totalEntries: filteredEntries.length,
        balanceDifference,
        inBalance
      },
      entries: filteredEntries,
      accountSummaries,
      accountTypes
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('General ledger report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate general ledger report' },
      { status: 500 }
    );
  }
}

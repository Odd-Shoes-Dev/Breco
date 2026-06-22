import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  reference: string;
  description: string;
  type: 'Manual' | 'System' | 'Adjustment' | 'Closing';
  status: 'Draft' | 'Posted' | 'Reversed';
  createdBy: string;
  totalDebit: number;
  totalCredit: number;
  lineItems: Array<{
    id: string;
    accountCode: string;
    accountName: string;
    description: string;
    debit: number;
    credit: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const status = searchParams.get('status') || 'all';
    const type = searchParams.get('type') || 'all';

    // Fetch journal entries with lines
    let journalEntriesData;
    if (status !== 'all') {
      journalEntriesData = await sql`
        SELECT
          je.id, je.entry_number, je.entry_date, je.description, je.memo,
          je.source_module, je.status, je.created_at, je.created_by,
          jl.id AS line_id, jl.line_number, jl.debit, jl.credit, jl.description AS line_description,
          a.code AS acct_code, a.name AS acct_name
        FROM journal_entries je
        LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
        LEFT JOIN accounts a ON a.id = jl.account_id
        WHERE je.entry_date >= ${startDate}
          AND je.entry_date <= ${endDate}
          AND je.status = ${status.toLowerCase()}
        ORDER BY je.entry_date DESC, je.entry_number DESC
      `;
    } else {
      journalEntriesData = await sql`
        SELECT
          je.id, je.entry_number, je.entry_date, je.description, je.memo,
          je.source_module, je.status, je.created_at, je.created_by,
          jl.id AS line_id, jl.line_number, jl.debit, jl.credit, jl.description AS line_description,
          a.code AS acct_code, a.name AS acct_name
        FROM journal_entries je
        LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
        LEFT JOIN accounts a ON a.id = jl.account_id
        WHERE je.entry_date >= ${startDate}
          AND je.entry_date <= ${endDate}
        ORDER BY je.entry_date DESC, je.entry_number DESC
      `;
    }

    // Group rows by journal entry
    const entryMap = new Map<string, any>();
    for (const row of journalEntriesData) {
      if (!entryMap.has(row.id)) {
        entryMap.set(row.id, {
          id: row.id,
          entry_number: row.entry_number,
          entry_date: row.entry_date,
          description: row.description,
          memo: row.memo,
          source_module: row.source_module,
          status: row.status,
          created_by: row.created_by,
          lines: [],
        });
      }
      if (row.line_id) {
        entryMap.get(row.id).lines.push({
          id: row.line_id,
          line_number: row.line_number,
          debit: row.debit,
          credit: row.credit,
          description: row.line_description,
          account: { code: row.acct_code, name: row.acct_name },
        });
      }
    }

    const getEntryType = (sourceModule: string | null): JournalEntry['type'] => {
      if (!sourceModule) return 'Manual';
      const source = sourceModule.toLowerCase();
      if (source === 'manual' || source === 'journal') return 'Manual';
      if (source === 'closing' || source === 'year-end') return 'Closing';
      if (source === 'adjustment') return 'Adjustment';
      return 'System';
    };

    const entries: JournalEntry[] = Array.from(entryMap.values()).map((entry: any) => {
      const totalDebit = entry.lines.reduce((sum: number, line: any) => sum + (parseFloat(line.debit) || 0), 0);
      const totalCredit = entry.lines.reduce((sum: number, line: any) => sum + (parseFloat(line.credit) || 0), 0);

      return {
        id: entry.id,
        entryNumber: entry.entry_number,
        date: entry.entry_date,
        reference: entry.memo || entry.entry_number,
        description: entry.description || '',
        type: getEntryType(entry.source_module),
        status: entry.status === 'posted' ? 'Posted' : entry.status === 'void' ? 'Reversed' : 'Draft',
        createdBy: entry.created_by || 'System',
        totalDebit,
        totalCredit,
        lineItems: entry.lines.map((line: any) => ({
          id: line.id,
          accountCode: line.account?.code || '',
          accountName: line.account?.name || '',
          description: line.description || '',
          debit: parseFloat(line.debit) || 0,
          credit: parseFloat(line.credit) || 0,
        })),
      };
    });

    let filteredEntries = entries;
    if (type !== 'all') {
      filteredEntries = entries.filter(entry => entry.type === type);
    }

    const summary = {
      totalEntries: filteredEntries.length,
      totalDebits: filteredEntries.reduce((sum, e) => sum + e.totalDebit, 0),
      totalCredits: filteredEntries.reduce((sum, e) => sum + e.totalCredit, 0),
      postedEntries: filteredEntries.filter(e => e.status === 'Posted').length,
      draftEntries: filteredEntries.filter(e => e.status === 'Draft').length,
      reversedEntries: filteredEntries.filter(e => e.status === 'Reversed').length,
      manualEntries: filteredEntries.filter(e => e.type === 'Manual').length,
      systemEntries: filteredEntries.filter(e => e.type === 'System').length,
      adjustmentEntries: filteredEntries.filter(e => e.type === 'Adjustment').length,
      closingEntries: filteredEntries.filter(e => e.type === 'Closing').length,
      balanceDifference: filteredEntries.reduce((sum, e) => sum + e.totalDebit, 0) - filteredEntries.reduce((sum, e) => sum + e.totalCredit, 0),
    };

    const response = {
      reportPeriod: {
        startDate,
        endDate,
      },
      summary,
      entries: filteredEntries,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Journal entries report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate journal entries report' },
      { status: 500 }
    );
  }
}

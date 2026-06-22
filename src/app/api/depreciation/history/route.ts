import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/depreciation/history - Get depreciation posting history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const countRows = await sql`SELECT COUNT(*) AS cnt FROM depreciation_postings`;
    const total = Number((countRows as any[])[0]?.cnt || 0);

    const rows = await sql`
      SELECT
        dp.*,
        json_build_object('id', je.id, 'entry_number', je.entry_number) AS journal_entry,
        json_build_object('id', up.id, 'full_name', up.full_name, 'email', up.email) AS posted_by_user
      FROM depreciation_postings dp
      LEFT JOIN journal_entries je ON je.id = dp.journal_entry_id
      LEFT JOIN user_profiles up ON up.id = dp.posted_by
      ORDER BY dp.posting_date DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return NextResponse.json({
      data: rows as any[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

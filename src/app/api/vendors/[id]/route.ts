import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/vendors/[id]
export async function GET(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const rows = await sql`
      SELECT v.*, row_to_json(a.*) AS accounts
      FROM vendors v
      LEFT JOIN accounts a ON a.id = v.default_expense_account_id
      WHERE v.id = ${params.id}
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const bills = await sql`
      SELECT id, bill_number, bill_date, total, amount_paid, status
      FROM bills
      WHERE vendor_id = ${params.id}
      ORDER BY bill_date DESC
      LIMIT 10
    `;

    return NextResponse.json({
      data: {
        ...rows[0],
        recent_bills: bills,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/vendors/[id]
export async function PATCH(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const body = await request.json();

    // Check vendor exists
    const existingRows = await sql`SELECT id FROM vendors WHERE id = ${params.id}`;
    if (!existingRows[0]) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const rows = await sql`
      UPDATE vendors
      SET
        name = COALESCE(${body.name ?? null}, name),
        company_name = COALESCE(${body.company_name ?? null}, company_name),
        email = COALESCE(${body.email ?? null}, email),
        phone = COALESCE(${body.phone ?? null}, phone),
        tax_id = COALESCE(${body.tax_id ?? null}, tax_id),
        address_line1 = COALESCE(${body.address_line1 ?? null}, address_line1),
        address_line2 = COALESCE(${body.address_line2 ?? null}, address_line2),
        city = COALESCE(${body.city ?? null}, city),
        state = COALESCE(${body.state ?? null}, state),
        zip_code = COALESCE(${body.zip_code ?? null}, zip_code),
        country = COALESCE(${body.country ?? null}, country),
        payment_terms = COALESCE(${body.payment_terms ?? null}, payment_terms),
        default_expense_account_id = COALESCE(${body.default_expense_account_id ?? null}, default_expense_account_id),
        notes = COALESCE(${body.notes ?? null}, notes),
        is_active = COALESCE(${body.is_active ?? null}, is_active),
        updated_at = NOW()
      WHERE id = ${params.id}
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/vendors/[id]
export async function DELETE(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    // Check for existing bills
    const countRows = await sql`SELECT COUNT(*) AS count FROM bills WHERE vendor_id = ${params.id}`;
    const count = parseInt(countRows[0]?.count || '0');

    if (count > 0) {
      const rows = await sql`
        UPDATE vendors SET is_active = false, updated_at = NOW()
        WHERE id = ${params.id}
        RETURNING *
      `;

      return NextResponse.json({
        data: rows[0],
        message: 'Vendor deactivated (has existing bills)',
      });
    }

    await sql`DELETE FROM vendors WHERE id = ${params.id}`;

    return NextResponse.json({ message: 'Vendor deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/vendors/[id]
export async function GET(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const rows = await sql`
      SELECT v.*
      FROM vendors v
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
        company_name = CASE WHEN ${body.company_name !== undefined} THEN ${body.company_name ?? null} ELSE company_name END,
        email = CASE WHEN ${body.email !== undefined} THEN ${body.email ?? null} ELSE email END,
        phone = CASE WHEN ${body.phone !== undefined} THEN ${body.phone ?? null} ELSE phone END,
        address_line1 = CASE WHEN ${body.address_line1 !== undefined} THEN ${body.address_line1 ?? null} ELSE address_line1 END,
        address_line2 = CASE WHEN ${body.address_line2 !== undefined} THEN ${body.address_line2 ?? null} ELSE address_line2 END,
        city = CASE WHEN ${body.city !== undefined} THEN ${body.city ?? null} ELSE city END,
        state = CASE WHEN ${body.state !== undefined} THEN ${body.state ?? null} ELSE state END,
        zip_code = CASE WHEN ${body.zip_code !== undefined} THEN ${body.zip_code ?? null} ELSE zip_code END,
        country = COALESCE(${body.country ?? null}, country),
        tax_id = CASE WHEN ${body.tax_id !== undefined} THEN ${body.tax_id ?? null} ELSE tax_id END,
        is_1099_vendor = COALESCE(${body.is_1099_vendor ?? null}, is_1099_vendor),
        default_expense_account_id = CASE WHEN ${body.default_expense_account_id !== undefined} THEN ${body.default_expense_account_id || null} ELSE default_expense_account_id END,
        currency = COALESCE(${body.currency ?? null}, currency),
        payment_terms = COALESCE(${body.payment_terms ?? null}, payment_terms),
        notes = CASE WHEN ${body.notes !== undefined} THEN ${body.notes ?? null} ELSE notes END,
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

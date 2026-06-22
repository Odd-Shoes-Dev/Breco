import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/customers/[id]
export async function GET(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const rows = await sql`SELECT * FROM customers WHERE id = ${params.id}`;
    const data = (rows as any[])[0];

    if (!data) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const invoiceRows = await sql`
      SELECT id, invoice_number, invoice_date, total, amount_paid, status
      FROM invoices
      WHERE customer_id = ${params.id}
      ORDER BY invoice_date DESC
      LIMIT 10
    `;

    return NextResponse.json({
      data: {
        ...data,
        recent_invoices: invoiceRows as any[],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/customers/[id]
export async function PATCH(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const body = await request.json();

    const existingRows = await sql`SELECT id FROM customers WHERE id = ${params.id}`;
    if ((existingRows as any[]).length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (body.email) {
      const emailCheckRows = await sql`
        SELECT id FROM customers WHERE email = ${body.email} AND id != ${params.id} LIMIT 1
      `;
      if ((emailCheckRows as any[]).length > 0) {
        return NextResponse.json(
          { error: 'A customer with this email already exists' },
          { status: 400 }
        );
      }
    }

    await sql`
      UPDATE customers SET
        name = COALESCE(${body.name ?? null}, name),
        email = CASE WHEN ${body.email !== undefined} THEN ${body.email ?? null} ELSE email END,
        phone = CASE WHEN ${body.phone !== undefined} THEN ${body.phone ?? null} ELSE phone END,
        address = CASE WHEN ${body.address !== undefined || body.address_line1 !== undefined} THEN ${body.address ?? body.address_line1 ?? null} ELSE address END,
        city = CASE WHEN ${body.city !== undefined} THEN ${body.city ?? null} ELSE city END,
        state = CASE WHEN ${body.state !== undefined} THEN ${body.state ?? null} ELSE state END,
        zip_code = CASE WHEN ${body.postal_code !== undefined} THEN ${body.postal_code ?? null} ELSE zip_code END,
        country = COALESCE(${body.country ?? null}, country),
        payment_terms = COALESCE(${body.payment_terms ?? null}, payment_terms),
        credit_limit = COALESCE(${body.credit_limit ?? null}, credit_limit),
        notes = CASE WHEN ${body.notes !== undefined} THEN ${body.notes ?? null} ELSE notes END,
        is_active = COALESCE(${body.is_active ?? null}, is_active)
      WHERE id = ${params.id}
    `;

    const dataRows = await sql`SELECT * FROM customers WHERE id = ${params.id}`;
    const data = (dataRows as any[])[0];

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/customers/[id]
export async function DELETE(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const countRows = await sql`SELECT COUNT(*) AS cnt FROM invoices WHERE customer_id = ${params.id}`;
    const count = Number((countRows as any[])[0]?.cnt || 0);

    if (count > 0) {
      // Soft delete - deactivate instead
      await sql`UPDATE customers SET is_active = false WHERE id = ${params.id}`;
      const dataRows = await sql`SELECT * FROM customers WHERE id = ${params.id}`;
      const data = (dataRows as any[])[0];

      return NextResponse.json({
        data,
        message: 'Customer deactivated (has existing invoices)',
      });
    }

    // Hard delete if no invoices
    await sql`DELETE FROM customers WHERE id = ${params.id}`;

    return NextResponse.json({ message: 'Customer deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

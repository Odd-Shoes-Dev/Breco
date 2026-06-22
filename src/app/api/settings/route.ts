import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM company_settings LIMIT 1`;
    if (rows.length === 0) {
      return NextResponse.json(null);
    }
    return NextResponse.json(rows[0]);
  } catch (error: any) {
    console.error('Failed to load settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const rows = await sql`SELECT id FROM company_settings LIMIT 1`;

    if (rows.length === 0) {
      const result = await sql`
        INSERT INTO company_settings (
          name, legal_name, ein, address_line1, address_line2,
          city, state, zip_code, country, phone, email, website,
          base_currency, fiscal_year_start_month, default_payment_terms, sales_tax_rate
        ) VALUES (
          ${body.name || 'Breco Safaris Ltd'},
          ${body.legal_name || null},
          ${body.ein || null},
          ${body.address_line1 || null},
          ${body.address_line2 || null},
          ${body.city || null},
          ${body.state || null},
          ${body.zip_code || null},
          ${body.country || 'Uganda'},
          ${body.phone || null},
          ${body.email || null},
          ${body.website || null},
          ${body.base_currency || 'UGX'},
          ${body.fiscal_year_start_month || 1},
          ${body.default_payment_terms || 30},
          ${body.sales_tax_rate || 0.18}
        )
        RETURNING *
      `;
      return NextResponse.json(result[0]);
    }

    const setClauses: string[] = [];
    const allowedFields = [
      'name', 'legal_name', 'ein', 'address_line1', 'address_line2',
      'city', 'state', 'zip_code', 'country', 'phone', 'email', 'website',
      'logo_url', 'base_currency', 'fiscal_year_start_month',
      'inventory_method', 'default_payment_terms', 'sales_tax_rate',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const id = rows[0].id;

    const result = await sql`
      UPDATE company_settings SET
        name = COALESCE(${updates.name ?? null}, name),
        legal_name = COALESCE(${updates.legal_name ?? null}, legal_name),
        ein = COALESCE(${updates.ein ?? null}, ein),
        address_line1 = COALESCE(${updates.address_line1 ?? null}, address_line1),
        address_line2 = COALESCE(${updates.address_line2 ?? null}, address_line2),
        city = COALESCE(${updates.city ?? null}, city),
        state = COALESCE(${updates.state ?? null}, state),
        zip_code = COALESCE(${updates.zip_code ?? null}, zip_code),
        country = COALESCE(${updates.country ?? null}, country),
        phone = COALESCE(${updates.phone ?? null}, phone),
        email = COALESCE(${updates.email ?? null}, email),
        website = COALESCE(${updates.website ?? null}, website),
        logo_url = COALESCE(${updates.logo_url ?? null}, logo_url),
        base_currency = COALESCE(${updates.base_currency ?? null}, base_currency),
        fiscal_year_start_month = COALESCE(${updates.fiscal_year_start_month ?? null}, fiscal_year_start_month),
        inventory_method = COALESCE(${updates.inventory_method ?? null}, inventory_method),
        default_payment_terms = COALESCE(${updates.default_payment_terms ?? null}, default_payment_terms),
        sales_tax_rate = COALESCE(${updates.sales_tax_rate ?? null}, sales_tax_rate),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error: any) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

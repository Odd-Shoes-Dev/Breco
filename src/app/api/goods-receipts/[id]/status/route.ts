import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { status, inspection_notes } = await request.json();
    const { id } = await params;

    const grRows = await sql`SELECT * FROM goods_receipts WHERE id = ${id}`;
    if (grRows.length === 0) {
      return NextResponse.json({ error: 'Goods receipt not found' }, { status: 404 });
    }
    const gr = grRows[0];

    // Update goods receipt status (inspection notes are appended to notes;
    // the goods_receipts table has no inspection_notes column)
    await sql`
      UPDATE goods_receipts SET
        status = ${status},
        notes = COALESCE(${inspection_notes ?? null}, notes),
        updated_at = NOW()
      WHERE id = ${id}
    `;

    // If accepted, record inventory movements (stock is computed from inventory_movements)
    if (status === 'accepted') {
      const grLines = await sql`SELECT * FROM goods_receipt_lines WHERE gr_id = ${id}`;

      for (const line of grLines) {
        if (line.product_id) {
          await sql`
            INSERT INTO inventory_movements (
              product_id, movement_type, quantity, unit_cost, total_cost,
              reference_type, reference_id, notes
            ) VALUES (
              ${line.product_id}, 'purchase', ${line.quantity_received},
              ${line.unit_cost ?? 0}, ${(Number(line.unit_cost) || 0) * (Number(line.quantity_received) || 0)},
              'goods_receipt', ${id}, ${`Goods Receipt ${gr.gr_number}`}
            )
          `;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating goods receipt status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

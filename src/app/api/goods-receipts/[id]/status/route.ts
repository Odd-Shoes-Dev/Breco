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

    // Update goods receipt status
    await sql`
      UPDATE goods_receipts SET status = ${status}, inspection_notes = ${inspection_notes ?? null}
      WHERE id = ${id}
    `;

    // If accepted, update inventory
    if (status === 'accepted') {
      const grLines = await sql`SELECT * FROM goods_receipt_lines WHERE goods_receipt_id = ${id}`;

      for (const line of grLines) {
        if (line.product_id) {
          // Get current quantity
          const productRows = await sql`
            SELECT quantity_in_stock FROM products WHERE id = ${line.product_id}
          `;
          const currentQty = productRows[0]?.quantity_in_stock || 0;
          const newQuantity = currentQty + line.quantity_received;

          // Update product quantity
          await sql`
            UPDATE products SET quantity_in_stock = ${newQuantity} WHERE id = ${line.product_id}
          `;

          // Record inventory movement
          await sql`
            INSERT INTO inventory_movements (
              product_id, company_id, movement_type, quantity, unit_cost,
              reference_type, reference_id, movement_date, notes
            ) VALUES (
              ${line.product_id}, ${gr.company_id}, 'purchase', ${line.quantity_received},
              ${line.unit_cost ?? null}, 'goods_receipt', ${id},
              ${gr.received_date ?? null}, ${`Goods Receipt ${gr.gr_number}`}
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

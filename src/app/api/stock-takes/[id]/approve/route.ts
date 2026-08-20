import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const stockTakeId = id;

    // Get stock take with lines
    const stockTakeRows = await sql`
      SELECT st.*,
        (
          SELECT json_agg(json_build_object('id', stl.id, 'product_id', stl.product_id, 'variance', stl.variance))
          FROM stock_take_items stl
          WHERE stl.stock_take_id = st.id
        ) AS stock_take_lines
      FROM stock_takes st
      WHERE st.id = ${stockTakeId}
    `;
    const stockTake = stockTakeRows[0];

    if (!stockTake) {
      throw new Error('Stock take not found');
    }

    if (stockTake.status === 'completed') {
      return NextResponse.json(
        { error: 'Stock take already completed' },
        { status: 400 }
      );
    }

    // Update stock take status
    await sql`
      UPDATE stock_takes
      SET status = 'completed', completed_at = ${new Date().toISOString()}, updated_at = NOW()
      WHERE id = ${stockTakeId}
    `;

    // Apply inventory adjustments for each line with variance
    const lines = stockTake.stock_take_lines || [];
    for (const line of lines) {
      if (line.variance !== 0) {
        // Record an adjustment movement (stock is computed from inventory_movements)
        await sql`
          INSERT INTO inventory_movements (
            product_id, movement_type, quantity,
            reference_type, reference_id, notes, created_by
          ) VALUES (
            ${line.product_id}, 'adjustment', ${line.variance},
            'stock_take', ${stockTakeId},
            ${'Stock take ' + stockTake.reference_number}, ${user.id}
          )
        `;
      }
    }

    return NextResponse.json({
      message: 'Stock take approved and inventory updated',
      stockTakeId,
      adjustmentsApplied: lines.filter((l: any) => l.variance !== 0).length,
    });
  } catch (error: any) {
    console.error('Error approving stock take:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

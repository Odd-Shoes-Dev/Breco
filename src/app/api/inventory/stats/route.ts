import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const allItems = await sql`
      SELECT quantity_on_hand, cost_price, currency, reorder_point
      FROM products
      WHERE track_inventory = true
    `;

    if (!allItems || allItems.length === 0) {
      return NextResponse.json({
        totalItems: 0,
        totalValue: 0,
        lowStock: 0,
        outOfStock: 0,
      });
    }

    const totalItems = allItems.length;
    let totalValue = 0;

    // Convert each item's value to USD
    for (const item of allItems) {
      const quantity = item.quantity_on_hand || 0;
      const cost = item.cost_price || 0;
      const itemValue = quantity * cost;

      if (itemValue > 0) {
        let valueInUSD = itemValue;

        // Convert to USD if not already
        if (item.currency && item.currency !== 'USD') {
          try {
            const convertedRows = await sql`
              SELECT convert_currency(
                ${itemValue},
                ${item.currency},
                'USD',
                ${new Date().toISOString().split('T')[0]}
              ) AS result
            `;
            valueInUSD = convertedRows[0]?.result ?? itemValue;
          } catch (conversionError) {
            console.error('Currency conversion error:', conversionError);
            // Fallback to unconverted value
          }
        }

        totalValue += valueInUSD;
      }
    }

    const lowStock = allItems.filter(
      (item: any) => (item.quantity_on_hand || 0) <= (item.reorder_point || 0) && (item.quantity_on_hand || 0) > 0
    ).length;

    const outOfStock = allItems.filter((item: any) => (item.quantity_on_hand || 0) === 0).length;

    return NextResponse.json({
      totalItems,
      totalValue,
      lowStock,
      outOfStock,
    });
  } catch (error) {
    console.error('Error calculating inventory stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate inventory stats' },
      { status: 500 }
    );
  }
}

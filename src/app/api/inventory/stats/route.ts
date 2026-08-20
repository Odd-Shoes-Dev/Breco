import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getCompanySettings } from '@/lib/company-settings';

export async function GET() {
  try {
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;

    const allItems = await sql`
      SELECT p.purchase_price, p.reorder_point, p.currency,
             COALESCE((SELECT SUM(im.quantity) FROM inventory_movements im WHERE im.product_id = p.id), 0) AS quantity_on_hand
      FROM products p
      WHERE p.track_inventory = true
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

    // Convert each item's value to the company's base currency
    for (const item of allItems) {
      const quantity = Number(item.quantity_on_hand) || 0;
      const cost = Number(item.purchase_price) || 0;
      let itemValue = quantity * cost;

      const itemCurrency = item.currency || baseCurrency;
      if (itemValue !== 0 && itemCurrency !== baseCurrency) {
        try {
          const converted = await sql`SELECT convert_currency(${itemValue}, ${itemCurrency}, ${baseCurrency}, ${new Date().toISOString().split('T')[0]}) AS val`;
          itemValue = Number(converted[0]?.val ?? itemValue);
        } catch {
          // fall back to unconverted value if conversion fails
        }
      }

      if (itemValue > 0) {
        totalValue += itemValue;
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
      currency: baseCurrency,
    });
  } catch (error) {
    console.error('Error calculating inventory stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate inventory stats' },
      { status: 500 }
    );
  }
}

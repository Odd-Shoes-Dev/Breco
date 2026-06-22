import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const rows = await sql`
      SELECT purchase_price, accumulated_depreciation, current_book_value, status
      FROM fixed_assets
      WHERE status = 'active'
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        totalAssets: 0,
        totalCost: 0,
        totalBookValue: 0,
        totalDepreciation: 0,
      });
    }

    const totalAssets = rows.length;
    const totalCost = rows.reduce((sum: number, asset: any) => sum + (asset.purchase_price || 0), 0);
    const totalDepreciation = rows.reduce((sum: number, asset: any) => sum + (asset.accumulated_depreciation || 0), 0);
    const totalBookValue = rows.reduce((sum: number, asset: any) => sum + (asset.current_book_value || 0), 0);

    return NextResponse.json({
      totalAssets,
      totalCost,
      totalBookValue,
      totalDepreciation,
    });
  } catch (error) {
    console.error('Error calculating assets stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate assets stats' },
      { status: 500 }
    );
  }
}

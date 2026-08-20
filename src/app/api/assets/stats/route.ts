import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getCompanySettings } from '@/lib/company-settings';

export async function GET() {
  try {
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;

    const rows = await sql`
      SELECT purchase_price, accumulated_depreciation, current_book_value, currency, purchase_date, status
      FROM fixed_assets
      WHERE status = 'active'
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        totalAssets: 0,
        totalCost: 0,
        totalBookValue: 0,
        totalDepreciation: 0,
        currency: baseCurrency,
      });
    }

    const totalAssets = rows.length;
    let totalCost = 0;
    let totalDepreciation = 0;
    let totalBookValue = 0;

    for (const asset of rows as any[]) {
      const assetCurrency = asset.currency || baseCurrency;
      const convert = async (amount: number) => {
        if (!amount || assetCurrency === baseCurrency) return amount || 0;
        try {
          const res = await sql`SELECT convert_currency(${amount}, ${assetCurrency}, ${baseCurrency}, ${asset.purchase_date}) AS val`;
          return Number(res[0]?.val ?? amount);
        } catch {
          return amount;
        }
      };

      totalCost += await convert(asset.purchase_price);
      totalDepreciation += await convert(asset.accumulated_depreciation);
      totalBookValue += await convert(asset.current_book_value);
    }

    return NextResponse.json({
      totalAssets,
      totalCost,
      totalBookValue,
      totalDepreciation,
      currency: baseCurrency,
    });
  } catch (error) {
    console.error('Error calculating assets stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate assets stats' },
      { status: 500 }
    );
  }
}

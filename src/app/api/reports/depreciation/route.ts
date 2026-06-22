import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface AssetDepreciation {
  assetId: string;
  assetNumber: string;
  assetName: string;
  category: string;
  purchaseDate: string;
  purchasePrice: number;
  depreciationMethod: string;
  usefulLifeMonths: number;
  salvageValue: number;
  currentBookValue: number;
  accumulatedDepreciation: number;
  annualDepreciation: number;
  monthlyDepreciation: number;
  remainingLifeMonths: number;
  status: string;
  depreciationSchedule?: Array<{
    year: number;
    beginningValue: number;
    depreciation: number;
    accumulatedDepreciation: number;
    endingValue: number;
  }>;
}

interface DepreciationScheduleData {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalAssets: number;
    totalOriginalCost: number;
    totalCurrentValue: number;
    totalAccumulatedDepreciation: number;
    annualDepreciationExpense: number;
    monthlyDepreciationExpense: number;
    activeAssets: number;
    fullyDepreciated: number;
  };
  assets: AssetDepreciation[];
  byCategory: Record<string, {
    count: number;
    cost: number;
    accumulated: number;
    bookValue: number;
  }>;
  byMethod: Record<string, {
    count: number;
    cost: number;
  }>;
}

// Helper to calculate depreciation
const calculateDepreciation = (
  purchaseDate: string,
  purchasePrice: number,
  residualValue: number,
  usefulLifeMonths: number,
  method: string,
  accumulatedDep: number
) => {
  const purchase = new Date(purchaseDate);
  const now = new Date();
  const monthsElapsed = (now.getFullYear() - purchase.getFullYear()) * 12 +
                       (now.getMonth() - purchase.getMonth());

  const depreciableAmount = purchasePrice - residualValue;
  const monthlyDepreciation = usefulLifeMonths > 0 ? depreciableAmount / usefulLifeMonths : 0;
  const annualDepreciation = monthlyDepreciation * 12;

  const calculatedAccumulated = Math.min(
    monthlyDepreciation * monthsElapsed,
    depreciableAmount
  );

  const accumulated = accumulatedDep || calculatedAccumulated;
  const bookValue = purchasePrice - accumulated;
  const remainingMonths = Math.max(0, usefulLifeMonths - monthsElapsed);

  return {
    annualDepreciation,
    monthlyDepreciation,
    accumulatedDepreciation: accumulated,
    bookValue,
    remainingMonths
  };
};

// Helper to generate depreciation schedule
const generateDepreciationSchedule = (
  purchasePrice: number,
  residualValue: number,
  usefulLifeMonths: number,
  annualDepreciation: number
) => {
  const usefulLifeYears = Math.ceil(usefulLifeMonths / 12);
  const schedule = [];
  let beginningValue = purchasePrice;
  let totalAccumulated = 0;

  for (let year = 1; year <= usefulLifeYears; year++) {
    const depreciation = Math.min(annualDepreciation, beginningValue - residualValue);
    totalAccumulated += depreciation;
    const endingValue = Math.max(purchasePrice - totalAccumulated, residualValue);

    schedule.push({
      year,
      beginningValue,
      depreciation,
      accumulatedDepreciation: totalAccumulated,
      endingValue
    });

    beginningValue = endingValue;

    if (endingValue <= residualValue) break;
  }

  return schedule;
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const category = searchParams.get('category') || 'all';
    const status = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sortBy') || 'assetNumber';

    // Fetch fixed assets with categories
    let assets;
    if (status !== 'all') {
      assets = await sql`
        SELECT fa.id, fa.asset_number, fa.name, fa.purchase_date, fa.purchase_price,
               fa.depreciation_method, fa.useful_life_months, fa.salvage_value,
               fa.accumulated_depreciation, fa.current_book_value, fa.status, fa.currency,
               ac.name AS category_name
        FROM fixed_assets fa
        LEFT JOIN asset_categories ac ON fa.category_id = ac.id
        WHERE fa.status = ${status}
        ORDER BY fa.asset_number
      `;
    } else {
      assets = await sql`
        SELECT fa.id, fa.asset_number, fa.name, fa.purchase_date, fa.purchase_price,
               fa.depreciation_method, fa.useful_life_months, fa.salvage_value,
               fa.accumulated_depreciation, fa.current_book_value, fa.status, fa.currency,
               ac.name AS category_name
        FROM fixed_assets fa
        LEFT JOIN asset_categories ac ON fa.category_id = ac.id
        ORDER BY fa.asset_number
      `;
    }

    // Transform and calculate depreciation for each asset
    let assetDepreciations: AssetDepreciation[] = assets.map((asset: any) => {
      const depCalc = calculateDepreciation(
        asset.purchase_date,
        parseFloat(asset.purchase_price) || 0,
        parseFloat(asset.salvage_value) || 0,
        parseInt(asset.useful_life_months) || 0,
        asset.depreciation_method || 'straight_line',
        parseFloat(asset.accumulated_depreciation) || 0
      );

      const schedule = generateDepreciationSchedule(
        parseFloat(asset.purchase_price) || 0,
        parseFloat(asset.salvage_value) || 0,
        parseInt(asset.useful_life_months) || 0,
        depCalc.annualDepreciation
      );

      return {
        assetId: asset.id,
        assetNumber: asset.asset_number || '',
        assetName: asset.name || '',
        category: asset.category_name || 'Uncategorized',
        purchaseDate: asset.purchase_date,
        purchasePrice: parseFloat(asset.purchase_price) || 0,
        depreciationMethod: asset.depreciation_method || 'straight_line',
        usefulLifeMonths: parseInt(asset.useful_life_months) || 0,
        salvageValue: parseFloat(asset.salvage_value) || 0,
        currentBookValue: depCalc.bookValue,
        accumulatedDepreciation: depCalc.accumulatedDepreciation,
        annualDepreciation: depCalc.annualDepreciation,
        monthlyDepreciation: depCalc.monthlyDepreciation,
        remainingLifeMonths: depCalc.remainingMonths,
        status: asset.status || 'active',
        depreciationSchedule: schedule,
        _currency: asset.currency || 'USD',
      };
    });

    // Filter by category
    if (category !== 'all') {
      assetDepreciations = assetDepreciations.filter(
        a => a.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Sort assets
    assetDepreciations.sort((a, b) => {
      switch (sortBy) {
        case 'assetName':
          return a.assetName.localeCompare(b.assetName);
        case 'purchaseDate':
          return new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime();
        case 'bookValue':
          return b.currentBookValue - a.currentBookValue;
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return a.assetNumber.localeCompare(b.assetNumber);
      }
    });

    // Calculate summary statistics with currency conversion to USD
    let totalCost = 0;
    let totalAccumulatedDepreciation = 0;
    let totalBookValue = 0;
    let annualDepreciation = 0;
    let monthlyDepreciation = 0;

    for (const asset of assetDepreciations as any[]) {
      const assetCurrency = asset._currency || 'USD';

      const convertIfNeeded = async (amount: number) => {
        if (assetCurrency === 'USD') return amount;
        const res = await sql`SELECT convert_currency(${amount}, ${assetCurrency}, 'USD', ${endDate}) AS val`;
        return res[0]?.val ?? amount;
      };

      const costUSD = await convertIfNeeded(asset.purchasePrice);
      const accumulatedUSD = await convertIfNeeded(asset.accumulatedDepreciation);
      const bookValueUSD = await convertIfNeeded(asset.currentBookValue);
      const annualDepUSD = await convertIfNeeded(asset.annualDepreciation);
      const monthlyDepUSD = await convertIfNeeded(asset.monthlyDepreciation);

      totalCost += costUSD;
      totalAccumulatedDepreciation += accumulatedUSD;
      totalBookValue += bookValueUSD;
      annualDepreciation += annualDepUSD;
      monthlyDepreciation += monthlyDepUSD;
    }

    const activeAssets = assetDepreciations.filter(a => a.status === 'active').length;
    const fullyDepreciated = assetDepreciations.filter(a => a.status === 'fully_depreciated').length;

    // Category breakdown with currency conversion
    const byCategory: Record<string, any> = {};
    for (const asset of assetDepreciations as any[]) {
      const assetCurrency = asset._currency || 'USD';
      const cat = asset.category || 'Uncategorized';
      if (!byCategory[cat]) {
        byCategory[cat] = { count: 0, cost: 0, accumulated: 0, bookValue: 0 };
      }

      const convertIfNeeded = async (amount: number) => {
        if (assetCurrency === 'USD') return amount;
        const res = await sql`SELECT convert_currency(${amount}, ${assetCurrency}, 'USD', ${endDate}) AS val`;
        return res[0]?.val ?? amount;
      };

      byCategory[cat].count += 1;
      byCategory[cat].cost += await convertIfNeeded(asset.purchasePrice);
      byCategory[cat].accumulated += await convertIfNeeded(asset.accumulatedDepreciation);
      byCategory[cat].bookValue += await convertIfNeeded(asset.currentBookValue);
    }

    // Method breakdown
    const byMethod: Record<string, any> = {};
    for (const asset of assetDepreciations as any[]) {
      const assetCurrency = asset._currency || 'USD';
      const method = asset.depreciationMethod || 'straight_line';
      if (!byMethod[method]) {
        byMethod[method] = { count: 0, cost: 0 };
      }

      let costUSD = asset.purchasePrice;
      if (assetCurrency !== 'USD') {
        const res = await sql`SELECT convert_currency(${asset.purchasePrice}, ${assetCurrency}, 'USD', ${endDate}) AS val`;
        costUSD = res[0]?.val ?? asset.purchasePrice;
      }

      byMethod[method].count += 1;
      byMethod[method].cost += costUSD;
    }

    // Strip internal _currency field before returning
    const cleanAssets = assetDepreciations.map(({ ...a }: any) => {
      delete a._currency;
      return a;
    });

    const response: DepreciationScheduleData = {
      reportPeriod: {
        startDate,
        endDate
      },
      summary: {
        totalAssets: assetDepreciations.length,
        totalOriginalCost: totalCost,
        totalCurrentValue: totalBookValue,
        totalAccumulatedDepreciation,
        annualDepreciationExpense: annualDepreciation,
        monthlyDepreciationExpense: monthlyDepreciation,
        activeAssets,
        fullyDepreciated
      },
      assets: cleanAssets,
      byCategory,
      byMethod
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Depreciation schedule report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate depreciation schedule report' },
      { status: 500 }
    );
  }
}

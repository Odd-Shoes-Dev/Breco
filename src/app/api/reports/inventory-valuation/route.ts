import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface InventoryItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  location: string;
  quantityOnHand: number;
  unitOfMeasure: string;
  unitCost: number;
  totalValue: number;
  reorderLevel: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

interface InventoryValuationData {
  reportDate: string;
  reportPeriod: {
    asOfDate: string;
  };
  summary: {
    totalItems: number;
    totalQuantity: number;
    totalValue: number;
    totalValueFIFO: number;
    totalValueLIFO: number;
    totalValueAverage: number;
    totalValueStandard: number;
    averageValue: number;
    lowStockItems: number;
    outOfStockItems: number;
    overstockItems: number;
    categories: number;
  };
  items: InventoryItem[];
  categoryBreakdown: Record<string, {
    count: number;
    value: number;
    percentage: number;
  }>;
  locationBreakdown: Record<string, {
    count: number;
    value: number;
  }>;
  valuationMethods: {
    fifo: { totalValue: number; variance: number };
    lifo: { totalValue: number; variance: number };
    average: { totalValue: number; variance: number };
    standard: { totalValue: number; variance: number };
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || 'all';
    const location = searchParams.get('location') || 'all';
    const status = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sortBy') || 'totalValue';

    const today = new Date().toISOString().split('T')[0];

    // Fetch inventory items from products table
    const inventory = await sql`
      SELECT p.id, p.sku, p.name, p.purchase_price,
             p.reorder_point, p.unit_of_measure,
             pc.name AS category_name,
             COALESCE((SELECT SUM(im.quantity) FROM inventory_movements im WHERE im.product_id = p.id), 0) AS quantity_on_hand
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      WHERE p.track_inventory = true
      ORDER BY p.id
    `;

    // Transform inventory data and convert to USD
    let items: InventoryItem[] = [];

    for (const item of inventory) {
      const quantityOnHand = item.quantity_on_hand || 0;
      const unitCost = item.purchase_price || 0;

      let unitCostUSD = unitCost;

      const totalValue = quantityOnHand * unitCostUSD;
      const reorderLevel = item.reorder_point || 0;

      let itemStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' = 'In Stock';
      if (quantityOnHand === 0) {
        itemStatus = 'Out of Stock';
      } else if (quantityOnHand <= reorderLevel) {
        itemStatus = 'Low Stock';
      }

      items.push({
        itemId: item.id,
        itemCode: item.sku || `ITEM-${item.id}`,
        itemName: item.name || 'Unknown Product',
        category: item.category_name || 'Uncategorized',
        location: 'Main Warehouse',
        quantityOnHand,
        unitOfMeasure: item.unit_of_measure || 'EA',
        unitCost: unitCostUSD,
        totalValue,
        reorderLevel,
        status: itemStatus,
      });
    }

    // Apply filters
    if (category !== 'all') {
      items = items.filter(item => item.category.toLowerCase() === category.toLowerCase());
    }

    if (location !== 'all') {
      items = items.filter(item => item.location.toLowerCase() === location.toLowerCase());
    }

    if (status !== 'all') {
      if (status === 'low-stock') {
        items = items.filter(item => item.status === 'Low Stock');
      } else if (status === 'out-of-stock') {
        items = items.filter(item => item.status === 'Out of Stock');
      } else if (status === 'in-stock') {
        items = items.filter(item => item.status === 'In Stock');
      }
    }

    // Sort items
    items.sort((a, b) => {
      switch (sortBy) {
        case 'itemName':
          return a.itemName.localeCompare(b.itemName);
        case 'totalValue':
          return b.totalValue - a.totalValue;
        case 'quantityOnHand':
          return b.quantityOnHand - a.quantityOnHand;
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return b.totalValue - a.totalValue;
      }
    });

    const totalValue = items.reduce((sum, item) => sum + item.totalValue, 0);
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantityOnHand, 0);
    const averageValue = totalItems > 0 ? totalValue / totalItems : 0;
    const lowStockItems = items.filter(item => item.status === 'Low Stock').length;
    const outOfStockItems = items.filter(item => item.status === 'Out of Stock').length;

    const categoryBreakdown: Record<string, { count: number; value: number; percentage: number }> = {};
    items.forEach(item => {
      const cat = item.category || 'Uncategorized';
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = { count: 0, value: 0, percentage: 0 };
      }
      categoryBreakdown[cat].count += 1;
      categoryBreakdown[cat].value += item.totalValue;
    });

    Object.values(categoryBreakdown).forEach(cat => {
      cat.percentage = totalValue > 0 ? (cat.value / totalValue) * 100 : 0;
    });

    const locationBreakdown: Record<string, { count: number; value: number }> = {};
    items.forEach(item => {
      const loc = item.location || 'Unknown';
      if (!locationBreakdown[loc]) {
        locationBreakdown[loc] = { count: 0, value: 0 };
      }
      locationBreakdown[loc].count += 1;
      locationBreakdown[loc].value += item.totalValue;
    });

    const categories = Object.keys(categoryBreakdown).length;

    const response: InventoryValuationData = {
      reportDate: today,
      reportPeriod: {
        asOfDate: today
      },
      summary: {
        totalItems,
        totalValue,
        totalQuantity,
        totalValueFIFO: totalValue,
        totalValueLIFO: totalValue,
        totalValueAverage: totalValue,
        totalValueStandard: totalValue,
        averageValue,
        lowStockItems,
        outOfStockItems,
        overstockItems: 0,
        categories
      },
      items,
      categoryBreakdown,
      locationBreakdown,
      valuationMethods: {
        fifo: { totalValue, variance: 0 },
        lifo: { totalValue, variance: 0 },
        average: { totalValue, variance: 0 },
        standard: { totalValue, variance: 0 }
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Inventory valuation report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate inventory valuation report' },
      { status: 500 }
    );
  }
}

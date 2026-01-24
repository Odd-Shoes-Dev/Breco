'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
  CubeIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface InventoryItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: 'Medical Equipment' | 'Surgical Instruments' | 'Disposables' | 'Pharmaceuticals' | 'Laboratory Supplies';
  location: string;
  quantityOnHand: number;
  unitOfMeasure: string;
  unitCost: number;
  averageCost: number;
  fifoValue: number;
  lifoValue: number;
  standardCost: number;
  lastReceived: string;
  lastIssued: string;
  reorderLevel: number;
  maxLevel: number;
  leadTimeDays: number;
  supplier: string;
  lotNumbers: Array<{
    lotNumber: string;
    quantity: number;
    unitCost: number;
    expirationDate?: string;
  }>;
  totalValue: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Overstock';
}

interface InventoryValuationData {
  reportPeriod: {
    asOfDate: string;
  };
  summary: {
    totalItems: number;
    totalQuantity: number;
    totalValueFIFO: number;
    totalValueLIFO: number;
    totalValueAverage: number;
    totalValueStandard: number;
    lowStockItems: number;
    outOfStockItems: number;
    overstockItems: number;
  };
  items: InventoryItem[];
  categoryBreakdown: {
    medicalEquipment: { items: number; quantity: number; value: number };
    surgicalInstruments: { items: number; quantity: number; value: number };
    disposables: { items: number; quantity: number; value: number };
    pharmaceuticals: { items: number; quantity: number; value: number };
    laboratorySupplies: { items: number; quantity: number; value: number };
  };
  valuationMethods: {
    fifo: { totalValue: number; variance: number };
    lifo: { totalValue: number; variance: number };
    average: { totalValue: number; variance: number };
    standard: { totalValue: number; variance: number };
  };
}

interface Category {
  id: string;
  name: string;
  description: string | null;
}

export default function InventoryValuationPage() {
  const [data, setData] = useState<InventoryValuationData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('all');
  const [valuationMethod, setValuationMethod] = useState('fifo');
  const [sortBy, setSortBy] = useState('totalValue');
  const [isLoading, setIsLoading] = useState(false);
  const [showLotDetails, setShowLotDetails] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchInventoryData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/inventory-valuation?asOfDate=${asOfDate}&category=${category}&valuationMethod=${valuationMethod}&sortBy=${sortBy}`
      );
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchInventoryData();
  }, [asOfDate, category, valuationMethod, sortBy]);

  const exportToPDF = () => {
    if (!data) return;

    const printHTML = `
      <html>
        <head>
          <title>Inventory Valuation Report - As of ${formatDate(data.reportPeriod.asOfDate)} - Breco Safaris Ltd</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #111827;
              background: white;
              padding: 40px;
            }
            .header { 
              display: flex; 
              align-items: center; 
              margin-bottom: 30px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 20px;
            }
            .logo { 
              width: 200px; 
              height: 200px; 
              margin-right: 20px;
              border-radius: 8px;
              object-fit: contain;
            }
            .company-info h1 { 
              font-size: 28px; 
              font-weight: bold; 
              color: #1e3a5f;
              margin-bottom: 4px;
            }
            .company-info .address { 
              font-size: 14px; 
              color: #6b7280;
              margin-bottom: 2px;
            }
            .report-header { 
              text-align: center;
              margin: 30px 0;
            }
            .report-header h2 { 
              font-size: 24px; 
              font-weight: bold; 
              color: #111827;
              margin-bottom: 8px;
            }
            .report-header .period { 
              font-size: 16px; 
              color: #6b7280;
            }
            .summary {
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              margin: 25px 0;
            }
            .summary h3 {
              font-size: 18px;
              font-weight: bold;
              color: #1e3a5f;
              margin-bottom: 15px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 20px;
            }
            .summary-item {
              text-align: center;
              padding: 15px;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              background: white;
            }
            .summary-item h4 {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 5px;
              text-transform: uppercase;
            }
            .summary-item .value {
              font-size: 18px;
              font-weight: bold;
              color: #1f2937;
            }
            table { 
              width: 100%; 
              border-collapse: collapse;
              margin: 25px 0;
            }
            th { 
              background: #f9fafb; 
              padding: 12px; 
              border: 1px solid #e5e7eb;
              font-size: 12px;
              font-weight: bold;
              text-align: left;
            }
            th.number { text-align: right; }
            td { 
              padding: 10px 12px; 
              border: 1px solid #e5e7eb;
              font-size: 13px;
            }
            .item-row:hover { background: #f9fafb; }
            .number { 
              text-align: right;
              font-family: 'SF Mono', Consolas, monospace;
            }
            .category-medical { color: #2563eb; }
            .category-surgical { color: #16a34a; }
            .category-disposables { color: #dc2626; }
            .category-pharmaceuticals { color: #7c3aed; }
            .category-laboratory { color: #ea580c; }
            .status-in-stock { color: #16a34a; }
            .status-low-stock { color: #d97706; }
            .status-out-of-stock { color: #dc2626; }
            .status-overstock { color: #2563eb; }
            @media print {
              body { padding: 20px; }
              .header { margin-bottom: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="/assets/logo.jpg" alt="Breco Safaris Logo" class="logo" />
            <div class="company-info">
              <h1>Breco Safaris Ltd</h1>
              <div class="address">Kampala Road Plot 14 Eagen House, Russel Street, P.O.Box 144011, Kampala, Uganda</div>
              <div class="address">Tel: +256 782 884 933, +256 772 891 729 • Email: brecosafaris@gmail.com</div>
              <div class="address">URA TIN: 1014756280 • URSB Reg. No: 80020001634842</div>
            </div>
          </div>
          
          <div class="report-header">
            <h2>Inventory Valuation Report</h2>
            <div class="period">
              As of ${formatDate(data.reportPeriod.asOfDate)}
            </div>
          </div>

          <div class="summary">
            <h3>Summary (${valuationMethod.toUpperCase()} Method)</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <h4>Total Items</h4>
                <div class="value">${data.summary.totalItems}</div>
              </div>
              <div class="summary-item">
                <h4>Total Quantity</h4>
                <div class="value">${data.summary.totalQuantity.toLocaleString()}</div>
              </div>
              <div class="summary-item">
                <h4>Total Value</h4>
                <div class="value">${formatCurrency(data.summary.totalValueFIFO)}</div>
              </div>
              <div class="summary-item">
                <h4>Low Stock Items</h4>
                <div class="value">${data.summary.lowStockItems}</div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 20%">Item</th>
                <th style="width: 15%">Category</th>
                <th style="width: 10%">Location</th>
                <th class="number" style="width: 10%">Qty</th>
                <th class="number" style="width: 12%">Unit Cost</th>
                <th class="number" style="width: 13%">Total Value</th>
                <th style="width: 10%">Status</th>
                <th style="width: 10%">Last Received</th>
              </tr>
            </thead>
            <tbody>
              ${data.items.map(item => `
                <tr class="item-row">
                  <td>
                    <strong>${item.itemName}</strong><br>
                    <small>${item.itemCode}</small>
                  </td>
                  <td class="category-${item.category.toLowerCase().replace(/\s+/g, '-')}">${item.category}</td>
                  <td>${item.location}</td>
                  <td class="number">${item.quantityOnHand} ${item.unitOfMeasure}</td>
                  <td class="number">${formatCurrency(item.unitCost)}</td>
                  <td class="number">${formatCurrency(item.totalValue)}</td>
                  <td class="status-${item.status.toLowerCase().replace(/\s+/g, '-')}">${item.status}</td>
                  <td>${formatDate(item.lastReceived)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Medical Equipment':
        return 'text-blue-600 bg-blue-50';
      case 'Surgical Instruments':
        return 'text-green-600 bg-green-50';
      case 'Disposables':
        return 'text-red-600 bg-red-50';
      case 'Pharmaceuticals':
        return 'text-purple-600 bg-purple-50';
      case 'Laboratory Supplies':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Stock':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'Low Stock':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Out of Stock':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'Overstock':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'In Stock':
        return <CheckCircleIcon className="w-4 h-4" />;
      case 'Low Stock':
        return <ExclamationTriangleIcon className="w-4 h-4" />;
      case 'Out of Stock':
        return <ExclamationTriangleIcon className="w-4 h-4" />;
      case 'Overstock':
        return <ClockIcon className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getValuationMethodValue = (item: InventoryItem, method: string) => {
    switch (method) {
      case 'fifo':
        return item.fifoValue;
      case 'lifo':
        return item.lifoValue;
      case 'average':
        return item.averageCost * item.quantityOnHand;
      case 'standard':
        return item.standardCost * item.quantityOnHand;
      default:
        return item.totalValue;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/dashboard/reports" className="btn-ghost p-1.5 sm:p-2">
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Inventory Valuation</h1>
            <p className="text-sm sm:text-base text-gray-600">Comprehensive inventory valuation and analysis</p>
          </div>
        </div>
        <button
          onClick={exportToPDF}
          disabled={!data}
          className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownTrayIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Export PDF</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">As of Date</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Valuation Method</label>
            <select
              value={valuationMethod}
              onChange={(e) => setValuationMethod(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="fifo">FIFO</option>
              <option value="lifo">LIFO</option>
              <option value="average">Average Cost</option>
              <option value="standard">Standard Cost</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="block w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
            >
              <option value="totalValue">Total Value</option>
              <option value="itemName">Item Name</option>
              <option value="category">Category</option>
              <option value="quantityOnHand">Quantity</option>
              <option value="unitCost">Unit Cost</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchInventoryData}
              disabled={isLoading}
              className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-breco-navy text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-breco-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Refresh Report'}
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-breco-navy mx-auto"></div>
          <p className="text-gray-500 mt-4 text-sm sm:text-base">Loading inventory data...</p>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CubeIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Items</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{data?.summary?.totalItems || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ChartBarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Quantity</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{data?.summary?.totalQuantity?.toLocaleString() || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CurrencyDollarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">
                    {formatCurrency(
                      valuationMethod === 'fifo' ? data?.summary?.totalValueFIFO :
                      valuationMethod === 'lifo' ? data?.summary?.totalValueLIFO :
                      valuationMethod === 'average' ? data?.summary?.totalValueAverage :
                      data?.summary?.totalValueStandard || 0
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CheckCircleIcon className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">In Stock</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{(data?.summary?.totalItems || 0) - (data?.summary?.outOfStockItems || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ExclamationTriangleIcon className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Low Stock</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{data?.summary?.lowStockItems || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ExclamationTriangleIcon className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Out of Stock</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{data?.summary?.outOfStockItems || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Valuation Method Comparison */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-4">Valuation Method Comparison</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
                <CurrencyDollarIcon className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-blue-600">FIFO</p>
                <p className="text-lg font-bold text-blue-700">{formatCurrency(data?.summary?.totalValueFIFO || 0)}</p>
                <p className="text-xs text-blue-600">First In, First Out</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
                <CurrencyDollarIcon className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-600">LIFO</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(data?.summary?.totalValueLIFO || 0)}</p>
                <p className="text-xs text-green-600">Last In, First Out</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-purple-50 border border-purple-200">
                <CurrencyDollarIcon className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-purple-600">Average</p>
                <p className="text-lg font-bold text-purple-700">{formatCurrency(data?.summary?.totalValueAverage || 0)}</p>
                <p className="text-xs text-purple-600">Weighted Average</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-orange-50 border border-orange-200">
                <CurrencyDollarIcon className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-orange-600">Standard</p>
                <p className="text-lg font-bold text-orange-700">{formatCurrency(data?.summary?.totalValueStandard || 0)}</p>
                <p className="text-xs text-orange-600">Standard Cost</p>
              </div>
            </div>
          </div>

          {/* Inventory Items Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <CubeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-breco-navy" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Inventory Items ({valuationMethod.toUpperCase()} Method)</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit Cost
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Value
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Received
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.items?.length || 0) === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">
                        No inventory items found
                      </td>
                    </tr>
                  ) : (
                    (data?.items || []).map((item) => (
                      <tr key={item.itemId} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div>
                            <div className="text-xs sm:text-sm font-medium text-gray-900">{item.itemName}</div>
                            <div className="text-xs text-gray-500">{item.itemCode}</div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={cn(
                            'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                            getCategoryColor(item.category)
                          )}>
                            {item.category}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700">
                          {item.location}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-900">
                          {item.quantityOnHand} {item.unitOfMeasure}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums text-gray-900">
                          {formatCurrency(item.unitCost)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right tabular-nums font-medium text-gray-900">
                          {formatCurrency(getValuationMethodValue(item, valuationMethod))}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border',
                            getStatusColor(item.status)
                          )}>
                            {getStatusIcon(item.status)}
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700">
                          {formatDate(item.lastReceived)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                          <button
                            onClick={() => setShowLotDetails(showLotDetails === item.itemId ? null : item.itemId)}
                            className="text-breco-navy hover:text-breco-navy/80 text-xs font-medium"
                          >
                            Lots
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lot Details Modal */}
          {showLotDetails && data?.items && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-auto">
                <div className="p-6">
                  {(() => {
                    const item = data.items.find(i => i.itemId === showLotDetails);
                    if (!item) return null;
                    
                    return (
                      <>
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{item.itemName}</h3>
                            <p className="text-sm text-gray-600">Lot Number Details</p>
                          </div>
                          <button
                            onClick={() => setShowLotDetails(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Item Code</p>
                            <p className="text-sm font-semibold text-gray-900">{item.itemCode}</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Total Quantity</p>
                            <p className="text-sm font-semibold text-gray-900">{item.quantityOnHand} {item.unitOfMeasure}</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Supplier</p>
                            <p className="text-sm font-semibold text-gray-900">{item.supplier}</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Lead Time</p>
                            <p className="text-sm font-semibold text-gray-900">{item.leadTimeDays} days</p>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Lot Number</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expiration</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {item.lotNumbers.map((lot, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm text-gray-900">{lot.lotNumber}</td>
                                  <td className="px-4 py-2 text-sm text-right tabular-nums text-gray-900">{lot.quantity}</td>
                                  <td className="px-4 py-2 text-sm text-right tabular-nums text-gray-900">{formatCurrency(lot.unitCost)}</td>
                                  <td className="px-4 py-2 text-sm text-right tabular-nums text-gray-900">{formatCurrency(lot.quantity * lot.unitCost)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-700">
                                    {lot.expirationDate ? formatDate(lot.expirationDate) : 'N/A'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <CubeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-sm sm:text-base">Loading inventory data...</p>
        </div>
      )}
    </div>
  );
}

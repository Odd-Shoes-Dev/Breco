'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  PlayIcon,
  DocumentArrowDownIcon,
  PlusIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  TableCellsIcon,
  ChartBarIcon,
  CalendarIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate } from '@/lib/utils';

interface DataSource {
  id: string;
  name: string;
  description: string;
  fields: Field[];
}

interface Field {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  table: string;
  displayName: string;
}

interface Filter {
  id: string;
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'between' | 'in_range';
  value: string | number | [string | number, string | number];
}

interface Sort {
  fieldId: string;
  direction: 'asc' | 'desc';
}

interface CustomReportConfig {
  name: string;
  description: string;
  dataSource: string;
  selectedFields: string[];
  filters: Filter[];
  sorts: Sort[];
  groupBy?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

const dataSources: DataSource[] = [
  {
    id: 'transactions',
    name: 'Financial Transactions',
    description: 'All journal entries, invoices, bills, and payments',
    fields: [
      { id: 'date', name: 'date', type: 'date', table: 'transactions', displayName: 'Date' },
      { id: 'amount', name: 'amount', type: 'currency', table: 'transactions', displayName: 'Amount' },
      { id: 'account_name', name: 'account_name', type: 'text', table: 'accounts', displayName: 'Account' },
      { id: 'account_type', name: 'account_type', type: 'text', table: 'accounts', displayName: 'Account Type' },
      { id: 'description', name: 'description', type: 'text', table: 'transactions', displayName: 'Description' },
      { id: 'reference', name: 'reference', type: 'text', table: 'transactions', displayName: 'Reference' },
      { id: 'debit_amount', name: 'debit_amount', type: 'currency', table: 'transactions', displayName: 'Debit' },
      { id: 'credit_amount', name: 'credit_amount', type: 'currency', table: 'transactions', displayName: 'Credit' },
    ],
  },
  {
    id: 'customers',
    name: 'Customer Data',
    description: 'Customer information and sales performance',
    fields: [
      { id: 'customer_name', name: 'name', type: 'text', table: 'customers', displayName: 'Customer Name' },
      { id: 'customer_type', name: 'customer_type', type: 'text', table: 'customers', displayName: 'Customer Type' },
      { id: 'total_sales', name: 'total_sales', type: 'currency', table: 'customers', displayName: 'Total Sales' },
      { id: 'invoice_count', name: 'invoice_count', type: 'number', table: 'customers', displayName: 'Invoice Count' },
      { id: 'first_sale_date', name: 'first_sale_date', type: 'date', table: 'customers', displayName: 'First Sale' },
      { id: 'last_sale_date', name: 'last_sale_date', type: 'date', table: 'customers', displayName: 'Last Sale' },
      { id: 'average_sale', name: 'average_sale', type: 'currency', table: 'customers', displayName: 'Average Sale' },
    ],
  },
  {
    id: 'vendors',
    name: 'Vendor Data',
    description: 'Vendor information and purchase history',
    fields: [
      { id: 'vendor_name', name: 'name', type: 'text', table: 'vendors', displayName: 'Vendor Name' },
      { id: 'vendor_type', name: 'vendor_type', type: 'text', table: 'vendors', displayName: 'Vendor Type' },
      { id: 'total_purchases', name: 'total_purchases', type: 'currency', table: 'vendors', displayName: 'Total Purchases' },
      { id: 'bill_count', name: 'bill_count', type: 'number', table: 'vendors', displayName: 'Bill Count' },
      { id: 'first_purchase_date', name: 'first_purchase_date', type: 'date', table: 'vendors', displayName: 'First Purchase' },
      { id: 'last_purchase_date', name: 'last_purchase_date', type: 'date', table: 'vendors', displayName: 'Last Purchase' },
      { id: 'average_purchase', name: 'average_purchase', type: 'currency', table: 'vendors', displayName: 'Average Purchase' },
    ],
  },
  {
    id: 'inventory',
    name: 'Inventory Items',
    description: 'Product inventory and stock movements',
    fields: [
      { id: 'item_name', name: 'name', type: 'text', table: 'inventory_items', displayName: 'Item Name' },
      { id: 'sku', name: 'sku', type: 'text', table: 'inventory_items', displayName: 'SKU' },
      { id: 'quantity_on_hand', name: 'quantity_on_hand', type: 'number', table: 'inventory_items', displayName: 'On Hand' },
      { id: 'unit_cost', name: 'unit_cost', type: 'currency', table: 'inventory_items', displayName: 'Unit Cost' },
      { id: 'total_value', name: 'total_value', type: 'currency', table: 'inventory_items', displayName: 'Total Value' },
      { id: 'reorder_point', name: 'reorder_point', type: 'number', table: 'inventory_items', displayName: 'Reorder Point' },
      { id: 'last_movement_date', name: 'last_movement_date', type: 'date', table: 'inventory_items', displayName: 'Last Movement' },
    ],
  },
];

const operators = [
  { value: 'equals', label: 'Equals', types: ['text', 'number', 'date', 'currency', 'boolean'] },
  { value: 'not_equals', label: 'Not Equals', types: ['text', 'number', 'date', 'currency', 'boolean'] },
  { value: 'greater_than', label: 'Greater Than', types: ['number', 'date', 'currency'] },
  { value: 'less_than', label: 'Less Than', types: ['number', 'date', 'currency'] },
  { value: 'contains', label: 'Contains', types: ['text'] },
  { value: 'between', label: 'Between', types: ['number', 'date', 'currency'] },
  { value: 'in_range', label: 'In Date Range', types: ['date'] },
];

export default function CustomReportsPage() {
  const [config, setConfig] = useState<CustomReportConfig>({
    name: '',
    description: '',
    dataSource: '',
    selectedFields: [],
    filters: [],
    sorts: [],
    dateRange: {
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    },
  });
  
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('config');

  const selectedDataSource = dataSources.find(ds => ds.id === config.dataSource);

  const addField = (fieldId: string) => {
    if (!config.selectedFields.includes(fieldId)) {
      setConfig(prev => ({
        ...prev,
        selectedFields: [...prev.selectedFields, fieldId],
      }));
    }
  };

  const removeField = (fieldId: string) => {
    setConfig(prev => ({
      ...prev,
      selectedFields: prev.selectedFields.filter(id => id !== fieldId),
    }));
  };

  const addFilter = () => {
    const newFilter: Filter = {
      id: `filter_${Date.now()}`,
      fieldId: selectedDataSource?.fields[0]?.id || '',
      operator: 'equals',
      value: '',
    };
    setConfig(prev => ({
      ...prev,
      filters: [...prev.filters, newFilter],
    }));
  };

  const updateFilter = (filterId: string, updates: Partial<Filter>) => {
    setConfig(prev => ({
      ...prev,
      filters: prev.filters.map(filter =>
        filter.id === filterId ? { ...filter, ...updates } : filter
      ),
    }));
  };

  const removeFilter = (filterId: string) => {
    setConfig(prev => ({
      ...prev,
      filters: prev.filters.filter(f => f.id !== filterId),
    }));
  };

  const addSort = (fieldId: string, direction: 'asc' | 'desc') => {
    setConfig(prev => ({
      ...prev,
      sorts: prev.sorts.filter(s => s.fieldId !== fieldId).concat({ fieldId, direction }),
    }));
  };

  const removeSort = (fieldId: string) => {
    setConfig(prev => ({
      ...prev,
      sorts: prev.sorts.filter(s => s.fieldId !== fieldId),
    }));
  };

  const runReport = async () => {
    if (!config.dataSource || config.selectedFields.length === 0) {
      alert('Please select a data source and at least one field');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Sending config:', config);
      const response = await fetch('/api/reports/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Server error response:', data);
        alert(`Failed to run report: ${data.error || 'Unknown error'}`);
        return;
      }
      
      console.log('Report data received:', data);
      setReportData(data);
      setActiveTab('preview');
    } catch (error) {
      console.error('Failed to run report:', error);
      alert('Failed to run report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = (format: 'csv' | 'excel' | 'pdf') => {
    if (!reportData) return;
    
    const params = new URLSearchParams({
      format,
      config: JSON.stringify(config),
    });
    
    window.open(`/api/reports/custom/export?${params}`, '_blank');
  };

  const getFieldDisplayName = (fieldId: string) => {
    return selectedDataSource?.fields.find(f => f.id === fieldId)?.displayName || fieldId;
  };

  const getOperatorsForField = (fieldId: string) => {
    const field = selectedDataSource?.fields.find(f => f.id === fieldId);
    if (!field) return [];
    return operators.filter(op => op.types.includes(field.type));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/dashboard/reports" className="btn-ghost p-1.5 sm:p-2">
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Custom Report Builder</h1>
            <p className="text-gray-600">Build custom reports with flexible data sources and filters</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runReport}
            disabled={isLoading || !config.dataSource || config.selectedFields.length === 0}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
          >
            <PlayIcon className="w-4 h-4" />
            {isLoading ? 'Running...' : 'Run Report'}
          </button>
          {reportData && (
            <div className="flex gap-1">
              <button
                onClick={() => exportReport('csv')}
                className="btn-ghost px-3 py-2 text-xs"
              >
                CSV
              </button>
              <button
                onClick={() => exportReport('excel')}
                className="btn-ghost px-3 py-2 text-xs"
              >
                Excel
              </button>
              <button
                onClick={() => exportReport('pdf')}
                className="btn-ghost px-3 py-2 text-xs"
              >
                PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'config'
                ? 'border-breco-navy text-breco-navy'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <AdjustmentsHorizontalIcon className="w-4 h-4 inline mr-2" />
            Configuration
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'preview'
                ? 'border-breco-navy text-breco-navy'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TableCellsIcon className="w-4 h-4 inline mr-2" />
            Preview {reportData && `(${reportData.rows?.length || 0} rows)`}
          </button>
        </nav>
      </div>

      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Report Name</label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
                  placeholder="My Custom Report"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <input
                  type="text"
                  value={config.description}
                  onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
                  placeholder="Report description"
                />
              </div>
            </div>
          </div>

          {/* Data Source Selection */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Source</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dataSources.map((source) => (
                <div
                  key={source.id}
                  onClick={() => setConfig(prev => ({ ...prev, dataSource: source.id, selectedFields: [], filters: [], sorts: [] }))}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    config.dataSource === source.id
                      ? 'border-breco-navy bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <h4 className="font-medium text-gray-900 mb-1">{source.name}</h4>
                  <p className="text-sm text-gray-600">{source.description}</p>
                  <p className="text-xs text-gray-500 mt-2">{source.fields.length} fields available</p>
                </div>
              ))}
            </div>
          </div>

          {selectedDataSource && (
            <>
              {/* Field Selection */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Fields</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Available Fields */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Available Fields</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedDataSource.fields
                        .filter(field => !config.selectedFields.includes(field.id))
                        .map((field) => (
                          <div
                            key={field.id}
                            onClick={() => addField(field.id)}
                            className="flex items-center justify-between p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50"
                          >
                            <div>
                              <span className="text-sm font-medium">{field.displayName}</span>
                              <span className="text-xs text-gray-500 ml-2">({field.type})</span>
                            </div>
                            <PlusIcon className="w-4 h-4 text-gray-400" />
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Selected Fields */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Selected Fields</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {config.selectedFields.map((fieldId) => {
                        const field = selectedDataSource.fields.find(f => f.id === fieldId);
                        if (!field) return null;
                        
                        return (
                          <div
                            key={fieldId}
                            className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded"
                          >
                            <div>
                              <span className="text-sm font-medium">{field.displayName}</span>
                              <span className="text-xs text-gray-500 ml-2">({field.type})</span>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => addSort(fieldId, 'asc')}
                                className={`text-xs px-2 py-1 rounded ${
                                  config.sorts.find(s => s.fieldId === fieldId)?.direction === 'asc'
                                    ? 'bg-breco-navy text-white'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => addSort(fieldId, 'desc')}
                                className={`text-xs px-2 py-1 rounded ${
                                  config.sorts.find(s => s.fieldId === fieldId)?.direction === 'desc'
                                    ? 'bg-breco-navy text-white'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                ↓
                              </button>
                              <button
                                onClick={() => removeField(fieldId)}
                                className="text-red-600 hover:bg-red-50 p-1 rounded"
                              >
                                <XMarkIcon className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {config.selectedFields.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">No fields selected</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                  <button
                    onClick={addFilter}
                    className="btn-ghost inline-flex items-center gap-2 text-sm"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Filter
                  </button>
                </div>
                
                <div className="space-y-3">
                  {config.filters.map((filter) => {
                    const field = selectedDataSource.fields.find(f => f.id === filter.fieldId);
                    const availableOperators = getOperatorsForField(filter.fieldId);
                    
                    return (
                      <div key={filter.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <select
                          value={filter.fieldId}
                          onChange={(e) => updateFilter(filter.id, { fieldId: e.target.value })}
                          className="px-3 py-1 border border-gray-300 rounded text-sm"
                        >
                          {selectedDataSource.fields.map(field => (
                            <option key={field.id} value={field.id}>{field.displayName}</option>
                          ))}
                        </select>
                        
                        <select
                          value={filter.operator}
                          onChange={(e) => updateFilter(filter.id, { operator: e.target.value as any })}
                          className="px-3 py-1 border border-gray-300 rounded text-sm"
                        >
                          {availableOperators.map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>
                        
                        <input
                          type={field?.type === 'number' || field?.type === 'currency' ? 'number' : field?.type === 'date' ? 'date' : 'text'}
                          value={Array.isArray(filter.value) ? filter.value[0] : filter.value}
                          onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                          className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Value"
                        />
                        
                        <button
                          onClick={() => removeFilter(filter.id)}
                          className="text-red-600 hover:bg-red-50 p-1 rounded"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                  
                  {config.filters.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No filters applied</p>
                  )}
                </div>
              </div>

              {/* Date Range */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Range</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={config.dateRange?.startDate || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange!, startDate: e.target.value }
                      }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={config.dateRange?.endDate || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange!, endDate: e.target.value }
                      }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-breco-navy focus:border-breco-navy"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="card overflow-hidden">
          {reportData ? (
            <>
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {config.name || 'Custom Report'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {reportData.rows?.length || 0} rows • Generated {formatDate(new Date().toISOString())}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportReport('csv')}
                      className="btn-ghost text-sm"
                    >
                      <DocumentArrowDownIcon className="w-4 h-4 inline mr-1" />
                      Export
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {config.selectedFields.map((fieldId) => (
                        <th
                          key={fieldId}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {getFieldDisplayName(fieldId)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.rows?.map((row: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        {config.selectedFields.map((fieldId) => {
                          const field = selectedDataSource?.fields.find(f => f.id === fieldId);
                          const value = row[fieldId];
                          
                          return (
                            <td key={fieldId} className="px-4 py-3 text-sm text-gray-900">
                              {field?.type === 'currency' ? formatCurrency(value || 0) :
                               field?.type === 'date' ? formatDate(value) :
                               field?.type === 'number' ? (value || 0).toLocaleString() :
                               value || '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {(!reportData.rows || reportData.rows.length === 0) && (
                  <div className="text-center py-8">
                    <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No data found matching your criteria</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <TableCellsIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Report Generated</h3>
              <p className="text-gray-500 mb-4">Configure your report and click "Run Report" to see results</p>
              <button
                onClick={() => setActiveTab('config')}
                className="btn-primary"
              >
                Configure Report
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { getCompanySettings } from '@/lib/company-settings';

interface CustomReportConfig {
  name: string;
  description: string;
  dataSource: string;
  selectedFields: string[];
  filters: any[];
  sorts: any[];
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

const dataSources = {
  transactions: 'Financial Transactions',
  customers: 'Customer Data',
  vendors: 'Vendor Data',
  inventory: 'Inventory Items',
};

const fieldDisplayNames: Record<string, string> = {
  date: 'Date',
  amount: 'Amount',
  account_name: 'Account',
  account_type: 'Account Type',
  description: 'Description',
  reference: 'Reference',
  debit_amount: 'Debit',
  credit_amount: 'Credit',
  customer_name: 'Customer Name',
  customer_type: 'Customer Type',
  total_sales: 'Total Sales',
  invoice_count: 'Invoice Count',
  first_sale_date: 'First Sale',
  last_sale_date: 'Last Sale',
  average_sale: 'Average Sale',
  vendor_name: 'Vendor Name',
  vendor_type: 'Vendor Type',
  total_purchases: 'Total Purchases',
  bill_count: 'Bill Count',
  first_purchase_date: 'First Purchase',
  last_purchase_date: 'Last Purchase',
  average_purchase: 'Average Purchase',
  item_name: 'Item Name',
  sku: 'SKU',
  quantity_on_hand: 'On Hand',
  unit_cost: 'Unit Cost',
  total_value: 'Total Value',
  reorder_point: 'Reorder Point',
  last_movement_date: 'Last Movement',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const configParam = searchParams.get('config');
    
    if (!configParam) {
      return NextResponse.json(
        { error: 'Missing configuration parameter' },
        { status: 400 }
      );
    }

    const config: CustomReportConfig = JSON.parse(configParam);

    // Fetch company settings
    const companySettings = await getCompanySettings();

    // Re-generate the report data (in a real app, this would use the same logic as the main API)
    const response = await fetch(`${request.nextUrl.origin}/api/reports/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    
    const reportData = await response.json();
    
    if (format === 'csv') {
      return exportCSV(config, reportData);
    } else if (format === 'excel') {
      return exportExcel(config, reportData);
    } else if (format === 'pdf') {
      return exportPDF(config, reportData, request.nextUrl.origin, companySettings);
    }

    return NextResponse.json(
      { error: 'Unsupported format' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Export failed:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}

function exportCSV(config: CustomReportConfig, reportData: any) {
  const headers = config.selectedFields.map(fieldId => 
    fieldDisplayNames[fieldId] || fieldId
  );
  
  const csvRows = [headers.join(',')];
  
  reportData.rows.forEach((row: any) => {
    const values = config.selectedFields.map(fieldId => {
      const value = row[fieldId];
      if (value === null || value === undefined) return '';
      
      // Handle different data types
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  });

  const csvContent = csvRows.join('\n');
  const filename = `${config.name || 'custom-report'}-${new Date().toISOString().split('T')[0]}.csv`;

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function exportExcel(config: CustomReportConfig, reportData: any) {
  // For a real implementation, you would use a library like xlsx
  // For now, we'll return CSV with Excel content type
  const headers = config.selectedFields.map(fieldId => 
    fieldDisplayNames[fieldId] || fieldId
  );
  
  const csvRows = [headers.join('\t')];
  
  reportData.rows.forEach((row: any) => {
    const values = config.selectedFields.map(fieldId => {
      const value = row[fieldId];
      if (value === null || value === undefined) return '';
      return value;
    });
    csvRows.push(values.join('\t'));
  });

  const content = csvRows.join('\n');
  const filename = `${config.name || 'custom-report'}-${new Date().toISOString().split('T')[0]}.xls`;

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function exportPDF(config: CustomReportConfig, reportData: any, origin: string, companySettings: any) {
  const reportName = config.name || 'Custom Report';
  const reportDescription = config.description || 'Generated custom report';
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${reportName} - ${companySettings.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #111827;
            background: white;
            padding: 40px;
            font-size: 12px;
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
            margin-right: 15px;
            border-radius: 6px;
            object-fit: contain;
          }
          .company-info h1 { 
            font-size: 24px; 
            font-weight: bold; 
            color: #1e3a5f;
            margin-bottom: 4px;
          }
          .company-info .address { 
            font-size: 11px; 
            color: #6b7280;
            margin-bottom: 2px;
          }
          .report-header { 
            text-align: center;
            margin: 20px 0;
          }
          .report-header h2 { 
            font-size: 20px; 
            font-weight: bold; 
            color: #111827;
            margin-bottom: 8px;
          }
          .report-header .description { 
            font-size: 14px; 
            color: #6b7280;
            margin-bottom: 4px;
          }
          .report-header .date { 
            font-size: 12px; 
            color: #6b7280;
          }
          .summary {
            background: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
          }
          .summary h3 {
            font-size: 14px;
            font-weight: bold;
            color: #1e3a5f;
            margin-bottom: 10px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
          }
          .summary-item {
            text-align: center;
            padding: 10px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            background: white;
          }
          .summary-item h4 {
            font-size: 10px;
            color: #6b7280;
            margin-bottom: 4px;
            text-transform: uppercase;
          }
          .summary-item .value {
            font-size: 14px;
            font-weight: bold;
            color: #1f2937;
          }
          table { 
            width: 100%; 
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 11px;
          }
          th { 
            background: #f9fafb; 
            padding: 8px; 
            border: 1px solid #e5e7eb;
            font-size: 10px;
            font-weight: bold;
            text-align: left;
          }
          td { 
            padding: 6px 8px; 
            border: 1px solid #e5e7eb;
            font-size: 11px;
          }
          .number { 
            text-align: right;
            font-family: 'SF Mono', Consolas, monospace;
          }
          @media print {
            body { padding: 20px; font-size: 10px; }
            .header { margin-bottom: 15px; }
            table { font-size: 9px; }
            th { padding: 6px; font-size: 8px; }
            td { padding: 4px 6px; font-size: 9px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${origin}/Breco Safaris%20assets/Breco Safaris_logo.png" alt="Logo" class="logo" onerror="this.style.display='none'" />
          <div class="company-info">
            <h1>${companySettings.name}</h1>
            <div class="address">${companySettings.address_line1}${companySettings.address_line2 ? ', ' + companySettings.address_line2 : ''}, ${companySettings.city}, ${companySettings.state} ${companySettings.zip_code}</div>
            <div class="address">Phone: ${companySettings.phone}</div>
          </div>
        </div>
        
        <div class="report-header">
          <h2>${reportName}</h2>
          <div class="description">${reportDescription}</div>
          <div class="date">Generated on ${generatedDate}</div>
        </div>

        <div class="summary">
          <h3>Report Summary</h3>
          <div class="summary-grid">
            <div class="summary-item">
              <h4>Data Source</h4>
              <div class="value">${dataSources[config.dataSource as keyof typeof dataSources] || config.dataSource}</div>
            </div>
            <div class="summary-item">
              <h4>Total Records</h4>
              <div class="value">${reportData.rows?.length || 0}</div>
            </div>
            <div class="summary-item">
              <h4>Fields Selected</h4>
              <div class="value">${config.selectedFields.length}</div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              ${config.selectedFields.map(fieldId => 
                `<th>${fieldDisplayNames[fieldId] || fieldId}</th>`
              ).join('')}
            </tr>
          </thead>
          <tbody>
            ${reportData.rows?.map((row: any) => 
              `<tr>
                ${config.selectedFields.map(fieldId => {
                  const value = row[fieldId];
                  if (value === null || value === undefined) return '<td>-</td>';
                  
                  // Format based on field type
                  if (fieldId.includes('amount') || fieldId.includes('cost') || fieldId.includes('value') || fieldId.includes('sales') || fieldId.includes('purchase')) {
                    return `<td class="number">${formatCurrency(Number(value))}</td>`;
                  } else if (fieldId.includes('date')) {
                    return `<td>${formatDate(value)}</td>`;
                  } else if (fieldId.includes('count') || fieldId.includes('quantity')) {
                    return `<td class="number">${Number(value).toLocaleString()}</td>`;
                  } else {
                    return `<td>${value}</td>`;
                  }
                }).join('')}
              </tr>`
            ).join('') || '<tr><td colspan="' + config.selectedFields.length + '" style="text-align: center; padding: 20px; color: #6b7280;">No data available</td></tr>'}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const filename = `${config.name || 'custom-report'}-${new Date().toISOString().split('T')[0]}.html`;

  return new NextResponse(htmlContent, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

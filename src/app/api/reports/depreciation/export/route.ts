import { NextRequest, NextResponse } from 'next/server';
import { getCompanySettings } from '@/lib/company-settings';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
    const dataParam = searchParams.get('data');
    
    if (!dataParam) {
      return NextResponse.json(
        { error: 'Missing report data' },
        { status: 400 }
      );
    }

    const data = JSON.parse(dataParam);
    const companySettings = await getCompanySettings();
    const origin = request.nextUrl.origin;

    const printHTML = `
      <html>
        <head>
          <title>Asset Depreciation Schedule - ${formatDate(data.reportPeriod.startDate)} to ${formatDate(data.reportPeriod.endDate)} - ${companySettings.name}</title>
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
              grid-template-columns: repeat(3, 1fr);
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
            .asset-row:hover { background: #f9fafb; }
            .number { 
              text-align: right;
              font-family: 'SF Mono', Consolas, monospace;
            }
            .type-equipment { color: #2563eb; }
            .type-furniture { color: #16a34a; }
            .type-vehicle { color: #dc2626; }
            .type-building { color: #7c3aed; }
            .type-technology { color: #ea580c; }
            @media print {
              body { padding: 20px; }
              .header { margin-bottom: 20px; }
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
            <h2>Asset Depreciation Schedule</h2>
            <div class="period">
              As of ${formatDate(data.reportPeriod.endDate)}
            </div>
          </div>

          <div class="summary">
            <h3>Summary</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <h4>Total Assets</h4>
                <div class="value">${data.summary.totalAssets}</div>
              </div>
              <div class="summary-item">
                <h4>Original Cost</h4>
                <div class="value">${formatCurrency(data.summary.totalOriginalCost)}</div>
              </div>
              <div class="summary-item">
                <h4>Current Book Value</h4>
                <div class="value">${formatCurrency(data.summary.totalCurrentValue)}</div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25%">Asset</th>
                <th style="width: 12%">Type</th>
                <th style="width: 10%">Purchase Date</th>
                <th class="number" style="width: 13%">Original Cost</th>
                <th class="number" style="width: 13%">Accumulated Dep.</th>
                <th class="number" style="width: 13%">Book Value</th>
                <th class="number" style="width: 14%">Annual Dep.</th>
              </tr>
            </thead>
            <tbody>
              ${data.assets.map((asset: any) => `
                <tr class="asset-row">
                  <td><strong>${asset.assetName}</strong></td>
                  <td class="type-${(asset.category || 'other').toLowerCase().replace(/\s+/g, '-')}">${asset.category || 'N/A'}</td>
                  <td>${formatDate(asset.purchaseDate)}</td>
                  <td class="number">${formatCurrency(asset.purchasePrice)}</td>
                  <td class="number">${formatCurrency(asset.accumulatedDepreciation)}</td>
                  <td class="number">${formatCurrency(asset.currentBookValue)}</td>
                  <td class="number">${formatCurrency(asset.annualDepreciation)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    return new NextResponse(printHTML, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Export failed:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}

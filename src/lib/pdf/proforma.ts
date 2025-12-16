// Proforma Invoice PDF Generation Utility

import { Invoice, InvoiceLine, Customer } from '@/types/database';
import { formatCurrency as currencyFormatter } from '@/lib/currency';

interface ProformaPDFData {
  invoice: Invoice;
  lineItems: InvoiceLine[];
  customer: Customer;
}

export function generateProformaHTML(data: ProformaPDFData): string {
  const { invoice, lineItems, customer } = data;

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, invoice.currency as any || 'USD');
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Proforma Invoice ${invoice.proforma_number}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 14px;
          color: #333;
          line-height: 1.5;
        }
        .proforma {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
          background: white;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #1e3a5f;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo {
          width: 200px;
          height: 200px;
        }
        .company-info {
          flex: 1;
        }
        .company-name {
          font-size: 24px;
          font-weight: 700;
          color: #1e3a5f;
          margin-bottom: 4px;
        }
        .company-details {
          font-size: 11px;
          color: #666;
          line-height: 1.4;
        }
        .company-details p {
          margin: 2px 0;
        }
        .proforma-title {
          text-align: right;
        }
        .proforma-title h1 {
          font-size: 28px;
          color: #1e3a5f;
          margin-bottom: 4px;
        }
        .proforma-subtitle {
          font-size: 14px;
          color: #dc2626;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .proforma-number {
          font-size: 16px;
          color: #666;
        }
        .warning-box {
          background: #fef3c7;
          border: 2px solid #1e3a5f;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 20px;
          text-align: center;
          color: #92400e;
          font-weight: 600;
        }
        .info-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        .info-block h3 {
          font-size: 12px;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        .info-block p {
          margin-bottom: 4px;
        }
        .info-block strong {
          color: #1e3a5f;
        }
        .dates-block {
          text-align: right;
        }
        .dates-block .date-row {
          display: flex;
          justify-content: flex-end;
          gap: 20px;
          margin-bottom: 4px;
        }
        .dates-block .label {
          color: #999;
          min-width: 100px;
        }
        .dates-block .value {
          min-width: 120px;
          text-align: right;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        .items-table th {
          background: #1e3a5f;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 600;
        }
        .items-table th:last-child,
        .items-table td:last-child {
          text-align: right;
        }
        .items-table td {
          padding: 12px;
          border-bottom: 1px solid #eee;
        }
        .items-table tr:nth-child(even) {
          background: #fffbeb;
        }
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
        }
        .totals-table {
          width: 300px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        .totals-row.grand-total {
          font-size: 18px;
          font-weight: 700;
          color: #1e3a5f;
          border-bottom: 2px solid #1e3a5f;
          padding-top: 12px;
        }
        .payment-info {
          background: #fffbeb;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .payment-info h3 {
          font-size: 14px;
          color: #1e3a5f;
          margin-bottom: 12px;
        }
        .payment-details {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        .payment-details .label {
          color: #666;
        }
        .notes {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }
        .notes h3 {
          font-size: 14px;
          color: #1e3a5f;
          margin-bottom: 8px;
        }
        .notes p {
          color: #666;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          color: #999;
          font-size: 12px;
        }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .proforma { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="proforma">
        <div class="header">
          <div class="logo-section">
            <img src="/assets/logo.jpg" alt="Breco Safaris" class="logo">
            <div class="company-info">
              <div class="company-name">Breco Safaris Ltd</div>
              <div class="company-details">
                <p>Buzzi Close Kajjansi, Entebbe Road, Kampala, Uganda</p>
                <p>Phone: +256 782 884 933 • Email: brecosafaris@gmail.com</p>
                <p>TIN: 1014756280 • Reg: 80020001634842</p>
              </div>
            </div>
          </div>
          <div class="proforma-title">
            <h1>PROFORMA INVOICE</h1>
            <p class="proforma-subtitle">Not a Tax Invoice</p>
            <p class="proforma-number">${invoice.proforma_number}</p>
          </div>
        </div>

        <div class="warning-box">
          ⚠️ THIS IS A PROFORMA INVOICE - NOT VALID FOR ACCOUNTING PURPOSES ⚠️
        </div>

        <div class="info-section">
          <div class="info-block">
            <h3>Bill To</h3>
            <p><strong>${customer.name}</strong></p>
            ${customer.address_line1 ? `<p>${customer.address_line1}</p>` : ''}
            ${customer.address_line2 ? `<p>${customer.address_line2}</p>` : ''}
            ${customer.city || customer.state || customer.zip_code ? 
              `<p>${[customer.city, customer.state, customer.zip_code].filter(Boolean).join(', ')}</p>` : ''}
            ${customer.email ? `<p>${customer.email}</p>` : ''}
            ${customer.phone ? `<p>${customer.phone}</p>` : ''}
          </div>
          <div class="info-block dates-block">
            <div class="date-row">
              <span class="label">Document Date:</span>
              <span class="value">${formatDate(invoice.invoice_date)}</span>
            </div>
            <div class="date-row">
              <span class="label">Expected Due:</span>
              <span class="value">${formatDate(invoice.due_date)}</span>
            </div>
            ${invoice.po_number ? `
            <div class="date-row">
              <span class="label">PO Number:</span>
              <span class="value">${invoice.po_number}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="info-block" style="margin-bottom: 20px;">
          <h3>From</h3>
          <p><strong>Breco Safaris Ltd</strong></p>
          <p>Buzzi Close Kajjansi</p>
          <p>Entebbe Road, Kampala, Uganda</p>
          <p>Phone: +256 782 884 933</p>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 40%">Description</th>
              <th style="width: 15%">Quantity</th>
              <th style="width: 20%">Unit Price</th>
              <th style="width: 25%">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItems.map(item => `
              <tr>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(Number(item.unit_price))}</td>
                <td>${formatCurrency(Number(item.line_total))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-table">
            <div class="totals-row">
              <span>Subtotal</span>
              <span>${formatCurrency(Number(invoice.subtotal))}</span>
            </div>
            ${Number(invoice.discount_amount) > 0 ? `
            <div class="totals-row">
              <span>Discount</span>
              <span>-${formatCurrency(Number(invoice.discount_amount))}</span>
            </div>
            ` : ''}
            <div class="totals-row">
              <span>Tax (Estimated)</span>
              <span>${formatCurrency(Number(invoice.tax_amount))}</span>
            </div>
            <div class="totals-row grand-total">
              <span>Estimated Total</span>
              <span>${formatCurrency(Number(invoice.total))}</span>
            </div>
          </div>
        </div>

        <div class="payment-info">
          <h3>Payment Information</h3>
          <div class="payment-details">
            <span class="label">Bank:</span>
            <span>Stanbic Bank Uganda</span>
            <span class="label">USD Account:</span>
            <span>9030021119316</span>
            <span class="label">UGX Account:</span>
            <span>9030021119303</span>
          </div>
          <p style="margin-top: 12px; color: #dc2626; font-size: 12px;">
            <strong>Note:</strong> A formal tax invoice will be issued upon payment confirmation.
          </p>
        </div>

        ${invoice.notes ? `
        <div class="notes">
          <h3>Notes</h3>
          <p>${invoice.notes}</p>
        </div>
        ` : ''}

        <div class="footer">
          <p>This proforma invoice is for informational purposes only.</p>
          <p style="margin-top: 8px;">Breco Safaris Ltd • Buzzi Close Kajjansi, Kampala, Uganda • +256 782 884 933</p>
          <p>TIN: 1014756280 • www.brecosafaris.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

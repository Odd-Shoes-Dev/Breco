// Quotation PDF Generation Utility

import { Invoice, InvoiceLine, Customer } from '@/types/database';
import { formatCurrency as currencyFormatter } from '@/lib/currency';

interface QuotationPDFData {
  invoice: Invoice;
  lineItems: InvoiceLine[];
  customer: Customer;
}

export function generateQuotationHTML(data: QuotationPDFData): string {
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

  // Calculate valid until date (30 days from quotation date)
  const validUntilDate = new Date(invoice.invoice_date);
  validUntilDate.setDate(validUntilDate.getDate() + 30);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Quotation ${invoice.quotation_number}</title>
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
        .quotation {
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
        .quotation-title {
          text-align: right;
        }
        .quotation-title h1 {
          font-size: 32px;
          color: #1e3a5f;
          margin-bottom: 4px;
        }
        .quotation-number {
          font-size: 16px;
          color: #666;
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
        .valid-until {
          background: #dbeafe;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 20px;
          text-align: center;
          color: #1e40af;
          font-weight: 600;
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
          background: #f9fafb;
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
        .terms-box {
          background: #f0f9ff;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #1e3a5f;
          margin-bottom: 30px;
        }
        .terms-box h3 {
          font-size: 14px;
          color: #1e3a5f;
          margin-bottom: 12px;
        }
        .terms-box p {
          color: #1e40af;
          margin-bottom: 8px;
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
          .quotation { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="quotation">
        <div class="header">
          <div class="logo-section">
            <img src="/assets/logo.jpg" alt="Breco Safaris" class="logo">
            <div class="company-info">
              <div class="company-name">Breco Safaris Ltd</div>
              <div class="company-details">
                <p>Kampala Road Plot 14 Eagen House, Russel Street</p>
                <p>P.O.Box 144011, Kampala, Uganda</p>
                <p>Tel: +256 782 884 933, +256 772 891 729, +256 775 766 578</p>
                <p>+256 746 757 53991, +256 702 834 511</p>
                <p>Email: brecosafaris@gmail.com • Website: www.brecosafaris.com</p>
                <p>URA TIN: 1014756280 • URSB Reg. No: 80020001634842</p>
              </div>
            </div>
          </div>
          <div class="quotation-title">
            <h1>QUOTATION</h1>
            <p class="quotation-number">${invoice.quotation_number}</p>
          </div>
        </div>

        <div class="valid-until">
          This quotation is valid until ${formatDate(validUntilDate.toISOString())}
        </div>

        <div class="info-section">
          <div class="info-block">
            <h3>Prepared For</h3>
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
              <span class="label">Quotation Date:</span>
              <span class="value">${formatDate(invoice.invoice_date)}</span>
            </div>
            <div class="date-row">
              <span class="label">Valid Until:</span>
              <span class="value">${formatDate(validUntilDate.toISOString())}</span>
            </div>
            ${invoice.po_number ? `
            <div class="date-row">
              <span class="label">Reference:</span>
              <span class="value">${invoice.po_number}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="info-block" style="margin-bottom: 20px;">
          <h3>From</h3>
          <p><strong>Breco Safaris Ltd</strong></p>
          <p>Kampala Road Plot 14 Eagen House, Russel Street</p>
          <p>P.O.Box 144011, Kampala, Uganda</p>
          <p>Tel: +256 782 884 933, +256 772 891 729</p>
          <p>Email: brecosafaris@gmail.com</p>
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
              <span>Tax</span>
              <span>${formatCurrency(Number(invoice.tax_amount))}</span>
            </div>
            <div class="totals-row grand-total">
              <span>Estimated Total</span>
              <span>${formatCurrency(Number(invoice.total))}</span>
            </div>
          </div>
        </div>

        <div class="terms-box">
          <h3>Terms & Conditions</h3>
          <p>• This quotation is valid for 30 days from the date of issue.</p>
          <p>• Prices are subject to change after the validity period.</p>
          <p>• Payment terms: ${invoice.payment_terms} days upon acceptance.</p>
          <p>• This is a quotation only and does not constitute a contract until accepted.</p>
        </div>

        ${invoice.notes ? `
        <div class="notes">
          <h3>Additional Notes</h3>
          <p>${invoice.notes}</p>
        </div>
        ` : ''}

        <div class="footer">
          <p>We look forward to creating your safari adventure!</p>
          <p style="margin-top: 8px;">Breco Safaris Ltd • Kampala Road Plot 14 Eagen House, Kampala, Uganda</p>
          <p>Tel: +256 782 884 933 • Email: brecosafaris@gmail.com • www.brecosafaris.com</p>
          <p>URA TIN: 1014756280 • URSB Reg. No: 80020001634842</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

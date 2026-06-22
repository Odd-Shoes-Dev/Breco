// Invoice PDF Generation Utility
// Uses html-to-canvas approach for browser-side generation

import { Invoice, InvoiceLine, Customer } from '@/types/database';
import { formatCurrency as currencyFormatter, getCurrencyInfo } from '@/lib/currency';

interface InvoicePDFData {
  invoice: Invoice;
  lineItems: InvoiceLine[];
  customer: Customer;
}

export function generateInvoiceHTML(data: InvoicePDFData): string {
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
      <title>Invoice ${invoice.invoice_number}</title>
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
        .invoice {
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
        .invoice-title {
          text-align: right;
        }
        .invoice-title h1 {
          font-size: 32px;
          color: #1e3a5f;
          margin-bottom: 4px;
        }
        .invoice-number {
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
          min-width: 80px;
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
          background: #f9f9f9;
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
          background: #f5f5f5;
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
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .status-draft { background: #f3f4f6; color: #6b7280; }
        .status-sent { background: #dbeafe; color: #1d4ed8; }
        .status-partial { background: #fef3c7; color: #d97706; }
        .status-paid { background: #d1fae5; color: #059669; }
        .status-overdue { background: #fee2e2; color: #dc2626; }
        .status-cancelled { background: #f3f4f6; color: #6b7280; }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .invoice { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="invoice">
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
          <div class="invoice-title">
            <h1>INVOICE</h1>
            <p class="invoice-number">${invoice.invoice_number}</p>
            <span class="status-badge status-${invoice.status}">${invoice.status}</span>
          </div>
        </div>

        <div class="info-section">
          <div class="info-block">
            <h3>Bill To</h3>
            <p><strong>${customer.name}</strong></p>
            ${customer.address ? `<p>${customer.address}</p>` : ''}
            ${customer.city || customer.state || customer.zip_code ? 
              `<p>${[customer.city, customer.state, customer.zip_code].filter(Boolean).join(', ')}</p>` : ''}
            ${customer.email ? `<p>${customer.email}</p>` : ''}
            ${customer.phone ? `<p>${customer.phone}</p>` : ''}
          </div>
          <div class="info-block dates-block">
            <div class="date-row">
              <span class="label">Invoice Date:</span>
              <span class="value">${formatDate(invoice.invoice_date)}</span>
            </div>
            <div class="date-row">
              <span class="label">Due Date:</span>
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
            ${lineItems.map(item => {
              const lineTotal = item.line_total || (item.quantity * item.unit_price - (item.discount_amount || 0) + (item.tax_amount || 0));
              return `
              <tr>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(Number(item.unit_price))}</td>
                <td>${formatCurrency(Number(lineTotal))}</td>
              </tr>
              `;
            }).join('')}
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
              <span>Total Due</span>
              <span>${formatCurrency(Number(invoice.total))}</span>
            </div>
            ${Number(invoice.amount_paid) > 0 ? `
            <div class="totals-row" style="color: #059669;">
              <span>Amount Paid</span>
              <span>-${formatCurrency(Number(invoice.amount_paid))}</span>
            </div>
            <div class="totals-row" style="font-weight: 600;">
              <span>Balance Due</span>
              <span>${formatCurrency(Number(invoice.total) - Number(invoice.amount_paid))}</span>
            </div>
            ` : ''}
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
            <span class="label">EUR Account:</span>
            <span>9030021119329</span>
          </div>
        </div>

        ${invoice.notes ? `
        <div class="notes">
          <h3>Notes</h3>
          <p>${invoice.notes}</p>
        </div>
        ` : ''}

        <div class="footer">
          <p>Thank you for choosing Breco Safaris!</p>
          <p style="margin-top: 8px;">Breco Safaris Ltd • Kampala Road Plot 14 Eagen House, Kampala, Uganda</p>
          <p>Tel: +256 782 884 933, +256 772 891 729 • Email: brecosafaris@gmail.com • www.brecosafaris.com</p>
          <p>URA TIN: 1014756280 • URSB Reg. No: 80020001634842</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function printInvoice(data: InvoicePDFData): Promise<void> {
  const html = generateInvoiceHTML(data);
  const printWindow = window.open('', '_blank');
  
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for images to load before printing
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

export async function downloadInvoicePDF(data: InvoicePDFData): Promise<void> {
  const html = generateInvoiceHTML(data);
  
  // Create a hidden iframe for PDF generation
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);
  
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (iframeDoc) {
    iframeDoc.write(html);
    iframeDoc.close();
    
    // Use browser's print to PDF functionality
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  }
}

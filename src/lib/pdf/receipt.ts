// Receipt PDF Generation Utility

import { Invoice, InvoiceLine, Customer } from '@/types/database';
import { formatCurrency as currencyFormatter } from '@/lib/currency';

interface ReceiptPDFData {
  invoice: Invoice;
  lineItems: InvoiceLine[];
  customer: Customer;
}

export function generateReceiptHTML(data: ReceiptPDFData): string {
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

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt ${invoice.receipt_number}</title>
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
        .receipt {
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
        .receipt-title {
          text-align: right;
        }
        .receipt-title h1 {
          font-size: 32px;
          color: #1e3a5f;
          margin-bottom: 4px;
        }
        .receipt-number {
          font-size: 16px;
          color: #666;
        }
        .paid-stamp {
          display: inline-block;
          padding: 8px 20px;
          background: #d1fae5;
          color: #152a45;
          font-weight: 700;
          font-size: 16px;
          border-radius: 6px;
          border: 2px solid #1e3a5f;
          margin-top: 8px;
        }
        .payment-received-box {
          background: #d1fae5;
          border-left: 4px solid #1e3a5f;
          padding: 20px;
          margin-bottom: 30px;
          border-radius: 6px;
        }
        .payment-received-box h3 {
          color: #152a45;
          font-size: 16px;
          margin-bottom: 12px;
        }
        .payment-details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .payment-detail-item {
          display: flex;
          justify-content: space-between;
        }
        .payment-detail-item .label {
          color: #1e3a5f;
          font-weight: 600;
        }
        .payment-detail-item .value {
          color: #152a45;
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
          min-width: 120px;
        }
        .dates-block .value {
          min-width: 140px;
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
          background: #f0fdf4;
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
        .totals-row.amount-paid {
          font-size: 20px;
          font-weight: 700;
          color: #1e3a5f;
          background: #d1fae5;
          padding: 12px;
          margin-top: 8px;
          border-radius: 6px;
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
        .signature-section {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: space-between;
        }
        .signature-box {
          width: 45%;
          text-align: center;
        }
        .signature-line {
          border-top: 2px solid #333;
          margin-top: 60px;
          padding-top: 8px;
          font-size: 12px;
          color: #666;
        }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .receipt { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
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
          <div class="receipt-title">
            <h1>RECEIPT</h1>
            <p class="receipt-number">${invoice.receipt_number}</p>
            <span class="paid-stamp">✓ PAID IN FULL</span>
          </div>
        </div>

        <div class="payment-received-box">
          <h3>✓ Payment Received</h3>
          <div class="payment-details-grid">
            <div class="payment-detail-item">
              <span class="label">Amount Paid:</span>
              <span class="value">${formatCurrency(Number(invoice.amount_paid || invoice.total))}</span>
            </div>
            <div class="payment-detail-item">
              <span class="label">Payment Date:</span>
              <span class="value">${formatDate(invoice.created_at)}</span>
            </div>
            <div class="payment-detail-item">
              <span class="label">Payment Method:</span>
              <span class="value">${invoice.payment_terms ? 'Bank Transfer' : 'Cash'}</span>
            </div>
            <div class="payment-detail-item">
              <span class="label">Transaction ID:</span>
              <span class="value">${invoice.receipt_number}</span>
            </div>
          </div>
        </div>

        <div class="info-section">
          <div class="info-block">
            <h3>Received From</h3>
            <p><strong>${customer.name}</strong></p>
            ${customer.address ? `<p>${customer.address}</p>` : ''}
            ${customer.city || customer.state || customer.zip_code ? 
              `<p>${[customer.city, customer.state, customer.zip_code].filter(Boolean).join(', ')}</p>` : ''}
            ${customer.email ? `<p>${customer.email}</p>` : ''}
            ${customer.phone ? `<p>${customer.phone}</p>` : ''}
          </div>
          <div class="info-block dates-block">
            <div class="date-row">
              <span class="label">Receipt Date:</span>
              <span class="value">${formatDate(invoice.invoice_date)}</span>
            </div>
            <div class="date-row">
              <span class="label">Receipt Time:</span>
              <span class="value">${formatTime(invoice.created_at)}</span>
            </div>
            ${invoice.invoice_number ? `
            <div class="date-row">
              <span class="label">Related Invoice:</span>
              <span class="value">${invoice.invoice_number}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="info-block" style="margin-bottom: 20px;">
          <h3>Received By</h3>
          <p><strong>Breco Safaris Ltd</strong></p>
          <p>Kampala Road Plot 14 Eagen House, Russel Street</p>
          <p>P.O.Box 144011, Kampala, Uganda</p>
          <p>Tel: +256 782 884 933, +256 772 891 729</p>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 50%">Description</th>
              <th style="width: 15%">Quantity</th>
              <th style="width: 20%">Unit Price</th>
              <th style="width: 15%">Amount</th>
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
              <span>Total</span>
              <span>${formatCurrency(Number(invoice.total))}</span>
            </div>
            <div class="totals-row amount-paid">
              <span>✓ Amount Paid</span>
              <span>${formatCurrency(Number(invoice.amount_paid || invoice.total))}</span>
            </div>
            <div class="totals-row" style="font-weight: 600; color: #1e3a5f;">
              <span>Balance Due</span>
              <span>${formatCurrency(0)}</span>
            </div>
          </div>
        </div>

        ${invoice.notes ? `
        <div class="notes">
          <h3>Notes</h3>
          <p>${invoice.notes}</p>
        </div>
        ` : ''}

        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line">
              Customer Signature
            </div>
          </div>
          <div class="signature-box">
            <div class="signature-line">
              Authorized Signature<br>
              <strong>Breco Safaris Ltd</strong>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for your payment!</p>
          <p style="margin-top: 8px;">Breco Safaris Ltd • Kampala Road Plot 14 Eagen House, Kampala, Uganda</p>
          <p>Tel: +256 782 884 933, +256 772 891 729 • Email: brecosafaris@gmail.com • www.brecosafaris.com</p>
          <p>URA TIN: 1014756280 • URSB Reg. No: 80020001634842</p>
          <p style="margin-top: 12px; color: #666; font-size: 11px;">
            This is an official receipt for accounting purposes.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

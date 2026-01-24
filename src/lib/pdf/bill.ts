// Bill PDF Generation Utility

interface BillPDFData {
  bill: any;
  vendor: any;
  lines: any[];
}

export function generateBillHTML(data: BillPDFData): string {
  const { bill, vendor, lines } = data;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const balanceDue = parseFloat(bill.total) - parseFloat(bill.amount_paid);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Bill ${bill.bill_number}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .bill {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
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
          width: 150px;
          height: 50px;
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
        .bill-title {
          text-align: right;
        }
        .bill-title h1 {
          font-size: 32px;
          color: #1e3a5f;
          margin-bottom: 4px;
        }
        .bill-number {
          font-size: 16px;
          color: #666;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          margin-top: 8px;
        }
        .status-draft { background: #f3f4f6; color: #6b7280; }
        .status-pending_approval { background: #fef3c7; color: #d97706; }
        .status-approved { background: #dbeafe; color: #1d4ed8; }
        .status-partial { background: #fef3c7; color: #d97706; }
        .status-paid { background: #d1fae5; color: #059669; }
        .status-overdue { background: #fee2e2; color: #dc2626; }
        .status-void { background: #f3f4f6; color: #6b7280; }
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
        .totals-row.balance-due {
          font-size: 18px;
          font-weight: 700;
          color: #dc2626;
          border-top: 2px solid #1e3a5f;
          margin-top: 8px;
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
          white-space: pre-line;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          color: #999;
          font-size: 12px;
        }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .bill { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="bill">
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
          <div class="bill-title">
            <h1>BILL</h1>
            <p class="bill-number">${bill.bill_number}</p>
            ${bill.vendor_invoice_number ? `<p class="bill-number" style="margin-top: 4px;">Vendor Invoice: ${bill.vendor_invoice_number}</p>` : ''}
            <span class="status-badge status-${bill.status}">${bill.status.replace('_', ' ')}</span>
          </div>
        </div>

        <div class="info-section">
          <div class="info-block">
            <h3>Vendor</h3>
            <p><strong>${vendor.company_name || vendor.name}</strong></p>
            ${vendor.address_line1 ? `<p>${vendor.address_line1}</p>` : ''}
            ${vendor.address_line2 ? `<p>${vendor.address_line2}</p>` : ''}
            ${vendor.city || vendor.state || vendor.zip_code ? `<p>${vendor.city}${vendor.city && vendor.state ? ', ' : ''}${vendor.state} ${vendor.zip_code || ''}</p>` : ''}
            ${vendor.country && vendor.country !== 'USA' ? `<p>${vendor.country}</p>` : ''}
            ${vendor.email ? `<p>${vendor.email}</p>` : ''}
            ${vendor.phone ? `<p>${vendor.phone}</p>` : ''}
          </div>
          <div class="dates-block">
            <div class="date-row">
              <span class="label">Bill Date:</span>
              <span class="value"><strong>${formatDate(bill.bill_date)}</strong></span>
            </div>
            <div class="date-row">
              <span class="label">Due Date:</span>
              <span class="value"><strong>${formatDate(bill.due_date)}</strong></span>
            </div>
            ${bill.payment_terms ? `
            <div class="date-row">
              <span class="label">Terms:</span>
              <span class="value">Net ${bill.payment_terms}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 50%;">Description</th>
              <th style="width: 15%; text-align: right;">Quantity</th>
              <th style="width: 15%; text-align: right;">Unit Cost</th>
              <th style="width: 20%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lines.map((line) => `
              <tr>
                <td>${line.description || '-'}</td>
                <td style="text-align: right;">${parseFloat(line.quantity)}</td>
                <td style="text-align: right;">${formatCurrency(parseFloat(line.unit_cost))}</td>
                <td style="text-align: right;">${formatCurrency(parseFloat(line.line_total))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-table">
            <div class="totals-row">
              <span>Subtotal</span>
              <span>${formatCurrency(parseFloat(bill.subtotal))}</span>
            </div>
            ${parseFloat(bill.tax_amount) > 0 ? `
            <div class="totals-row">
              <span>Tax</span>
              <span>${formatCurrency(parseFloat(bill.tax_amount))}</span>
            </div>
            ` : ''}
            <div class="totals-row grand-total">
              <span>Total</span>
              <span>${formatCurrency(parseFloat(bill.total))}</span>
            </div>
            ${parseFloat(bill.amount_paid) > 0 ? `
            <div class="totals-row" style="color: #059669;">
              <span>Paid</span>
              <span>-${formatCurrency(parseFloat(bill.amount_paid))}</span>
            </div>
            ` : ''}
            <div class="totals-row balance-due">
              <span>Balance Due</span>
              <span>${formatCurrency(balanceDue)}</span>
            </div>
          </div>
        </div>

        ${bill.notes ? `
        <div class="notes">
          <h3>Notes</h3>
          <p>${bill.notes}</p>
        </div>
        ` : ''}

        <div class="footer">
          <p>Thank you for your business!</p>
          <p style="margin-top: 8px;">Breco Safaris Ltd • Kampala Road Plot 14 Eagen House, Kampala, Uganda</p>
          <p>Tel: +256 782 884 933, +256 772 891 729 • Email: brecosafaris@gmail.com • www.brecosafaris.com</p>
          <p>URA TIN: 1014756280 • URSB Reg. No: 80020001634842</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function printBill(data: BillPDFData): Promise<void> {
  const html = generateBillHTML(data);
  const printWindow = window.open('', '_blank');

  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Wait for images to load before printing
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  }
}

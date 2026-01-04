// Payslip PDF Generator
// Generates professional PDF payslips for Breco Safaris Ltd

export interface PayslipData {
  payslip_number: string;
  employee: {
    first_name: string;
    last_name: string;
    employee_number: string;
    job_title: string;
    department: string;
    email: string;
  };
  payroll_period: {
    period_name: string;
    start_date: string;
    end_date: string;
    payment_date: string;
  };
  basic_salary: number;
  total_allowances: number;
  overtime_hours: number;
  overtime_amount: number;
  bonus: number;
  commission: number;
  reimbursements: number;
  gross_salary: number;
  paye: number;
  nssf_employee: number;
  loan_deduction: number;
  salary_advance: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  nssf_employer: number;
  payment_method: string;
  currency: string;
  notes: string | null;
  payslip_items: Array<{
    item_type: 'earning' | 'deduction';
    item_name: string;
    amount: number;
    is_taxable: boolean;
  }>;
}

export function generatePayslipHTML(payslip: PayslipData): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const earnings = payslip.payslip_items.filter(item => item.item_type === 'earning');
  const deductions = payslip.payslip_items.filter(item => item.item_type === 'deduction');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Payslip - ${payslip.employee.first_name} ${payslip.employee.last_name}</title>
        <style>
          * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
          }
          
          @page {
            size: A4;
            margin: 0.5in;
          }
          
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            color: #111827; 
            background: #ffffff;
            line-height: 1.5;
          }
          
          .payslip-container { 
            max-width: 800px; 
            margin: 0 auto; 
            border: 2px solid #1e3a8a;
            border-radius: 8px;
            overflow: hidden;
          }
          
          .header { 
            text-align: center; 
            padding: 30px 40px;
            background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
            color: white;
          }
          
          .header h1 { 
            font-size: 28px; 
            margin-bottom: 8px; 
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          
          .header .subtitle { 
            font-size: 16px; 
            opacity: 0.95;
            font-weight: 500;
          }
          
          .header .period { 
            margin-top: 8px; 
            font-size: 14px;
            opacity: 0.9;
          }
          
          .payslip-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            padding: 30px 40px;
            background: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .info-section h3 {
            font-size: 11px;
            text-transform: uppercase;
            color: #6b7280;
            font-weight: 600;
            margin-bottom: 12px;
            letter-spacing: 0.5px;
          }
          
          .info-item {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 13px;
          }
          
          .info-label {
            color: #6b7280;
            font-weight: 500;
          }
          
          .info-value {
            color: #111827;
            font-weight: 600;
          }
          
          .breakdown {
            padding: 30px 40px;
          }
          
          .breakdown-section {
            margin-bottom: 25px;
          }
          
          .breakdown-section h3 {
            font-size: 14px;
            font-weight: 600;
            color: #111827;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e5e7eb;
          }
          
          .breakdown-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 13px;
          }
          
          .breakdown-item.total {
            border-top: 2px solid #111827;
            margin-top: 8px;
            padding-top: 12px;
            font-weight: 700;
            font-size: 14px;
          }
          
          .breakdown-label {
            color: #4b5563;
          }
          
          .breakdown-value {
            font-weight: 600;
            color: #111827;
            min-width: 120px;
            text-align: right;
          }
          
          .breakdown-value.negative {
            color: #dc2626;
          }
          
          .summary {
            background: #f9fafb;
            padding: 25px 40px;
            border-top: 2px solid #e5e7eb;
          }
          
          .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }
          
          .summary-item {
            text-align: center;
            padding: 15px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
          }
          
          .summary-label {
            font-size: 11px;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 8px;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          
          .summary-value {
            font-size: 18px;
            font-weight: 700;
          }
          
          .summary-value.gross { color: #111827; }
          .summary-value.deductions { color: #dc2626; }
          .summary-value.employer { color: #6b7280; }
          
          .net-pay-banner {
            background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 6px;
            margin-top: 15px;
          }
          
          .net-pay-banner .label {
            font-size: 12px;
            opacity: 0.9;
            margin-bottom: 4px;
            font-weight: 600;
            letter-spacing: 1px;
          }
          
          .net-pay-banner .amount {
            font-size: 32px;
            font-weight: 700;
          }
          
          .notes-section {
            padding: 20px 40px;
            border-top: 1px solid #e5e7eb;
            background: #fffbeb;
          }
          
          .notes-section h3 {
            font-size: 12px;
            font-weight: 600;
            color: #92400e;
            margin-bottom: 8px;
            text-transform: uppercase;
          }
          
          .notes-section p {
            font-size: 13px;
            color: #78350f;
            line-height: 1.6;
          }
          
          .footer {
            padding: 20px 40px;
            text-align: center;
            font-size: 11px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
            background: #f9fafb;
          }
          
          .footer p {
            margin: 4px 0;
          }
          
          .footer .contact {
            margin-top: 8px;
            font-weight: 600;
            color: #1e3a8a;
          }
          
          @media print {
            body { 
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="payslip-container">
          <!-- Header -->
          <div class="header">
            <h1>Breco Safaris Ltd</h1>
            <p class="subtitle">Salary Slip</p>
            <p class="period">${payslip.payroll_period.period_name}</p>
          </div>

          <!-- Employee & Payment Info -->
          <div class="payslip-info">
            <div class="info-section">
              <h3>Employee Information</h3>
              <div class="info-item">
                <span class="info-label">Name:</span>
                <span class="info-value">${payslip.employee.first_name} ${payslip.employee.last_name}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Employee ID:</span>
                <span class="info-value">${payslip.employee.employee_number}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Job Title:</span>
                <span class="info-value">${payslip.employee.job_title}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Department:</span>
                <span class="info-value">${payslip.employee.department || 'N/A'}</span>
              </div>
            </div>

            <div class="info-section">
              <h3>Payment Information</h3>
              <div class="info-item">
                <span class="info-label">Payslip No:</span>
                <span class="info-value">${payslip.payslip_number}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Pay Period:</span>
                <span class="info-value">${formatDate(payslip.payroll_period.start_date)} - ${formatDate(payslip.payroll_period.end_date)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Payment Date:</span>
                <span class="info-value">${formatDate(payslip.payroll_period.payment_date)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Payment Method:</span>
                <span class="info-value">${payslip.payment_method.replace('_', ' ').toUpperCase()}</span>
              </div>
            </div>
          </div>

          <!-- Earnings & Deductions Breakdown -->
          <div class="breakdown">
            <!-- Earnings -->
            <div class="breakdown-section">
              <h3>Earnings</h3>
              <div class="breakdown-item">
                <span class="breakdown-label">Basic Salary</span>
                <span class="breakdown-value">${formatCurrency(payslip.basic_salary)}</span>
              </div>
              ${earnings.map(item => `
                <div class="breakdown-item">
                  <span class="breakdown-label">${item.item_name}${item.is_taxable ? '' : ' (Non-taxable)'}</span>
                  <span class="breakdown-value">${formatCurrency(item.amount)}</span>
                </div>
              `).join('')}
              ${payslip.overtime_amount > 0 ? `
                <div class="breakdown-item">
                  <span class="breakdown-label">Overtime (${payslip.overtime_hours} hrs)</span>
                  <span class="breakdown-value">${formatCurrency(payslip.overtime_amount)}</span>
                </div>
              ` : ''}
              ${payslip.bonus > 0 ? `
                <div class="breakdown-item">
                  <span class="breakdown-label">Bonus</span>
                  <span class="breakdown-value">${formatCurrency(payslip.bonus)}</span>
                </div>
              ` : ''}
              ${payslip.commission > 0 ? `
                <div class="breakdown-item">
                  <span class="breakdown-label">Commission</span>
                  <span class="breakdown-value">${formatCurrency(payslip.commission)}</span>
                </div>
              ` : ''}
              ${payslip.reimbursements > 0 ? `
                <div class="breakdown-item">
                  <span class="breakdown-label">Reimbursements</span>
                  <span class="breakdown-value">${formatCurrency(payslip.reimbursements)}</span>
                </div>
              ` : ''}
              <div class="breakdown-item total">
                <span class="breakdown-label">Gross Salary</span>
                <span class="breakdown-value">${formatCurrency(payslip.gross_salary)}</span>
              </div>
            </div>

            <!-- Deductions -->
            <div class="breakdown-section">
              <h3>Deductions</h3>
              <div class="breakdown-item">
                <span class="breakdown-label">PAYE (Income Tax)</span>
                <span class="breakdown-value negative">${formatCurrency(payslip.paye)}</span>
              </div>
              <div class="breakdown-item">
                <span class="breakdown-label">NSSF (Employee 5%)</span>
                <span class="breakdown-value negative">${formatCurrency(payslip.nssf_employee)}</span>
              </div>
              ${deductions.map(item => `
                <div class="breakdown-item">
                  <span class="breakdown-label">${item.item_name}</span>
                  <span class="breakdown-value negative">${formatCurrency(item.amount)}</span>
                </div>
              `).join('')}
              ${payslip.loan_deduction > 0 ? `
                <div class="breakdown-item">
                  <span class="breakdown-label">Loan Deduction</span>
                  <span class="breakdown-value negative">${formatCurrency(payslip.loan_deduction)}</span>
                </div>
              ` : ''}
              ${payslip.salary_advance > 0 ? `
                <div class="breakdown-item">
                  <span class="breakdown-label">Salary Advance</span>
                  <span class="breakdown-value negative">${formatCurrency(payslip.salary_advance)}</span>
                </div>
              ` : ''}
              <div class="breakdown-item total">
                <span class="breakdown-label">Total Deductions</span>
                <span class="breakdown-value negative">${formatCurrency(payslip.total_deductions)}</span>
              </div>
            </div>
          </div>

          <!-- Summary -->
          <div class="summary">
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Gross Salary</div>
                <div class="summary-value gross">${formatCurrency(payslip.gross_salary)}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total Deductions</div>
                <div class="summary-value deductions">${formatCurrency(payslip.total_deductions)}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">NSSF Employer (10%)</div>
                <div class="summary-value employer">${formatCurrency(payslip.nssf_employer)}</div>
              </div>
            </div>

            <div class="net-pay-banner">
              <div class="label">NET PAY</div>
              <div class="amount">${formatCurrency(payslip.net_salary)}</div>
            </div>
          </div>

          <!-- Notes -->
          ${payslip.notes ? `
            <div class="notes-section">
              <h3>Notes</h3>
              <p>${payslip.notes}</p>
            </div>
          ` : ''}

          <!-- Footer -->
          <div class="footer">
            <p>This is a computer-generated payslip and does not require a signature.</p>
            <p>Generated on ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</p>
            <p class="contact">For any queries, please contact HR Department - Breco Safaris Ltd</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

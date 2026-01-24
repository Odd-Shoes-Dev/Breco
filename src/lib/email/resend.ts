// Lazily construct Resend client inside functions so missing API keys don't throw during
// module import (which can break builds when environment variables are not provided).
async function getResendClient() {
  const { Resend } = await import('resend');
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured on the server');
  return new Resend(apiKey);
}

interface SendInvoiceEmailParams {
  to: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  balanceDue: number;
  paymentLink: string;
}

export async function sendInvoiceEmail(params: SendInvoiceEmailParams) {
  const {
    to,
    customerName,
    invoiceNumber,
    invoiceDate,
    dueDate,
    totalAmount,
    balanceDue,
    paymentLink,
  } = params;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0d9488 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Breco Safaris Ltd</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0;">Invoice ${invoiceNumber}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              Hi ${customerName},
            </p>
            
            <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
              Please find attached your invoice. Here's a summary:
            </p>
            
            <!-- Invoice Summary -->
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Invoice Number:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1e3a5f;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Invoice Date:</td>
                  <td style="padding: 8px 0; text-align: right;">${formatDate(invoiceDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Due Date:</td>
                  <td style="padding: 8px 0; text-align: right;">${formatDate(dueDate)}</td>
                </tr>
                <tr style="border-top: 2px solid #e5e7eb;">
                  <td style="padding: 12px 0 8px 0; color: #666;">Total Amount:</td>
                  <td style="padding: 12px 0 8px 0; text-align: right; font-size: 18px; font-weight: 700; color: #1e3a5f;">${formatCurrency(totalAmount)}</td>
                </tr>
                ${balanceDue < totalAmount ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Balance Due:</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 16px; font-weight: 600; color: #dc2626;">${formatCurrency(balanceDue)}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <!-- Payment Button -->
            ${balanceDue > 0 ? `
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #0d9488 100%); color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Pay Now
              </a>
            </div>
            ` : `
            <div style="text-align: center; margin-bottom: 30px; padding: 15px; background: #d1fae5; border-radius: 8px;">
              <span style="color: #059669; font-weight: 600;">✓ Paid in Full</span>
            </div>
            `}
            
            <p style="font-size: 14px; color: #999; margin-bottom: 10px;">
              If you have any questions about this invoice, please don't hesitate to contact us.
            </p>
            
            <p style="font-size: 16px; color: #333; margin-top: 30px;">
              Thank you for choosing Breco Safaris!
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 10px;">
              Best regards,<br>
              <strong>Breco Safaris Ltd</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #999;">
              Breco Safaris Ltd • Kampala Road Plot 14 Eagen House, Kampala, Uganda
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #999;">
              Tel: +256 782 884 933, +256 772 891 729 • Email: brecosafaris@gmail.com
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const resend = await getResendClient();
    const { data, error } = await resend.emails.send({
      from: 'Breco Safaris Ltd <invoices@brecosafaris.com>',
      to: [to],
      subject: `Invoice ${invoiceNumber} from Breco Safaris Ltd`,
      html,
    });

    if (error) {
      console.error('Email send error:', error);
      throw new Error(error.message);
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

interface SendPaymentReceiptParams {
  to: string;
  customerName: string;
  invoiceNumber: string;
  paymentDate: string;
  paymentAmount: number;
  paymentMethod: string;
  remainingBalance: number;
}

export async function sendPaymentReceiptEmail(params: SendPaymentReceiptParams) {
  const {
    to,
    customerName,
    invoiceNumber,
    paymentDate,
    paymentAmount,
    paymentMethod,
    remainingBalance,
  } = params;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">✓</div>
            <h1 style="color: white; margin: 0; font-size: 24px;">Payment Received</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              Hi ${customerName},
            </p>
            
            <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
              We've received your payment. Thank you!
            </p>
            
            <!-- Payment Details -->
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Invoice Number:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1e3a5f;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Payment Date:</td>
                  <td style="padding: 8px 0; text-align: right;">${formatDate(paymentDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Payment Method:</td>
                  <td style="padding: 8px 0; text-align: right; text-transform: capitalize;">${paymentMethod.replace('_', ' ')}</td>
                </tr>
                <tr style="border-top: 2px solid #e5e7eb;">
                  <td style="padding: 12px 0 8px 0; color: #666;">Amount Paid:</td>
                  <td style="padding: 12px 0 8px 0; text-align: right; font-size: 18px; font-weight: 700; color: #059669;">${formatCurrency(paymentAmount)}</td>
                </tr>
                ${remainingBalance > 0 ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Remaining Balance:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #dc2626;">${formatCurrency(remainingBalance)}</td>
                </tr>
                ` : `
                <tr>
                  <td colspan="2" style="padding: 12px 0; text-align: center;">
                    <span style="background: #d1fae5; color: #059669; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px;">Invoice Paid in Full</span>
                  </td>
                </tr>
                `}
              </table>
            </div>
            
            <p style="font-size: 14px; color: #999; margin-bottom: 10px;">
              This is your payment confirmation. Please keep it for your records.
            </p>
            
            <p style="font-size: 16px; color: #333; margin-top: 30px;">
              Thank you for choosing Breco Safaris!
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 10px;">
              Best regards,<br>
              <strong>Breco Safaris Ltd</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #999;">
              Breco Safaris Ltd • Kampala Road Plot 14 Eagen House, Kampala, Uganda
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #999;">
              Tel: +256 782 884 933, +256 772 891 729 • Email: brecosafaris@gmail.com
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const resend = await getResendClient();
    const { data, error } = await resend.emails.send({
      from: 'Breco Safaris Ltd <receipts@brecosafaris.com>',
      to: [to],
      subject: `Payment Receipt - Invoice ${invoiceNumber}`,
      html,
    });

    if (error) {
      console.error('Email send error:', error);
      throw new Error(error.message);
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

// Email provider: Resend.
// To swap provider (SendGrid, SMTP, etc.): replace this file only.

async function getResendClient() {
  const { Resend } = await import('resend');
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
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
  const resend = await getResendClient();
  const { to, customerName, invoiceNumber, invoiceDate, dueDate, totalAmount, balanceDue, paymentLink } = params;

  return resend.emails.send({
    from: 'Breco Safaris <invoices@brecosafaris.com>',
    to,
    subject: `Invoice ${invoiceNumber} from Breco Safaris Ltd`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Invoice ${invoiceNumber}</h2>
        <p>Dear ${customerName},</p>
        <p>Please find your invoice details below:</p>
        <table style="width:100%; border-collapse: collapse;">
          <tr><td><strong>Invoice Date:</strong></td><td>${invoiceDate}</td></tr>
          <tr><td><strong>Due Date:</strong></td><td>${dueDate}</td></tr>
          <tr><td><strong>Total Amount:</strong></td><td>${totalAmount}</td></tr>
          <tr><td><strong>Balance Due:</strong></td><td>${balanceDue}</td></tr>
        </table>
        <p style="margin-top: 24px;">
          <a href="${paymentLink}" style="background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">
            Pay Now
          </a>
        </p>
        <p style="margin-top: 24px; color: #666; font-size: 12px;">
          Breco Safaris Ltd · Buzzi Close Kajjansi, Entebbe Road, Kampala, Uganda
        </p>
      </div>
    `,
  });
}

interface SendPasswordResetEmailParams {
  to: string;
  fullName: string;
  resetLink: string;
}

export async function sendPasswordResetEmail(params: SendPasswordResetEmailParams) {
  const resend = await getResendClient();
  const { to, fullName, resetLink } = params;

  return resend.emails.send({
    from: 'Breco Safaris <noreply@brecosafaris.com>',
    to,
    subject: 'Reset your password – Breco Safaris',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>Hi ${fullName},</p>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <p style="margin-top: 24px;">
          <a href="${resetLink}" style="background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">
            Reset Password
          </a>
        </p>
        <p style="margin-top: 16px; color: #666; font-size: 12px;">
          If you did not request this, ignore this email.
        </p>
      </div>
    `,
  });
}

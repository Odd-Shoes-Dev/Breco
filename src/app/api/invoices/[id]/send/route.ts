import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const { sendInvoiceEmail } = await import('@/lib/email/resend');
    const invoiceId = (await params).id;

    // Fetch invoice with customer
    const invoiceRows = await sql`
      SELECT i.*,
        json_build_object(
          'name', c.name, 'email', c.email,
          'email_2', c.email_2, 'email_3', c.email_3, 'email_4', c.email_4
        ) AS customer
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      WHERE i.id = ${invoiceId}
    `;

    if (invoiceRows.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    const invoice = invoiceRows[0];

    if (!invoice.customer?.email) {
      return NextResponse.json(
        { error: 'Customer does not have an email address' },
        { status: 400 }
      );
    }

    // Collect all customer email addresses
    const emailAddresses = [
      invoice.customer.email,
      invoice.customer.email_2,
      invoice.customer.email_3,
      invoice.customer.email_4,
    ].filter((email): email is string => Boolean(email));

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const paymentLink = `${baseUrl}/pay?invoice=${invoiceId}`;
    const balanceDue = Number(invoice.total_amount) - Number(invoice.amount_paid);

    // Send email to all addresses
    await sendInvoiceEmail({
      to: emailAddresses.join(', '),
      customerName: invoice.customer.name,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      totalAmount: Number(invoice.total_amount),
      balanceDue,
      paymentLink,
    });

    // Update invoice status to sent if it was draft
    if (invoice.status === 'draft') {
      await sql`UPDATE invoices SET status = 'sent' WHERE id = ${invoiceId}`;
    }

    return NextResponse.json({
      success: true,
      message: `Invoice sent to ${emailAddresses.length} email address${emailAddresses.length > 1 ? 'es' : ''}`,
    });
  } catch (error: any) {
    console.error('Error sending invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send invoice' },
      { status: 500 }
    );
  }
}

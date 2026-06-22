import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent, createCheckoutSession } from '@/lib/stripe';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoiceId, method } = body;

    // Fetch the invoice with customer info
    const rows = await sql`
      SELECT i.*,
        json_build_object(
          'id', c.id,
          'name', c.name,
          'email', c.email,
          'stripe_customer_id', c.stripe_customer_id
        ) AS customer
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      WHERE i.id = ${invoiceId}
    `;
    const invoice = rows[0];

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Calculate amount due in cents
    const amountDue = Math.round((invoice.total - (invoice.amount_paid || 0)) * 100);

    if (amountDue <= 0) {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 });
    }

    if (method === 'checkout') {
      // Create a Stripe Checkout session
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const session = await createCheckoutSession({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        amount: amountDue,
        customerEmail: invoice.customer?.email || '',
        successUrl: `${baseUrl}/pay/success?invoice=${invoice.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/pay/cancel?invoice=${invoice.id}`,
      });

      return NextResponse.json({
        sessionId: session.id,
        url: session.url,
      });
    } else {
      // Create a Payment Intent for embedded payment
      const { clientSecret, paymentIntentId } = await createPaymentIntent({
        amount: amountDue,
        currency: 'usd',
        customerId: invoice.customer?.stripe_customer_id,
        invoiceId: invoice.id,
        description: `Payment for Invoice ${invoice.invoice_number}`,
        metadata: {
          customer_id: invoice.customer_id,
          customer_name: invoice.customer?.name || '',
        },
      });

      // Store the payment intent ID on the invoice
      await sql`
        UPDATE invoices SET stripe_payment_intent_id = ${paymentIntentId} WHERE id = ${invoiceId}
      `;

      return NextResponse.json({
        clientSecret,
        paymentIntentId,
        amount: amountDue,
      });
    }
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}

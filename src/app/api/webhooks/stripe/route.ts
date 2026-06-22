import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/stripe';
import { sql } from '@/lib/db';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    let event: Stripe.Event;
    try {
      event = await verifyWebhookSignature(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata.invoice_id;

        if (invoiceId) {
          const invoiceRows = await sql`SELECT * FROM invoices WHERE id = ${invoiceId}`;
          const invoice = invoiceRows[0];

          if (invoice) {
            const paymentAmount = paymentIntent.amount / 100;
            const newAmountPaid = (invoice.amount_paid || 0) + paymentAmount;
            const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'partial';

            await sql`
              UPDATE invoices
              SET amount_paid = ${newAmountPaid}, status = ${newStatus},
                  paid_date = ${newStatus === 'paid' ? new Date().toISOString() : null}
              WHERE id = ${invoiceId}
            `;

            const paymentRows = await sql`
              INSERT INTO payments_received (customer_id, payment_date, amount, payment_method, reference_number, notes)
              VALUES (
                ${invoice.customer_id}, ${new Date().toISOString().split('T')[0]},
                ${paymentAmount}, 'stripe', ${paymentIntent.id},
                ${'Stripe payment: ' + paymentIntent.id}
              )
              RETURNING *
            `;
            const payment = paymentRows[0];

            if (payment) {
              await sql`
                INSERT INTO payment_applications (payment_id, invoice_id, amount_applied)
                VALUES (${payment.id}, ${invoiceId}, ${paymentAmount})
              `;

              const journalEntryRows = await sql`
                INSERT INTO journal_entries (entry_date, description, source_module, source_document_id, status)
                VALUES (
                  ${new Date().toISOString().split('T')[0]},
                  ${'Payment received for Invoice ' + invoice.invoice_number},
                  'stripe_payment', ${invoiceId}, 'posted'
                )
                RETURNING *
              `;
              const journalEntry = journalEntryRows[0];

              if (journalEntry) {
                await sql`
                  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description)
                  VALUES
                    (${journalEntry.id}, '1010', ${paymentAmount}, 0, 'Payment received'),
                    (${journalEntry.id}, '1200', 0, ${paymentAmount}, 'Payment received')
                `;
              }
            }
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata.invoice_id;

        if (invoiceId) {
          console.log(`Payment failed for invoice ${invoiceId}: ${paymentIntent.last_payment_error?.message}`);
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoice_id;

        if (invoiceId && session.payment_status === 'paid') {
          const invoiceRows = await sql`SELECT * FROM invoices WHERE id = ${invoiceId}`;
          const invoice = invoiceRows[0];

          if (invoice) {
            const paymentAmount = (session.amount_total || 0) / 100;
            const newAmountPaid = (invoice.amount_paid || 0) + paymentAmount;
            const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'partial';

            await sql`
              UPDATE invoices
              SET amount_paid = ${newAmountPaid}, status = ${newStatus},
                  paid_date = ${newStatus === 'paid' ? new Date().toISOString() : null}
              WHERE id = ${invoiceId}
            `;

            const paymentRows = await sql`
              INSERT INTO payments_received (customer_id, payment_date, amount, payment_method, reference_number, notes)
              VALUES (
                ${invoice.customer_id}, ${new Date().toISOString().split('T')[0]},
                ${paymentAmount}, 'stripe', ${session.payment_intent as string},
                ${'Stripe checkout: ' + session.id}
              )
              RETURNING *
            `;
            const payment = paymentRows[0];

            if (payment) {
              await sql`
                INSERT INTO payment_applications (payment_id, invoice_id, amount_applied)
                VALUES (${payment.id}, ${invoiceId}, ${paymentAmount})
              `;
            }
          }
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        const invoiceRows = await sql`
          SELECT * FROM invoices WHERE stripe_payment_intent_id = ${paymentIntentId}
        `;
        const invoice = invoiceRows[0];

        if (invoice) {
          const refundAmount = (charge.amount_refunded || 0) / 100;
          const newAmountPaid = Math.max(0, (invoice.amount_paid || 0) - refundAmount);
          const newStatus = newAmountPaid === 0 ? 'sent' : newAmountPaid < invoice.total ? 'partial' : 'paid';

          await sql`
            UPDATE invoices SET amount_paid = ${newAmountPaid}, status = ${newStatus}
            WHERE id = ${invoice.id}
          `;

          await sql`
            INSERT INTO payments_received (customer_id, amount, payment_date, payment_method, reference_number, notes)
            VALUES (
              ${invoice.customer_id}, ${-refundAmount},
              ${new Date().toISOString().split('T')[0]},
              'stripe_refund', ${charge.id}, ${'Refund: ' + charge.id}
            )
          `;
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Disable body parsing, we need the raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

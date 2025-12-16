"use client";

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { formatCurrency } from '@/lib/utils';
import {
  CheckCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  total: number;
  amount_paid: number;
  status: string;
  due_date: string;
}

function PaymentForm({ invoice, clientSecret }: { invoice: Invoice; clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const amountDue = invoice.total - invoice.amount_paid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pay/success?invoice=${invoice.id}`,
      },
    });

    if (submitError) {
      setError(submitError.message || 'An error occurred');
      setIsProcessing(false);
    }
  };

  if (isComplete) {
    return (
      <div className="text-center py-8">
        <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
        <p className="text-gray-600">Thank you for your payment.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Amount Due</span>
          <span className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900">
            {formatCurrency(amountDue)}
          </span>
        </div>
      </div>

      <PaymentElement />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 px-4 bg-[#1e3a5f] text-white rounded-lg font-medium hover:bg-[#1e3a5f]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing...
          </span>
        ) : (
          `Pay ${formatCurrency(amountDue)}`
        )}
      </button>

      <p className="text-xs text-center text-gray-500">
        Secured by Stripe. Your payment information is encrypted.
      </p>
    </form>
  );
}

export default function PayClient({ invoiceId }: { invoiceId?: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) {
      setError('No invoice specified');
      setIsLoading(false);
      return;
    }

    fetchInvoiceAndCreatePayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const fetchInvoiceAndCreatePayment = async () => {
    try {
      const invoiceRes = await fetch(`/api/invoices/${invoiceId}`);
      if (!invoiceRes.ok) {
        throw new Error('Invoice not found');
      }
      const invoiceData = await invoiceRes.json();
      setInvoice(invoiceData);

      if (invoiceData.status === 'paid') {
        setError('This invoice has already been paid');
        setIsLoading(false);
        return;
      }

      const paymentRes = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });

      if (!paymentRes.ok) {
        throw new Error('Failed to initialize payment');
      }

      const { clientSecret } = await paymentRes.json();
      setClientSecret(clientSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a5f] mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <DocumentTextIcon className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!invoice || !clientSecret) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/assets/logo.jpg"
            alt="Breco Safaris"
            className="h-10 mx-auto"
          />
        </div>

        {/* Invoice Details Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-[#1e3a5f] to-[#0d9488] px-6 py-4">
            <div className="flex items-center gap-3 text-white">
              <div>
                <p className="text-sm opacity-80">Invoice Payment</p>
                <p className="font-semibold">{invoice.invoice_number}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm invoice={invoice} clientSecret={clientSecret} />
            </Elements>
          </div>
        </div>
      </div>
    </div>
  );
}


import Link from 'next/link';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import PrintButton from '@/components/print-button';

export default function PaymentSuccessPage(props: any) {
  const invoiceId = props?.searchParams?.invoice || 'N/A';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        {/* Logo */}
        <img
          src="/assets/logo.jpg"
          alt="Breco Safaris"
          className="h-8 mx-auto mb-6"
        />

        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircleIcon className="w-10 h-10 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Successful!
        </h1>
        
        <p className="text-gray-600 mb-6">
          Thank you for your payment. A confirmation email will be sent to you shortly.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm text-gray-500 mb-1">Payment Reference</p>
          <p className="font-mono text-sm text-gray-900">
            {invoiceId || 'N/A'}
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full py-3 px-4 bg-[#1e3a5f] text-white rounded-lg font-medium hover:bg-[#1e3a5f]/90 transition-colors text-center"
          >
            Return to Breco Safaris
          </Link>
          
          <PrintButton className="block w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            Print Receipt
          </PrintButton>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-500 mt-8">
          Questions about your payment?{' '}
          <a href="tel:+256782884933" className="text-[#1e3a5f] hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </div>
  );
}


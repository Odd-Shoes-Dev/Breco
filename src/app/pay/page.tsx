'use client';

import PayClient from './PayClient';

export default function PayInvoicePage(props: any) {
  const invoiceId = props?.searchParams?.id;

  return <PayClient invoiceId={invoiceId} />;
}



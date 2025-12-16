import NewBankTransactionClient from './NewBankTransactionClient';

export default function NewBankTransactionPage(props: any) {
  const type = props?.searchParams?.type || 'deposit';
  return <NewBankTransactionClient initialType={type} />;
}


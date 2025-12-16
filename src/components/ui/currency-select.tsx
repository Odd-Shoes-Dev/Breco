import { SUPPORTED_CURRENCIES, SupportedCurrency } from '@/lib/currency';

interface CurrencySelectProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  name?: string;
  className?: string;
  disabled?: boolean;
}

export function CurrencySelect({ 
  value, 
  onChange, 
  name = 'currency',
  className = '',
  disabled = false
}: CurrencySelectProps) {
  return (
    <select 
      value={value} 
      onChange={onChange}
      name={name}
      disabled={disabled}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] ${className}`}
    >
      {Object.entries(SUPPORTED_CURRENCIES).map(([code, info]) => (
        <option key={code} value={code}>
          {info.symbol} - {info.name} ({code})
        </option>
      ))}
    </select>
  );
}


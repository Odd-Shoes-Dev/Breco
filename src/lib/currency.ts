// Currency utilities for multi-currency support
// Handles formatting, conversion, and exchange rate fetching

export type SupportedCurrency = 'USD' | 'EUR' | 'GBP' | 'UGX';

export interface CurrencyInfo {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: Record<SupportedCurrency, CurrencyInfo> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2 },
  UGX: { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', decimals: 0 },
};

export const DEFAULT_CURRENCY: SupportedCurrency = 'USD';

/**
 * Format amount as currency string with proper symbol and decimals
 */
export function formatCurrency(
  amount: number,
  currencyCode: SupportedCurrency = DEFAULT_CURRENCY
): string {
  const currency = SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES[DEFAULT_CURRENCY];
  
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(amount);

  return `${currency.symbol} ${formatted}`;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currencyCode: SupportedCurrency): string {
  return SUPPORTED_CURRENCIES[currencyCode]?.symbol || currencyCode;
}

/**
 * Get currency info
 */
export function getCurrencyInfo(currencyCode: SupportedCurrency): CurrencyInfo {
  return SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES[DEFAULT_CURRENCY];
}

/**
 * Fetch latest exchange rates from API
 */
export async function fetchExchangeRates(baseCurrency: SupportedCurrency = 'USD'): Promise<Record<string, number> | null> {
  try {
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
    
    if (!response.ok) {
      console.error('Failed to fetch exchange rates:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.rates || null;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return null;
  }
}

/**
 * Update exchange rates in database
 */
export async function updateExchangeRates(): Promise<boolean> {
  const { sql } = await import('@/lib/db');
  try {
    const rates = await fetchExchangeRates('USD');
    if (!rates) return false;

    const today = new Date().toISOString().split('T')[0];
    const nonUsdCurrencies: string[] = [];

    const pairs: { from: string; to: string; rate: number }[] = [];

    for (const currency of Object.keys(SUPPORTED_CURRENCIES)) {
      if (currency === 'USD') continue;
      if (rates[currency]) {
        pairs.push({ from: 'USD', to: currency, rate: rates[currency] });
        pairs.push({ from: currency, to: 'USD', rate: 1 / rates[currency] });
        nonUsdCurrencies.push(currency);
      }
    }

    for (let i = 0; i < nonUsdCurrencies.length; i++) {
      for (let j = i + 1; j < nonUsdCurrencies.length; j++) {
        const from = nonUsdCurrencies[i];
        const to = nonUsdCurrencies[j];
        const fromRate = rates[from];
        const toRate = rates[to];
        if (fromRate && toRate) {
          const crossRate = toRate / fromRate;
          pairs.push({ from, to, rate: crossRate });
          pairs.push({ from: to, to: from, rate: 1 / crossRate });
        }
      }
    }

    for (const pair of pairs) {
      await sql`
        INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date, source)
        VALUES (${pair.from}, ${pair.to}, ${pair.rate}, ${today}, 'exchangerate-api.com')
        ON CONFLICT (from_currency, to_currency, effective_date)
        DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source
      `;
    }

    return true;
  } catch (error) {
    console.error('Error updating exchange rates:', error);
    return false;
  }
}

/**
 * Get exchange rate from database
 */
export async function getExchangeRate(
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
  date?: string
): Promise<number | null> {
  if (fromCurrency === toCurrency) return 1;
  const { sql } = await import('@/lib/db');
  try {
    const rows = await sql`
      SELECT get_exchange_rate(${fromCurrency}, ${toCurrency}, ${date || new Date().toISOString().split('T')[0]}) AS rate
    `;
    return rows[0]?.rate ?? null;
  } catch (error) {
    console.error('Error in getExchangeRate:', error);
    return null;
  }
}

/**
 * Convert amount between currencies using database rates
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
  date?: string
): Promise<number | null> {
  if (fromCurrency === toCurrency) return amount;
  const { sql } = await import('@/lib/db');
  try {
    const rows = await sql`
      SELECT convert_currency(${amount}, ${fromCurrency}, ${toCurrency}, ${date || new Date().toISOString().split('T')[0]}) AS result
    `;
    return rows[0]?.result ?? null;
  } catch (error) {
    console.error('Error in convertCurrency:', error);
    return null;
  }
}

/**
 * Format amount with conversion info
 * Example: "USh 3,700,000 (≈ $1,000)"
 */
export function formatCurrencyWithConversion(
  amount: number,
  currency: SupportedCurrency,
  convertedAmount?: number | null,
  baseCurrency: SupportedCurrency = 'USD'
): string {
  const mainFormatted = formatCurrency(amount, currency);
  
  if (currency === baseCurrency || !convertedAmount) {
    return mainFormatted;
  }

  const convertedFormatted = formatCurrency(convertedAmount, baseCurrency);
  return `${mainFormatted} (≈ ${convertedFormatted})`;
}

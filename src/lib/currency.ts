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
export async function updateExchangeRates(supabase: any): Promise<boolean> {
  try {
    // Fetch rates for USD base (most common)
    const rates = await fetchExchangeRates('USD');
    
    if (!rates) {
      return false;
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Prepare exchange rate records
    const exchangeRates = [];
    
    const nonUsdCurrencies: string[] = [];

    for (const currency of Object.keys(SUPPORTED_CURRENCIES)) {
      if (currency === 'USD') continue;

      if (rates[currency]) {
        // USD to other currency
        exchangeRates.push({
          from_currency: 'USD',
          to_currency: currency,
          rate: rates[currency],
          effective_date: today,
          source: 'exchangerate-api.com',
        });

        // Other currency to USD
        exchangeRates.push({
          from_currency: currency,
          to_currency: 'USD',
          rate: 1 / rates[currency],
          effective_date: today,
          source: 'exchangerate-api.com',
        });

        nonUsdCurrencies.push(currency);
      }
    }

    // Cross-pairs computed via USD triangulation (e.g. EUR→UGX = USD→UGX / USD→EUR)
    for (let i = 0; i < nonUsdCurrencies.length; i++) {
      for (let j = i + 1; j < nonUsdCurrencies.length; j++) {
        const from = nonUsdCurrencies[i];
        const to = nonUsdCurrencies[j];
        const fromRate = rates[from]; // USD → from
        const toRate = rates[to];     // USD → to
        if (fromRate && toRate) {
          const crossRate = toRate / fromRate; // from → to
          exchangeRates.push({
            from_currency: from,
            to_currency: to,
            rate: crossRate,
            effective_date: today,
            source: 'exchangerate-api.com',
          });
          exchangeRates.push({
            from_currency: to,
            to_currency: from,
            rate: 1 / crossRate,
            effective_date: today,
            source: 'exchangerate-api.com',
          });
        }
      }
    }

    // Insert/update exchange rates
    const { error } = await supabase
      .from('exchange_rates')
      .upsert(exchangeRates, {
        onConflict: 'from_currency,to_currency,effective_date',
      });

    if (error) {
      console.error('Failed to save exchange rates:', error);
      return false;
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
  supabase: any,
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
  date?: string
): Promise<number | null> {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  try {
    const { data, error } = await supabase.rpc('get_exchange_rate', {
      p_from_currency: fromCurrency,
      p_to_currency: toCurrency,
      p_date: date || new Date().toISOString().split('T')[0],
    });

    if (error) {
      console.error('Error fetching exchange rate:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getExchangeRate:', error);
    return null;
  }
}

/**
 * Convert amount between currencies using database rates
 */
export async function convertCurrency(
  supabase: any,
  amount: number,
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
  date?: string
): Promise<number | null> {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  try {
    const { data, error } = await supabase.rpc('convert_currency', {
      p_amount: amount,
      p_from_currency: fromCurrency,
      p_to_currency: toCurrency,
      p_date: date || new Date().toISOString().split('T')[0],
    });

    if (error) {
      console.error('Error converting currency:', error);
      return null;
    }

    return data;
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

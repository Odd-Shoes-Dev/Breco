import { createClient } from '@/lib/supabase/server';
import type { CompanySettings } from '@/types/database';

let cachedSettings: CompanySettings | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches company settings from the database
 * Uses caching to avoid excessive database calls
 */
export async function getCompanySettings(): Promise<CompanySettings> {
  const now = Date.now();
  
  // Return cached settings if still valid
  if (cachedSettings && (now - cacheTime) < CACHE_DURATION) {
    return cachedSettings;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .single();

  if (error) {
    console.error('Failed to fetch company settings:', error);
    // Return default settings if database fetch fails
    return getDefaultSettings();
  }

  cachedSettings = data;
  cacheTime = now;
  
  return data;
}

/**
 * Returns default company settings for Breco Safaris Ltd
 */
function getDefaultSettings(): CompanySettings {
  return {
    id: '',
    name: 'Breco Safaris Ltd',
    legal_name: 'Breco Safaris Ltd',
    ein: '1014756280', // URA TIN
    address_line1: 'Kampala Road Plot 14 Eagen House',
    address_line2: 'Russel Street',
    city: 'Kampala',
    state: null,
    zip_code: 'P.O.Box 144011',
    country: 'Uganda',
    phone: '+256 782 884 933',
    email: 'brecosafaris@gmail.com',
    website: 'www.brecosafaris.com',
    logo_url: '/assets/logo.jpg',
    base_currency: 'UGX',
    fiscal_year_start_month: 1,
    inventory_method: 'fifo',
    default_payment_terms: 30,
    sales_tax_rate: 0.18, // 18% VAT in Uganda
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Clears the settings cache
 * Call this after updating company settings
 */
export function clearSettingsCache() {
  cachedSettings = null;
  cacheTime = 0;
}

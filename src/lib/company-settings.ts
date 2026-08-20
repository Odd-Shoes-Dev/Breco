import { sql } from '@/lib/db';
import type { CompanySettings } from '@/types/database';

export async function getCompanySettings(): Promise<CompanySettings> {
  try {
    const rows = await sql`SELECT * FROM company_settings LIMIT 1`;
    if (rows[0]) return rows[0] as CompanySettings;
    return getDefaultSettings();
  } catch (error) {
    console.error('Failed to fetch company settings:', error);
    return getDefaultSettings();
  }
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
    sales_tax_rate: 0.18, // 18% VAT in Uganda
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}


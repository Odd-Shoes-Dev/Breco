'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Image from 'next/image';
import {
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  BellIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  PaintBrushIcon,
  BookOpenIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import type { CompanySettings } from '@/types/database';

type SettingsTab = 'company' | 'financial' | 'invoicing' | 'notifications' | 'users' | 'security' | 'branding';

interface CompanyFormData {
  name: string;
  legal_name: string;
  ein: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  phone: string;
  email: string;
  website: string;
}

interface FinancialFormData {
  fiscal_year_start_month: number;
  default_payment_terms: number;
  sales_tax_rate: number;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [refreshingRates, setRefreshingRates] = useState(false);

  const companyForm = useForm<CompanyFormData>();
  const financialForm = useForm<FinancialFormData>();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data);
        companyForm.reset({
          name: data.name,
          legal_name: data.legal_name || '',
          ein: data.ein || '',
          address_line1: data.address_line1 || '',
          address_line2: data.address_line2 || '',
          city: data.city || '',
          state: data.state || '',
          zip_code: data.zip_code || '',
          country: data.country || 'US',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
        });
        financialForm.reset({
          fiscal_year_start_month: data.fiscal_year_start_month || 1,
          default_payment_terms: data.default_payment_terms || 30,
          sales_tax_rate: Number(data.sales_tax_rate) || 6.25,
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSaveCompany = async (data: CompanyFormData) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          id: settings?.id,
          ...data,
        });

      if (error) throw error;
      toast.success('Company settings saved!');
      loadSettings();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const onSaveFinancial = async (data: FinancialFormData) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          id: settings?.id,
          fiscal_year_start_month: data.fiscal_year_start_month,
          default_payment_terms: data.default_payment_terms,
          sales_tax_rate: data.sales_tax_rate,
        });

      if (error) throw error;
      toast.success('Financial settings saved!');
      loadSettings();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshExchangeRates = async () => {
    setRefreshingRates(true);
    try {
      const response = await fetch('/api/exchange-rates', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh exchange rates');
      }

      toast.success(`Exchange rates updated! ${data.data?.length || 0} rates refreshed from exchangerate-api.com`);
    } catch (error: any) {
      console.error('Failed to refresh exchange rates:', error);
      toast.error(error.message || 'Failed to refresh exchange rates');
    } finally {
      setRefreshingRates(false);
    }
  };

  const tabs = [
    { id: 'company' as const, label: 'Company', icon: BuildingOfficeIcon },
    { id: 'financial' as const, label: 'Financial', icon: CurrencyDollarIcon },
    { id: 'invoicing' as const, label: 'Invoicing', icon: DocumentTextIcon },
    { id: 'branding' as const, label: 'Branding', icon: PaintBrushIcon },
    { id: 'notifications' as const, label: 'Notifications', icon: BellIcon },
    { id: 'users' as const, label: 'Users', icon: UserGroupIcon },
    { id: 'security' as const, label: 'Security', icon: ShieldCheckIcon },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your company and system preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64 shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-navy-50 text-navy-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Company Settings */}
          {activeTab === 'company' && (
            <form onSubmit={companyForm.handleSubmit(onSaveCompany)} className="card">
              <div className="card-header">
                <h2 className="font-semibold text-gray-900">Company Information</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Basic information about your company
                </p>
              </div>
              <div className="card-body space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Company Name *</label>
                    <input
                      type="text"
                      {...companyForm.register('name', { required: true })}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Legal Name</label>
                    <input
                      type="text"
                      {...companyForm.register('legal_name')}
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Tax ID / EIN</label>
                    <input
                      type="text"
                      {...companyForm.register('ein')}
                      className="input"
                      placeholder="XX-XXXXXXX"
                    />
                  </div>
                </div>

                <hr />

                <h3 className="font-medium text-gray-900">Address</h3>
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="label">Street Address</label>
                    <input
                      type="text"
                      {...companyForm.register('address_line1')}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Address Line 2</label>
                    <input
                      type="text"
                      {...companyForm.register('address_line2')}
                      className="input"
                      placeholder="Suite, Unit, Building, Floor, etc."
                    />
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="form-group">
                      <label className="label">City</label>
                      <input
                        type="text"
                        {...companyForm.register('city')}
                        className="input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">State</label>
                      <input
                        type="text"
                        {...companyForm.register('state')}
                        className="input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">Postal Code</label>
                      <input
                        type="text"
                        {...companyForm.register('zip_code')}
                        className="input"
                      />
                    </div>
                  </div>
                </div>

                <hr />

                <h3 className="font-medium text-gray-900">Contact</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Phone</label>
                    <input
                      type="tel"
                      {...companyForm.register('phone')}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Email</label>
                    <input
                      type="email"
                      {...companyForm.register('email')}
                      className="input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Website</label>
                  <input
                    type="url"
                    {...companyForm.register('website')}
                    className="input"
                    placeholder="https://"
                  />
                </div>
              </div>
              <div className="card-footer flex justify-end">
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* Financial Settings */}
          {activeTab === 'financial' && (
            <form onSubmit={financialForm.handleSubmit(onSaveFinancial)} className="card">
              <div className="card-header">
                <h2 className="font-semibold text-gray-900">Financial Settings</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Configure fiscal year and default values
                </p>
              </div>
              <div className="card-body space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Fiscal Year Start Month</label>
                    <select {...financialForm.register('fiscal_year_start_month', { valueAsNumber: true })} className="input">
                      <option value={1}>January</option>
                      <option value={2}>February</option>
                      <option value={3}>March</option>
                      <option value={4}>April</option>
                      <option value={5}>May</option>
                      <option value={6}>June</option>
                      <option value={7}>July</option>
                      <option value={8}>August</option>
                      <option value={9}>September</option>
                      <option value={10}>October</option>
                      <option value={11}>November</option>
                      <option value={12}>December</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Default Payment Terms (days)</label>
                    <input
                      type="number"
                      {...financialForm.register('default_payment_terms', { valueAsNumber: true })}
                      className="input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Default Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    {...financialForm.register('sales_tax_rate', { valueAsNumber: true })}
                    className="input max-w-xs"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Massachusetts sales tax is 6.25%
                  </p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900">Base Currency</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    USD (US Dollar) - Contact support to change base currency
                  </p>
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpenIcon className="w-5 h-5 text-green-700" />
                        <h4 className="font-medium text-green-900">Chart of Accounts</h4>
                      </div>
                      <p className="text-sm text-green-700">
                        View all account numbers and categories for bills, expenses, and transactions
                      </p>
                    </div>
                    <Link 
                      href="/dashboard/chart-of-accounts"
                      className="btn-secondary whitespace-nowrap ml-4"
                    >
                      <BookOpenIcon className="w-4 h-4 mr-2" />
                      View Chart
                      <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-2" />
                    </Link>
                  </div>
                </div>

                <hr />

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Exchange Rates</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Multi-currency support with automatic exchange rate updates from exchangerate-api.com
                  </p>
                  <button
                    type="button"
                    onClick={handleRefreshExchangeRates}
                    disabled={refreshingRates}
                    className="btn-secondary"
                  >
                    {refreshingRates ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Refreshing...
                      </>
                    ) : (
                      'Refresh Exchange Rates'
                    )}
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    Last updated rates are cached in database. Click to fetch latest rates for USD, EUR, GBP, and UGX.
                  </p>
                </div>
              </div>
              <div className="card-footer flex justify-end">
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* Invoicing Settings */}
          {activeTab === 'invoicing' && (
            <div className="card">
              <div className="card-header">
                <h2 className="font-semibold text-gray-900">Invoice Settings</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Customize invoice appearance and numbering
                </p>
              </div>
              <div className="card-body space-y-6">
                <div className="form-group">
                  <label className="label">Invoice Number Prefix</label>
                  <input type="text" className="input max-w-xs" defaultValue="INV-" />
                </div>
                <div className="form-group">
                  <label className="label">Next Invoice Number</label>
                  <input type="number" className="input max-w-xs" defaultValue="1001" />
                </div>
                <div className="form-group">
                  <label className="label">Default Invoice Notes</label>
                  <textarea
                    className="input min-h-[100px]"
                    placeholder="Thank you for your business!"
                    defaultValue="Thank you for your business! Payment is due within the terms specified above."
                  />
                </div>
                <div className="form-group">
                  <label className="label">Default Invoice Terms</label>
                  <textarea
                    className="input min-h-[100px]"
                    placeholder="Payment terms and conditions..."
                  />
                </div>
              </div>
              <div className="card-footer flex justify-end">
                <button className="btn-primary">Save Changes</button>
              </div>
            </div>
          )}

          {/* Branding */}
          {activeTab === 'branding' && (
            <div className="card">
              <div className="card-header">
                <h2 className="font-semibold text-gray-900">Branding</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Upload your logo and customize appearance
                </p>
              </div>
              <div className="card-body space-y-6">
                <div className="form-group">
                  <label className="label">Company Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                      {settings?.logo_url ? (
                        <Image
                          src={settings.logo_url}
                          alt="Logo"
                          width={96}
                          height={96}
                          className="object-contain"
                        />
                      ) : (
                        <PaintBrushIcon className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <button type="button" className="btn-secondary">
                        Upload Logo
                      </button>
                      <p className="text-sm text-gray-500 mt-2">
                        PNG, JPG up to 2MB. Recommended size: 200x200px
                      </p>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Brand Colors</label>
                  <div className="flex gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Primary (Navy)</label>
                      <div className="w-12 h-12 rounded-lg bg-navy-600 border border-gray-200 mt-1" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Accent (Magenta)</label>
                      <div className="w-12 h-12 rounded-lg bg-magenta-600 border border-gray-200 mt-1" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Secondary (Purple)</label>
                      <div className="w-12 h-12 rounded-lg bg-purple-600 border border-gray-200 mt-1" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="card-footer flex justify-end">
                <button className="btn-primary">Save Changes</button>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div className="card">
              <div className="card-header">
                <h2 className="font-semibold text-gray-900">Notification Preferences</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Control when and how you receive notifications
                </p>
              </div>
              <div className="card-body space-y-4">
                {[
                  { label: 'Invoice paid', description: 'When a customer pays an invoice' },
                  { label: 'Invoice overdue', description: 'When an invoice becomes overdue' },
                  { label: 'Bill due soon', description: 'Reminder before a bill is due' },
                  { label: 'Low stock alert', description: 'When inventory falls below reorder point' },
                  { label: 'Bank reconciliation', description: 'Weekly reconciliation reminders' },
                ].map((item) => (
                  <label key={item.label} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <input type="checkbox" defaultChecked className="mt-1" />
                    <div>
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="card-footer flex justify-end">
                <button className="btn-primary">Save Changes</button>
              </div>
            </div>
          )}

          {/* Users */}
          {activeTab === 'users' && (
            <div className="card">
              <div className="card-header flex justify-between items-center">
                <div>
                  <h2 className="font-semibold text-gray-900">Team Members</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Manage user access and permissions
                  </p>
                </div>
                <button className="btn-primary">Invite User</button>
              </div>
              <div className="card-body">
                <div className="text-center py-8 text-gray-500">
                  <UserGroupIcon className="w-12 h-12 mx-auto text-gray-400" />
                  <p className="mt-2">You're the only user</p>
                  <p className="text-sm">Invite team members to collaborate</p>
                </div>
              </div>
            </div>
          )}

          {/* Security */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="card">
                <div className="card-header">
                  <h2 className="font-semibold text-gray-900">Password</h2>
                </div>
                <div className="card-body space-y-4">
                  <div className="form-group">
                    <label className="label">Current Password</label>
                    <input type="password" className="input max-w-md" />
                  </div>
                  <div className="form-group">
                    <label className="label">New Password</label>
                    <input type="password" className="input max-w-md" />
                  </div>
                  <div className="form-group">
                    <label className="label">Confirm New Password</label>
                    <input type="password" className="input max-w-md" />
                  </div>
                </div>
                <div className="card-footer flex justify-end">
                  <button className="btn-primary">Update Password</button>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2 className="font-semibold text-gray-900">Two-Factor Authentication</h2>
                </div>
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">2FA is not enabled</p>
                      <p className="text-sm text-gray-500">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <button className="btn-secondary">Enable 2FA</button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2 className="font-semibold text-gray-900">Active Sessions</h2>
                </div>
                <div className="card-body">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Current Session</p>
                      <p className="text-sm text-gray-500">Windows • Chrome • Active now</p>
                    </div>
                    <span className="badge badge-success">Current</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


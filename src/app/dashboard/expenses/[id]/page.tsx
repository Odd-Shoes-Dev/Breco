'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PrinterIcon,
  PencilIcon,
  TrashIcon,
  ReceiptPercentIcon,
  BuildingOfficeIcon,
  CreditCardIcon,
  CalendarIcon,
  TagIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';

interface Expense {
  id: string;
  expense_number: string;
  expense_date: string;
  payee: string | null;
  vendor_id: string | null;
  amount: number;
  tax_amount: number;
  total: number;
  currency: string;
  payment_method: string;
  reference_number: string | null;
  expense_account_id: string;
  payment_account_id: string;
  category: string | null;
  department: string | null;
  project_id: string | null;
  description: string | null;
  receipt_url: string | null;
  is_reimbursable: boolean;
  is_billable: boolean;
  status: string;
  created_at: string;
  vendors?: {
    name: string;
    email: string;
    company_name: string;
    phone: string;
  };
  expense_account?: {
    name: string;
    code: string;
  };
  payment_account?: {
    name: string;
    code: string;
  };
}

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadExpenseDetails();
    }
  }, [params.id]);

  const loadExpenseDetails = async () => {
    try {
      setLoading(true);

      // Fetch expense with related data
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          vendors (
            name,
            email,
            company_name,
            phone
          ),
          expense_account:expense_account_id (
            name,
            code
          ),
          payment_account:payment_account_id (
            name,
            code
          )
        `)
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setExpense(data);
    } catch (error) {
      console.error('Failed to load expense:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    const currency = expense?.currency || 'USD';
    return currencyFormatter(num, currency as any);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handlePrint = () => {
    if (!expense) return;

    const printHTML = `
      <html>
        <head>
          <title>Expense #${expense.expense_number} - Breco Safaris Ltd</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #111827;
              background: white;
              padding: 40px;
            }
            .header { 
              display: flex; 
              align-items: center; 
              justify-content: space-between;
              margin-bottom: 30px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 20px;
            }
            .company-section {
              display: flex;
              align-items: center;
            }
            .logo { 
              width: 200px; 
              height: 200px; 
              margin-right: 20px;
              border-radius: 8px;
              object-fit: contain;
            }
            .company-info h1 { 
              font-size: 24px; 
              font-weight: bold; 
              color: #1e3a5f;
              margin-bottom: 4px;
            }
            .company-info .address { 
              font-size: 12px; 
              color: #6b7280;
              margin-bottom: 2px;
            }
            .expense-header { 
              text-align: right;
            }
            .expense-header h2 { 
              font-size: 28px; 
              font-weight: bold; 
              color: #1e3a5f;
              margin-bottom: 4px;
            }
            .expense-header .number { 
              font-size: 14px; 
              color: #6b7280;
            }
            .expense-details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin: 25px 0;
            }
            .section {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 15px;
              background: #f9fafb;
            }
            .section h3 {
              font-size: 12px;
              font-weight: bold;
              color: #6b7280;
              margin-bottom: 10px;
              text-transform: uppercase;
            }
            .section p {
              font-size: 14px;
              color: #111827;
              margin-bottom: 4px;
            }
            .section .label {
              font-size: 12px;
              color: #6b7280;
            }
            .section .value {
              font-size: 14px;
              color: #111827;
              font-weight: 500;
            }
            .description-section {
              grid-column: 1 / -1;
            }
            .accounting-section {
              margin: 25px 0;
              padding: 20px;
              background: #f9fafb;
              border-radius: 8px;
            }
            .accounting-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-top: 10px;
            }
            .account-box {
              background: white;
              padding: 12px;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
            }
            .amount-section {
              margin: 30px 0;
              padding: 20px;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
            }
            .amount-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
            }
            .amount-row.total {
              border-top: 2px solid #111827;
              margin-top: 10px;
              padding-top: 15px;
              font-size: 18px;
              font-weight: bold;
            }
            .flags {
              display: flex;
              gap: 10px;
              margin: 20px 0;
            }
            .flag {
              padding: 6px 12px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 600;
            }
            .flag.reimbursable {
              background: #dbeafe;
              color: #1e40af;
            }
            .flag.billable {
              background: #d1fae5;
              color: #065f46;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              font-size: 11px;
              color: #6b7280;
            }
            @media print {
              body { padding: 20px; }
              @page { margin: 0.5in; }
            }
          </style>
        </head>
        <body>
          <!-- Header -->
          <div class="header">
            <div class="company-section">
              <img src="/assets/logo.jpg" alt="Breco Safaris Logo" class="logo" />
              <div class="company-info">
                <h1>Breco Safaris Ltd</h1>
                <p class="address">Kampala Road Plot 14 Eagen House, Russel Street</p>
                <p class="address">P.O.Box 144011, Kampala, Uganda</p>
                <p class="address">Tel: +256 782 884 933 | +256 772 891 729 | +256 775 766 578</p>
                <p class="address">Email: brecosafaris@gmail.com | Website: www.brecosafaris.com</p>
                <p class="address">URA TIN: 1014756280 | URSB Reg. No: 80020001634842</p>
              </div>
            </div>
            <div class="expense-header">
              <h2>EXPENSE</h2>
              <p class="number">#${expense.expense_number}</p>
              <p class="number">${formatDate(expense.expense_date)}</p>
            </div>
          </div>

          <!-- Details Grid -->
          <div class="expense-details">
            <!-- Payee -->
            <div class="section">
              <h3>Payee Information</h3>
              <p><strong>${expense.vendors?.company_name || expense.vendors?.name || expense.payee || 'N/A'}</strong></p>
              ${expense.vendors?.email ? `<p>${expense.vendors.email}</p>` : ''}
              ${expense.vendors?.phone ? `<p>${expense.vendors.phone}</p>` : ''}
            </div>

            <!-- Payment Details -->
            <div class="section">
              <h3>Payment Details</h3>
              <p><span class="label">Method:</span> <span class="value">${expense.payment_method.replace(/_/g, ' ').toUpperCase()}</span></p>
              ${expense.reference_number ? `<p><span class="label">Reference:</span> <span class="value">${expense.reference_number}</span></p>` : ''}
              <p><span class="label">Date:</span> <span class="value">${formatDate(expense.expense_date)}</span></p>
            </div>

            <!-- Description -->
            ${expense.description ? `
            <div class="section description-section">
              <h3>Description</h3>
              <p>${expense.description}</p>
            </div>
            ` : ''}

            <!-- Categorization -->
            ${(expense.category || expense.department) ? `
            <div class="section">
              <h3>Categorization</h3>
              ${expense.category ? `<p><span class="label">Category:</span> <span class="value">${expense.category.replace(/_/g, ' ').toUpperCase()}</span></p>` : ''}
              ${expense.department ? `<p><span class="label">Department:</span> <span class="value">${expense.department}</span></p>` : ''}
            </div>
            ` : ''}
          </div>

          <!-- Accounting Details -->
          <div class="accounting-section">
            <h3>Accounting Details</h3>
            <div class="accounting-grid">
              <div class="account-box">
                <p class="label">Expense Account</p>
                <p class="value">${expense.expense_account?.code} - ${expense.expense_account?.name}</p>
              </div>
              <div class="account-box">
                <p class="label">Payment Account</p>
                <p class="value">${expense.payment_account?.code} - ${expense.payment_account?.name}</p>
              </div>
            </div>
          </div>

          <!-- Amount Breakdown -->
          <div class="amount-section">
            <div class="amount-row">
              <span>Amount</span>
              <span>${formatCurrency(expense.amount)}</span>
            </div>
            ${parseFloat(expense.tax_amount as any) > 0 ? `
            <div class="amount-row">
              <span>Tax</span>
              <span>${formatCurrency(expense.tax_amount)}</span>
            </div>
            ` : ''}
            <div class="amount-row total">
              <span>TOTAL</span>
              <span>${formatCurrency(expense.total)}</span>
            </div>
          </div>

          <!-- Flags -->
          ${(expense.is_reimbursable || expense.is_billable) ? `
          <div class="flags">
            ${expense.is_reimbursable ? '<div class="flag reimbursable">REIMBURSABLE</div>' : ''}
            ${expense.is_billable ? '<div class="flag billable">BILLABLE TO CLIENT</div>' : ''}
          </div>
          ` : ''}

          <!-- Footer -->
          <div class="footer">
            <p>This is a computer-generated document. No signature required.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;

    // Open print dialog in new window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.focus();

      // Wait a moment for content to load, then show print dialog
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleApprove = async () => {
    if (!confirm('Approve this expense?')) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`/api/expenses/${params.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      
      // Reload expense
      await loadExpenseDetails();
      alert('Expense approved successfully');
    } catch (error: any) {
      console.error('Failed to approve expense:', error);
      alert(error.message || 'Failed to approve expense');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`/api/expenses/${params.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: reason }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      
      // Reload expense
      await loadExpenseDetails();
      alert('Expense rejected');
    } catch (error: any) {
      console.error('Failed to reject expense:', error);
      alert(error.message || 'Failed to reject expense');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Permanently delete this expense? This action cannot be undone.')) return;
    
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', params.id);

      if (error) throw error;

      router.push('/dashboard/expenses');
    } catch (error: any) {
      console.error('Failed to delete expense:', error);
      alert(error.message || 'Failed to delete expense');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-breco-navy"></div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Expense not found</p>
        <Link href="/dashboard/expenses" className="btn-primary mt-4">
          Back to Expenses
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-4 md:mb-6 print:hidden">
        <div className="flex items-center gap-3 md:gap-4 mb-4">
          <Link
            href="/dashboard/expenses"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Expense #: {expense.expense_number}</h1>
            <p className="text-sm md:text-base text-gray-600">Expense Details</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3">
          <button onClick={handlePrint} className="btn-secondary flex-1 sm:flex-none">
            <PrinterIcon className="w-5 h-5 md:mr-2" />
            <span className="hidden md:inline">Print</span>
          </button>
          
          {expense.status !== 'approved' && expense.status !== 'paid' && expense.status !== 'rejected' && (
            <Link 
              href={`/dashboard/expenses/${params.id}/edit`}
              className="btn-secondary inline-flex items-center flex-1 sm:flex-none"
            >
              <PencilIcon className="w-5 h-5 md:mr-2" />
              <span className="hidden md:inline">Edit</span>
            </Link>
          )}
          
          {expense.status === 'pending' && (
            <>
              <button 
                onClick={handleApprove} 
                disabled={actionLoading}
                className="btn-primary flex-1 sm:flex-none"
              >
                <CheckCircleIcon className="w-5 h-5 md:mr-2" />
                <span className="hidden md:inline">Approve</span>
              </button>
              <button 
                onClick={handleReject} 
                disabled={actionLoading}
                className="btn-secondary text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
              >
                <XCircleIcon className="w-5 h-5 md:mr-2" />
                <span className="hidden md:inline">Reject</span>
              </button>
            </>
          )}
          
          {(expense.status === 'pending' || expense.status === 'rejected') && (
            <button 
              onClick={handleDelete} 
              disabled={actionLoading}
              className="btn-secondary text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
            >
              <TrashIcon className="w-5 h-5 md:mr-2" />
              <span className="hidden md:inline">Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Expense Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header Section */}
        <div className="p-4 md:p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <ReceiptPercentIcon className="w-6 h-6 md:w-8 md:h-8 text-breco-navy" />
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">EXPENSE</h2>
              </div>
              <p className="text-sm md:text-base text-gray-600">Expense #: {expense.expense_number}</p>
              {expense.reference_number && (
                <p className="text-sm md:text-base text-gray-600">Reference: {expense.reference_number}</p>
              )}
              <div className="mt-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                  expense.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  expense.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                  expense.status === 'paid' ? 'bg-green-100 text-green-800' :
                  expense.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {expense.status.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs md:text-sm text-gray-500 mb-1">Date</p>
              <p className="text-base md:text-lg font-semibold text-gray-900">{formatDate(expense.expense_date)}</p>
            </div>
          </div>
        </div>

        {/* Main Details */}
        <div className="grid md:grid-cols-2 gap-4 md:gap-6 p-4 md:p-6 border-b border-gray-200">
          {/* Payee Information */}
          <div>
            <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-2 md:mb-3 flex items-center gap-2">
              <BuildingOfficeIcon className="w-4 h-4" />
              PAYEE
            </h3>
            <div className="bg-gray-50 rounded-lg p-3 md:p-4">
              <p className="text-sm md:text-base font-medium text-gray-900">
                {expense.vendors?.company_name || expense.vendors?.name || expense.payee || 'N/A'}
              </p>
              {expense.vendors?.email && (
                <p className="text-xs md:text-sm text-gray-600 mt-1">{expense.vendors.email}</p>
              )}
              {expense.vendors?.phone && (
                <p className="text-xs md:text-sm text-gray-600">{expense.vendors.phone}</p>
              )}
            </div>
          </div>

          {/* Payment Information */}
          <div>
            <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-2 md:mb-3 flex items-center gap-2">
              <CreditCardIcon className="w-4 h-4" />
              PAYMENT DETAILS
            </h3>
            <div className="bg-gray-50 rounded-lg p-3 md:p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs md:text-sm text-gray-600">Method:</span>
                <span className="text-sm md:text-base font-medium text-gray-900 capitalize">
                  {expense.payment_method.replace(/_/g, ' ')}
                </span>
              </div>
              {expense.reference_number && (
                <div className="flex justify-between">
                  <span className="text-xs md:text-sm text-gray-600">Reference:</span>
                  <span className="text-sm md:text-base font-medium text-gray-900">{expense.reference_number}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs md:text-sm text-gray-600">Date:</span>
                <span className="text-sm md:text-base font-medium text-gray-900">{formatDate(expense.expense_date)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Description & Category */}
        <div className="p-4 md:p-6 border-b border-gray-200">
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-2">DESCRIPTION</h3>
              <p className="text-sm md:text-base text-gray-900">{expense.description || 'No description provided'}</p>
            </div>
            <div>
              <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-2 md:mb-3 flex items-center gap-2">
                <TagIcon className="w-4 h-4" />
                CATEGORIZATION
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs md:text-sm text-gray-600">Department:</span>
                  <span className={`text-sm md:text-base font-medium ${expense.department ? 'text-gray-900' : 'text-red-600'}`}>
                    {expense.department || 'Not Set'}
                  </span>
                </div>
                {expense.category && (
                  <div className="flex justify-between">
                    <span className="text-xs md:text-sm text-gray-600">Category:</span>
                    <span className="text-sm md:text-base font-medium text-gray-900 capitalize">
                      {expense.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Account Details */}
        <div className="p-4 md:p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-3 md:mb-4">ACCOUNTING DETAILS</h3>
          <div className="grid md:grid-cols-2 gap-3 md:gap-4">
            <div className="bg-white rounded-lg p-3 md:p-4">
              <p className="text-xs text-gray-500 mb-1">Expense Account</p>
              <p className="text-sm md:text-base font-medium text-gray-900">
                {expense.expense_account?.code} - {expense.expense_account?.name}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 md:p-4">
              <p className="text-xs text-gray-500 mb-1">Payment Account</p>
              <p className="text-sm md:text-base font-medium text-gray-900">
                {expense.payment_account?.code} - {expense.payment_account?.name}
              </p>
            </div>
          </div>
        </div>

        {/* Amount Breakdown */}
        <div className="p-4 md:p-6 bg-gray-50">
          <div className="flex justify-end">
            <div className="w-full md:w-80 space-y-2 md:space-y-3">
              <div className="flex justify-between text-gray-700">
                <span className="text-sm md:text-base">Amount</span>
                <span className="text-sm md:text-base font-medium">{formatCurrency(expense.amount)}</span>
              </div>
              {parseFloat(expense.tax_amount as any) > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span className="text-sm md:text-base">Tax</span>
                  <span className="text-sm md:text-base font-medium">{formatCurrency(expense.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 md:pt-3 border-t-2 border-gray-300">
                <span className="font-bold text-gray-900 text-base md:text-lg">Total</span>
                <span className="font-bold text-gray-900 text-xl md:text-2xl">
                  {formatCurrency(expense.total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Flags */}
        {(expense.is_reimbursable || expense.is_billable) && (
          <div className="p-4 md:p-6 border-t border-gray-200">
            <div className="flex flex-wrap gap-2 md:gap-4">
              {expense.is_reimbursable && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs md:text-sm font-medium bg-blue-100 text-blue-800">
                  Reimbursable
                </span>
              )}
              {expense.is_billable && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs md:text-sm font-medium bg-green-100 text-green-800">
                  Billable to Client
                </span>
              )}
            </div>
          </div>
        )}

        {/* Receipt */}
        {expense.receipt_url && (
          <div className="p-4 md:p-6 border-t border-gray-200">
            <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-2">RECEIPT</h3>
            <a 
              href={expense.receipt_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm md:text-base text-breco-navy hover:text-breco-navy/80 flex items-center gap-2"
            >
              <DocumentTextIcon className="w-5 h-5" />
              View Receipt
            </a>
          </div>
        )}

        {/* Metadata */}
        <div className="p-4 md:p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">
            <p>Created: {new Date(expense.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

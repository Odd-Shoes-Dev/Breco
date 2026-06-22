import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface TaxDeduction {
  category: string;
  description: string;
  amount: number;
  deductible: boolean;
}

interface QuarterlyTax {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  period: string;
  estimatedPayment: number;
  actualPayment: number;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'Overdue';
}

interface TaxSummaryData {
  reportPeriod: {
    taxYear: number;
    startDate: string;
    endDate: string;
  };
  income: {
    grossRevenue: number;
    netIncome: number;
    operatingIncome: number;
    otherIncome: number;
    totalTaxableIncome: number;
  };
  deductions: {
    totalDeductions: number;
    businessExpenses: number;
    depreciation: number;
    interestExpenses: number;
    otherDeductions: number;
    itemizedDeductions: TaxDeduction[];
  };
  taxCalculations: {
    taxableIncome: number;
    federalTaxRate: number;
    federalTaxLiability: number;
    stateTaxRate: number;
    stateTaxLiability: number;
    selfEmploymentTax: number;
    totalTaxLiability: number;
    effectiveTaxRate: number;
  };
  payments: {
    quarterlyPayments: QuarterlyTax[];
    totalPaid: number;
    withheld: number;
    refundDue: number;
    balanceDue: number;
  };
  compliance: {
    filingStatus: 'Corporation' | 'Partnership' | 'LLC' | 'Sole Proprietorship';
    ein: string;
    filingDeadline: string;
    extensionFiled: boolean;
    extensionDeadline?: string;
    estimatedPenalty: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taxYear = parseInt(searchParams.get('taxYear') || new Date().getFullYear().toString());

    const currentYear = new Date().getFullYear();
    if (taxYear < currentYear - 10 || taxYear > currentYear + 1) {
      return NextResponse.json({ error: 'Invalid tax year' }, { status: 400 });
    }

    const startDate = `${taxYear}-01-01`;
    const endDate = `${taxYear}-12-31`;

    // Fetch invoices for revenue (paid and partial)
    const invoices = await sql`
      SELECT total_amount, amount_paid, status, issue_date FROM invoices
      WHERE issue_date >= ${startDate}
        AND issue_date <= ${endDate}
        AND status IN ('paid', 'partial')
    `;

    const grossRevenue = invoices.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0);

    // Fetch expenses for deductions
    const expenses = await sql`
      SELECT amount, category, description, expense_date FROM expenses
      WHERE expense_date >= ${startDate} AND expense_date <= ${endDate}
    `;

    // Fetch bills for additional deductions
    const bills = await sql`
      SELECT total_amount, amount_paid, category, description, bill_date FROM bills
      WHERE bill_date >= ${startDate}
        AND bill_date <= ${endDate}
        AND status IN ('paid', 'partial')
    `;

    // Fetch assets for depreciation calculation
    const assets = await sql`
      SELECT purchase_price, depreciation_method, useful_life_months, accumulated_depreciation, purchase_date
      FROM assets
      WHERE purchase_date <= ${endDate} AND status = 'active'
    `;

    const currentDate = new Date(endDate);
    const depreciation = assets.reduce((sum: number, asset: any) => {
      const purchaseDate = new Date(asset.purchase_date);
      if (purchaseDate > currentDate) return sum;

      const monthsElapsed = Math.min(
        asset.useful_life_months || 60,
        ((currentDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      );

      const annualDepreciation = (asset.purchase_price || 0) / ((asset.useful_life_months || 60) / 12);
      const monthsInYear = Math.min(12, monthsElapsed);

      return sum + (annualDepreciation * (monthsInYear / 12));
    }, 0);

    const expenseCategories: Record<string, number> = {};
    const itemizedDeductions: TaxDeduction[] = [];

    expenses.forEach((exp: any) => {
      const category = exp.category || 'Other Expenses';
      expenseCategories[category] = (expenseCategories[category] || 0) + (exp.amount || 0);
    });

    bills.forEach((bill: any) => {
      const category = bill.category || 'Vendor Payments';
      expenseCategories[category] = (expenseCategories[category] || 0) + (bill.amount_paid || 0);
    });

    Object.entries(expenseCategories).forEach(([category, amount]) => {
      if (amount > 0) {
        itemizedDeductions.push({
          category,
          description: `${category} expenses for ${taxYear}`,
          amount,
          deductible: true
        });
      }
    });

    if (depreciation > 0) {
      itemizedDeductions.push({
        category: 'Depreciation',
        description: 'Asset depreciation for the year',
        amount: depreciation,
        deductible: true
      });
    }

    const businessExpenses = Object.values(expenseCategories).reduce((sum, val) => sum + val, 0);
    const interestExpenses = expenseCategories['Interest'] || 0;
    const otherDeductions = expenseCategories['Other Expenses'] || 0;
    const totalDeductions = businessExpenses + depreciation;

    const operatingIncome = grossRevenue - businessExpenses;
    const otherIncome = 0;
    const netIncome = operatingIncome + otherIncome;

    const taxableIncome = Math.max(0, netIncome - depreciation);
    const federalTaxRate = 0.21;
    const stateTaxRate = 0.063;
    const federalTaxLiability = taxableIncome * federalTaxRate;
    const stateTaxLiability = taxableIncome * stateTaxRate;
    const selfEmploymentTax = netIncome * 0.153;
    const totalTaxLiability = federalTaxLiability + stateTaxLiability + selfEmploymentTax;
    const effectiveTaxRate = netIncome > 0 ? totalTaxLiability / netIncome : 0;

    const quarterlyEstimate = totalTaxLiability / 4;
    const quarterlyPayments: QuarterlyTax[] = [
      {
        quarter: 'Q1',
        period: `Jan - Mar ${taxYear}`,
        estimatedPayment: quarterlyEstimate,
        actualPayment: taxYear < currentYear ? quarterlyEstimate : 0,
        dueDate: `${taxYear}-04-15`,
        status: taxYear < currentYear ? 'Paid' : 'Pending'
      },
      {
        quarter: 'Q2',
        period: `Apr - Jun ${taxYear}`,
        estimatedPayment: quarterlyEstimate,
        actualPayment: taxYear < currentYear ? quarterlyEstimate : 0,
        dueDate: `${taxYear}-06-15`,
        status: taxYear < currentYear ? 'Paid' : 'Pending'
      },
      {
        quarter: 'Q3',
        period: `Jul - Sep ${taxYear}`,
        estimatedPayment: quarterlyEstimate,
        actualPayment: taxYear < currentYear ? quarterlyEstimate : 0,
        dueDate: `${taxYear}-09-15`,
        status: taxYear < currentYear ? 'Paid' : 'Pending'
      },
      {
        quarter: 'Q4',
        period: `Oct - Dec ${taxYear}`,
        estimatedPayment: quarterlyEstimate,
        actualPayment: taxYear < currentYear ? quarterlyEstimate : 0,
        dueDate: `${taxYear + 1}-01-15`,
        status: taxYear < currentYear ? 'Paid' : 'Pending'
      }
    ];

    const totalPaid = quarterlyPayments.reduce((sum, q) => sum + q.actualPayment, 0);
    const balanceDue = totalTaxLiability - totalPaid;

    const taxData: TaxSummaryData = {
      reportPeriod: {
        taxYear,
        startDate,
        endDate
      },
      income: {
        grossRevenue,
        netIncome,
        operatingIncome,
        otherIncome,
        totalTaxableIncome: netIncome
      },
      deductions: {
        totalDeductions,
        businessExpenses,
        depreciation,
        interestExpenses,
        otherDeductions,
        itemizedDeductions
      },
      taxCalculations: {
        taxableIncome,
        federalTaxRate,
        federalTaxLiability,
        stateTaxRate,
        stateTaxLiability,
        selfEmploymentTax,
        totalTaxLiability,
        effectiveTaxRate
      },
      payments: {
        quarterlyPayments,
        totalPaid,
        withheld: 0,
        refundDue: balanceDue < 0 ? Math.abs(balanceDue) : 0,
        balanceDue: balanceDue > 0 ? balanceDue : 0
      },
      compliance: {
        filingStatus: 'LLC',
        ein: '99-3334108',
        filingDeadline: `${taxYear + 1}-03-15`,
        extensionFiled: false,
        estimatedPenalty: balanceDue > 1000 ? balanceDue * 0.02 : 0
      }
    };

    return NextResponse.json(taxData);
  } catch (error) {
    console.error('Tax summary API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

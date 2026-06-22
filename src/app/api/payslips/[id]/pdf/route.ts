import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { generatePayslipHTML, type PayslipData } from '@/lib/pdf/payslip-pdf';

// GET /api/payslips/[id]/pdf - Generate and download payslip PDF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch payslip with employee and period details
    const rows = await sql`
      SELECT ps.*,
        row_to_json(e.*) AS employee,
        json_build_object(
          'period_name', pp.period_name,
          'start_date', pp.start_date,
          'end_date', pp.end_date,
          'payment_date', pp.payment_date,
          'status', pp.status
        ) AS payroll_period
      FROM payslips ps
      LEFT JOIN employees e ON e.id = ps.employee_id
      LEFT JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
      WHERE ps.id = ${id}
    `;
    const payslip = rows[0];

    if (!payslip) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    // Fetch payslip items
    const payslipItems = await sql`
      SELECT * FROM payslip_items
      WHERE payslip_id = ${id}
      ORDER BY item_type DESC, item_name ASC
    `;

    // Prepare payslip data
    const payslipData: PayslipData = {
      ...payslip,
      payslip_items: payslipItems || [],
    };

    // Generate HTML
    const htmlContent = generatePayslipHTML(payslipData);

    const filename = `Payslip_${payslip.payslip_number}_${payslip.employee.first_name}_${payslip.employee.last_name}.html`;

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('Error generating payslip PDF:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate payslip PDF' },
      { status: 500 }
    );
  }
}

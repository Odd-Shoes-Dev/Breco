import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { generatePayslipHTML, type PayslipData } from '@/lib/pdf/payslip-pdf';

// GET /api/payslips/[id]/pdf - Generate and download payslip PDF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch payslip with employee and period details
    const { data: payslip, error: payslipError } = await supabase
      .from('payslips')
      .select(`
        *,
        employee:employees(*),
        payroll_period:payroll_periods(period_name, start_date, end_date, payment_date, status)
      `)
      .eq('id', id)
      .single();

    if (payslipError || !payslip) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    // Fetch payslip items
    const { data: payslipItems } = await supabase
      .from('payslip_items')
      .select('*')
      .eq('payslip_id', id)
      .order('item_type', { ascending: false })
      .order('item_name');

    // Prepare payslip data
    const payslipData: PayslipData = {
      ...payslip,
      payslip_items: payslipItems || [],
    };

    // Generate HTML
    const htmlContent = generatePayslipHTML(payslipData);

    // Return HTML as downloadable file
    // Note: For true PDF generation, you would need a library like puppeteer or jsPDF
    // For now, we return HTML that can be printed to PDF by the browser
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

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { generatePayslipHTML, type PayslipData } from '@/lib/pdf/payslip-pdf';
import { Resend } from 'resend';

// POST /api/payslips/[id]/email - Email payslip to employee
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Email service is not configured. Please contact your administrator.' },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
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

    // Check if employee has email
    if (!payslip.employee.email) {
      return NextResponse.json(
        { error: 'Employee does not have an email address on file' },
        { status: 400 }
      );
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

    // Send email via Resend
    const emailData = await resend.emails.send({
      from: 'Breco Safaris HR <hr@brecosafaris.com>',
      to: [payslip.employee.email],
      subject: `Your Payslip - ${payslip.payroll_period.period_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e3a8a;">Dear ${payslip.employee.first_name},</h2>
          
          <p style="color: #374151; line-height: 1.6;">
            Your payslip for <strong>${payslip.payroll_period.period_name}</strong> is now available.
          </p>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0; color: #6b7280;"><strong>Pay Period:</strong> ${new Date(payslip.payroll_period.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${new Date(payslip.payroll_period.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            <p style="margin: 5px 0; color: #6b7280;"><strong>Payment Date:</strong> ${new Date(payslip.payroll_period.payment_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p style="margin: 5px 0; color: #16a34a; font-size: 18px; font-weight: bold;"><strong>Net Pay:</strong> UGX ${payslip.net_salary.toLocaleString()}</p>
          </div>
          
          <p style="color: #374151; line-height: 1.6;">
            Your detailed payslip is attached to this email. Please review it and contact HR if you have any questions.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
              <strong>Breco Safaris Ltd</strong><br>
              HR Department<br>
              Email: hr@brecosafaris.com
            </p>
          </div>
          
          <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Payslip_${payslip.payslip_number}_${payslip.employee.first_name}_${payslip.employee.last_name}.html`,
          content: Buffer.from(htmlContent).toString('base64'),
        },
      ],
    });

    if (!emailData.data) {
      throw new Error('Failed to send email');
    }

    return NextResponse.json({
      success: true,
      message: 'Payslip emailed successfully',
      emailId: emailData.data.id,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error emailing payslip:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send payslip email' },
      { status: 500 }
    );
  }
}

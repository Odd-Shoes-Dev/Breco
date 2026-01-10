import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bookings/[id]/generate-invoice - Generate invoice from booking
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: bookingId } = await context.params;
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(id, name, email, phone, address_line1, city, country),
        tour_package:tour_packages(id, name, package_code),
        hotel:hotels(id, name, star_rating),
        vehicle:vehicles!bookings_assigned_vehicle_id_fkey(id, vehicle_type, registration_number)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Check if invoice already exists for this booking
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id, invoice_number')
      .eq('booking_id', bookingId)
      .single();

    if (existingInvoice) {
      return NextResponse.json(
        { 
          error: 'Invoice already exists for this booking',
          invoice_id: existingInvoice.id,
          invoice_number: existingInvoice.invoice_number
        },
        { status: 400 }
      );
    }

    // Determine invoice type and amount
    const invoiceType = body.invoice_type || 'full'; // 'full', 'deposit', 'balance'
    let amount = booking.total;
    
    // Generate description based on booking type
    let description = '';
    switch (booking.booking_type) {
      case 'tour':
        description = `Tour: ${booking.tour_package?.name || 'Tour Package'}`;
        break;
      case 'hotel':
        description = `Hotel Booking: ${booking.hotel?.name || 'Accommodation'}`;
        break;
      case 'car_hire':
        description = `Car Hire: ${booking.vehicle?.vehicle_type || 'Vehicle Rental'}`;
        break;
      case 'custom':
        const items = [];
        if (booking.hotel) items.push(booking.hotel.name);
        if (booking.vehicle) items.push(booking.vehicle.vehicle_type);
        description = `Custom Booking: ${items.join(' + ')}`;
        break;
      default:
        description = `Booking: ${booking.booking_number}`;
    }
    
    let isAdvancePayment = false;
    
    if (invoiceType === 'deposit') {
      // Calculate deposit (default 30% or specified amount)
      const depositPercent = body.deposit_percent || 30;
      amount = booking.total * (depositPercent / 100);
      description = `Deposit (${depositPercent}%) - ${description}`;
      isAdvancePayment = true;
    } else if (invoiceType === 'balance') {
      // Calculate balance (total - amount already paid)
      amount = booking.total - (booking.amount_paid || 0);
      description = `Balance Payment - ${description}`;
      isAdvancePayment = true;
    }

    // Generate invoice number
    const { data: latestInvoice } = await supabase
      .from('invoices')
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
    if (latestInvoice?.invoice_number) {
      const match = latestInvoice.invoice_number.match(/INV-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const invoiceNumber = `INV-${nextNumber.toString().padStart(6, '0')}`;

    // Get tour revenue account
    const { data: revenueAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', '4100') // Tour Revenue
      .single();

    // Calculate tax
    const taxRate = body.tax_rate || 0;
    const subtotal = amount / (1 + taxRate);
    const taxAmount = amount - subtotal;

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        customer_id: booking.customer_id,
        booking_id: bookingId,
        invoice_date: body.invoice_date || new Date().toISOString().split('T')[0],
        due_date: body.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        currency: booking.currency || 'USD',
        exchange_rate: booking.exchange_rate || 1.0,
        subtotal: subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total: amount,
        amount_paid: 0,
        status: 'draft',
        is_advance_payment: isAdvancePayment,
        service_start_date: booking.travel_start_date,
        service_end_date: booking.travel_end_date,
        notes: body.notes || `Generated from booking ${booking.booking_number}`,
        created_by: user.id,
      })
      .select()
      .single();

    if (invoiceError) {
      return NextResponse.json({ error: invoiceError.message }, { status: 400 });
    }

    // Create invoice line
    const { error: lineError } = await supabase
      .from('invoice_lines')
      .insert({
        invoice_id: invoice.id,
        description: description,
        quantity: 1,
        unit_price: subtotal,
        line_total: subtotal,
        revenue_account_id: revenueAccount?.id,
      });

    if (lineError) {
      // Rollback - delete invoice
      await supabase.from('invoices').delete().eq('id', invoice.id);
      return NextResponse.json({ error: lineError.message }, { status: 400 });
    }

    // Update booking status if this is a deposit invoice
    if (invoiceType === 'deposit' && booking.status === 'inquiry') {
      await supabase
        .from('bookings')
        .update({ status: 'quote_sent' })
        .eq('id', bookingId);
    }

    // Fetch complete invoice with lines
    const { data: completeInvoice } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(id, name, email),
        invoice_lines(*)
      `)
      .eq('id', invoice.id)
      .single();

    return NextResponse.json({
      message: 'Invoice generated successfully',
      invoice: completeInvoice,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error generating invoice:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

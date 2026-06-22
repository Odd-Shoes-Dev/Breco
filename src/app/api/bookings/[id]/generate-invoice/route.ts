import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bookings/[id]/generate-invoice - Generate invoice from booking
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await context.params;
    const body = await request.json();

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get booking details
    const bookingRows = await sql`
      SELECT
        b.*,
        json_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'address', c.address, 'city', c.city, 'country', c.country) AS customer,
        json_build_object('id', tp.id, 'name', tp.name, 'package_code', tp.package_code) AS tour_package,
        json_build_object('id', h.id, 'name', h.name, 'star_rating', h.star_rating) AS hotel,
        json_build_object('id', v.id, 'vehicle_type', v.vehicle_type, 'registration_number', v.registration_number) AS vehicle
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN tour_packages tp ON tp.id = b.tour_package_id
      LEFT JOIN hotels h ON h.id = b.hotel_id
      LEFT JOIN vehicles v ON v.id = b.assigned_vehicle_id
      WHERE b.id = ${bookingId}
    `;
    const booking = (bookingRows as any[])[0];
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Check if invoice already exists for this booking
    const existingRows = await sql`SELECT id, invoice_number FROM invoices WHERE booking_id = ${bookingId} LIMIT 1`;
    const existingInvoice = (existingRows as any[])[0];
    if (existingInvoice) {
      return NextResponse.json(
        {
          error: 'Invoice already exists for this booking',
          invoice_id: existingInvoice.id,
          invoice_number: existingInvoice.invoice_number,
        },
        { status: 400 }
      );
    }

    // Determine invoice type and amount
    const invoiceType = body.invoice_type || 'full';
    let amount = Number(booking.total);

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
      case 'custom': {
        const items = [];
        if (booking.hotel) items.push(booking.hotel.name);
        if (booking.vehicle) items.push(booking.vehicle.vehicle_type);
        description = `Custom Booking: ${items.join(' + ')}`;
        break;
      }
      default:
        description = `Booking: ${booking.booking_number}`;
    }

    if (invoiceType === 'deposit') {
      const depositPercent = body.deposit_percent || 30;
      amount = Number(booking.total) * (depositPercent / 100);
      description = `Deposit (${depositPercent}%) - ${description}`;
    } else if (invoiceType === 'balance') {
      amount = Number(booking.total) - (Number(booking.amount_paid) || 0);
      description = `Balance Payment - ${description}`;
    }

    // Generate invoice number
    const latestInvRows = await sql`SELECT invoice_number FROM invoices ORDER BY created_at DESC LIMIT 1`;
    const latestInvoice = (latestInvRows as any[])[0];
    let nextNumber = 1;
    if (latestInvoice?.invoice_number) {
      const match = latestInvoice.invoice_number.match(/INV-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const invoiceNumber = `INV-${nextNumber.toString().padStart(6, '0')}`;

    // Get tour revenue account
    const revenueAcctRows = await sql`SELECT id FROM accounts WHERE code = '4100' LIMIT 1`;
    const revenueAccount = (revenueAcctRows as any[])[0];

    // Calculate tax
    const taxRate = body.tax_rate || 0;
    const subtotal = amount / (1 + taxRate);
    const taxAmount = amount - subtotal;

    const today = new Date().toISOString().split('T')[0];
    const due30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Create invoice
    const invoiceRows = await sql`
      INSERT INTO invoices (
        invoice_number, customer_id, booking_id, invoice_date, due_date,
        currency, exchange_rate, subtotal, tax_rate, tax_amount, total,
        amount_paid, status,
        notes, created_by
      ) VALUES (
        ${invoiceNumber}, ${booking.customer_id}, ${bookingId},
        ${body.invoice_date || today}, ${body.due_date || due30},
        ${booking.currency || 'USD'}, ${booking.exchange_rate || 1.0},
        ${subtotal}, ${taxRate}, ${taxAmount}, ${amount},
        ${0}, ${'draft'},
        ${body.notes || `Generated from booking ${booking.booking_number}`},
        ${user.id}
      )
      RETURNING *
    `;
    const invoice = (invoiceRows as any[])[0];

    // Create invoice line
    try {
      await sql`
        INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, line_total)
        VALUES (${invoice.id}, ${description}, ${1}, ${subtotal}, ${subtotal})
      `;
    } catch (lineErr: any) {
      // Rollback - delete invoice
      await sql`DELETE FROM invoices WHERE id = ${invoice.id}`;
      return NextResponse.json({ error: lineErr.message }, { status: 400 });
    }

    // Update booking status if this is a deposit invoice
    if (invoiceType === 'deposit' && booking.status === 'inquiry') {
      await sql`UPDATE bookings SET status = 'quote_sent' WHERE id = ${bookingId}`;
    }

    // Fetch complete invoice with lines
    const completeRows = await sql`
      SELECT
        i.*,
        json_build_object('id', c.id, 'name', c.name, 'email', c.email) AS customer,
        json_agg(il.*) AS invoice_lines
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN invoice_lines il ON il.invoice_id = i.id
      WHERE i.id = ${invoice.id}
      GROUP BY i.id, c.id
    `;
    const completeInvoice = (completeRows as any[])[0];

    return NextResponse.json({
      message: 'Invoice generated successfully',
      invoice: completeInvoice,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error generating invoice:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

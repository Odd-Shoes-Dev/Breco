import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/receipts/[id] - Get payment details
export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('payments_received')
      .select(`
        *,
        customer:customers(id, name, email, phone, address_line1, city, state, zip_code),
        deposit_account:accounts!payments_received_deposit_to_account_id_fkey(id, name, code, account_type),
        journal_entry:journal_entries(id, entry_number, entry_date),
        payment_applications(
          id,
          amount_applied,
          invoice:invoices(id, invoice_number, invoice_date, total, amount_paid, status)
        )
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/receipts/[id] - Void payment
export async function DELETE(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();

    // Get payment with applications
    const { data: payment, error: fetchError } = await supabase
      .from('payments_received')
      .select(`
        *,
        payment_applications(id, invoice_id, amount_applied)
      `)
      .eq('id', params.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reverse invoice applications
    if (payment.payment_applications && payment.payment_applications.length > 0) {
      for (const app of payment.payment_applications) {
        // Get current invoice state
        const { data: invoice } = await supabase
          .from('invoices')
          .select('amount_paid, total, status')
          .eq('id', app.invoice_id)
          .single();

        if (invoice) {
          const newAmountPaid = Math.max(0, invoice.amount_paid - app.amount_applied);
          let newStatus = invoice.status;

          // Update status based on new amount paid
          if (newAmountPaid === 0) {
            newStatus = 'sent'; // or 'posted' depending on your workflow
          } else if (newAmountPaid < invoice.total) {
            newStatus = 'partial';
          }

          await supabase
            .from('invoices')
            .update({
              amount_paid: newAmountPaid,
              status: newStatus,
            })
            .eq('id', app.invoice_id);
        }
      }

      // Delete payment applications
      await supabase
        .from('payment_applications')
        .delete()
        .eq('payment_id', params.id);
    }

    // Create reversing journal entry
    if (payment.journal_entry_id) {
      const year = new Date().getFullYear();
      const { data: lastEntry } = await supabase
        .from('journal_entries')
        .select('entry_number')
        .like('entry_number', `JE-${year}-%`)
        .order('entry_number', { ascending: false })
        .limit(1)
        .single();

      let nextNumber = 1;
      if (lastEntry?.entry_number) {
        const match = lastEntry.entry_number.match(/JE-\d{4}-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      const entryNumber = `JE-${year}-${nextNumber.toString().padStart(4, '0')}`;

      // Get original journal entry lines to reverse them
      const { data: originalLines } = await supabase
        .from('journal_lines')
        .select('*')
        .eq('journal_entry_id', payment.journal_entry_id);

      if (originalLines && originalLines.length > 0) {
        // Create reversing entry
        const { data: reversingEntry } = await supabase
          .from('journal_entries')
          .insert({
            entry_number: entryNumber,
            entry_date: new Date().toISOString().split('T')[0],
            description: `VOID - Reverse payment ${payment.payment_number}`,
            source_module: 'receipts',
            source_document_id: payment.id,
            status: 'posted',
            created_by: user.id,
            posted_by: user.id,
            posted_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (reversingEntry) {
          // Create reversing lines (swap debits and credits)
          const reversingLines = originalLines.map((line: any, index: number) => ({
            journal_entry_id: reversingEntry.id,
            line_number: index + 1,
            account_id: line.account_id,
            description: `Reverse: ${line.description}`,
            debit: line.credit, // Swap
            credit: line.debit, // Swap
            base_debit: line.base_credit,
            base_credit: line.base_debit,
          }));

          await supabase.from('journal_lines').insert(reversingLines);
        }
      }
    }

    // Delete the payment
    const { error: deleteError } = await supabase
      .from('payments_received')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Payment voided successfully' });
  } catch (error: any) {
    console.error('Error voiding payment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

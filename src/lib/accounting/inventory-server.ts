/**
 * Server-side inventory management functions
 * For use in API routes with server-side Supabase client
 */

import { SupabaseClient } from '@supabase/supabase-js';

interface InventoryUpdateResult {
  success: boolean;
  error?: string;
}

/**
 * Reduce inventory when invoice is posted/sent
 */
export async function reduceInventoryForInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  lines: Array<{
    product_id?: string | null;
    quantity: number;
    description: string;
  }>,
  userId: string
): Promise<InventoryUpdateResult> {
  try {
    for (const line of lines) {
      if (!line.product_id) continue;

      // Get product
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('track_inventory, quantity_on_hand, quantity_reserved, name')
        .eq('id', line.product_id)
        .single();

      if (productError) {
        console.error('Error fetching product:', productError);
        continue;
      }

      if (!product?.track_inventory) continue;

      // Check if enough inventory available
      const available = product.quantity_on_hand - (product.quantity_reserved || 0);
      if (available < line.quantity) {
        return {
          success: false,
          error: `Insufficient inventory for ${product.name}. Available: ${available}, Required: ${line.quantity}`,
        };
      }

      // Reduce inventory
      const { error: updateError } = await supabase
        .from('products')
        .update({
          quantity_on_hand: product.quantity_on_hand - line.quantity,
        })
        .eq('id', line.product_id);

      if (updateError) {
        console.error('Error updating inventory:', updateError);
        return { success: false, error: updateError.message };
      }

      // Record inventory movement
      await supabase.from('inventory_movements').insert({
        product_id: line.product_id,
        movement_type: 'sale',
        quantity: -line.quantity,
        reference_type: 'invoice',
        reference_id: invoiceId,
        notes: line.description,
        created_by: userId,
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in reduceInventoryForInvoice:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reserve inventory for quotation/proforma
 */
export async function reserveInventoryForQuotation(
  supabase: SupabaseClient,
  documentId: string,
  lines: Array<{
    product_id?: string | null;
    quantity: number;
  }>,
  userId: string
): Promise<InventoryUpdateResult> {
  try {
    for (const line of lines) {
      if (!line.product_id) continue;

      const { data: product } = await supabase
        .from('products')
        .select('track_inventory, quantity_on_hand, quantity_reserved, name')
        .eq('id', line.product_id)
        .single();

      if (!product?.track_inventory) continue;

      // Check availability
      const available = product.quantity_on_hand - (product.quantity_reserved || 0);
      if (available < line.quantity) {
        return {
          success: false,
          error: `Insufficient inventory for ${product.name}. Available: ${available}, Required: ${line.quantity}`,
        };
      }

      // Reserve inventory
      await supabase
        .from('products')
        .update({
          quantity_reserved: (product.quantity_reserved || 0) + line.quantity,
        })
        .eq('id', line.product_id);

      // Record reservation movement
      await supabase.from('inventory_movements').insert({
        product_id: line.product_id,
        movement_type: 'reserved',
        quantity: -line.quantity,
        reference_type: 'quotation',
        reference_id: documentId,
        created_by: userId,
      });
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Release reserved inventory when quotation expires/cancelled
 */
export async function releaseReservedInventory(
  supabase: SupabaseClient,
  documentId: string,
  lines: Array<{
    product_id?: string | null;
    quantity: number;
  }>
): Promise<InventoryUpdateResult> {
  try {
    for (const line of lines) {
      if (!line.product_id) continue;

      const { data: product } = await supabase
        .from('products')
        .select('quantity_reserved')
        .eq('id', line.product_id)
        .single();

      if (!product) continue;

      // Release reservation
      await supabase
        .from('products')
        .update({
          quantity_reserved: Math.max(0, (product.quantity_reserved || 0) - line.quantity),
        })
        .eq('id', line.product_id);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Increase inventory when bill is approved
 */
export async function increaseInventoryForBill(
  supabase: SupabaseClient,
  billId: string,
  billDate: string,
  lines: Array<{
    product_id?: string | null;
    quantity: number;
    unit_cost: number;
    line_total: number;
    description: string;
  }>,
  userId: string
): Promise<InventoryUpdateResult> {
  try {
    for (const line of lines) {
      if (!line.product_id) continue;

      // Get product
      const { data: product } = await supabase
        .from('products')
        .select('track_inventory, quantity_on_hand, cost_price')
        .eq('id', line.product_id)
        .single();

      if (!product?.track_inventory) continue;

      // Calculate new weighted average cost
      const newQty = product.quantity_on_hand + line.quantity;
      const newCost =
        newQty > 0
          ? (product.quantity_on_hand * (product.cost_price || 0) + line.quantity * line.unit_cost) / newQty
          : line.unit_cost;

      // Increase inventory
      await supabase
        .from('products')
        .update({
          quantity_on_hand: newQty,
          cost_price: newCost,
        })
        .eq('id', line.product_id);

      // Record inventory movement
      await supabase.from('inventory_movements').insert({
        product_id: line.product_id,
        movement_type: 'purchase',
        quantity: line.quantity,
        unit_cost: line.unit_cost,
        total_cost: line.line_total,
        reference_type: 'bill',
        reference_id: billId,
        notes: line.description,
        created_by: userId,
      });

      // Create inventory lot for FIFO tracking
      await supabase.from('inventory_lots').insert({
        product_id: line.product_id,
        quantity_received: line.quantity,
        quantity_remaining: line.quantity,
        unit_cost: line.unit_cost,
        received_date: billDate,
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in increaseInventoryForBill:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Restore inventory when invoice is voided
 */
export async function restoreInventoryForInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  lines: Array<{
    product_id?: string | null;
    quantity: number;
  }>,
  userId: string
): Promise<InventoryUpdateResult> {
  try {
    for (const line of lines) {
      if (!line.product_id) continue;

      const { data: product } = await supabase
        .from('products')
        .select('track_inventory, quantity_on_hand')
        .eq('id', line.product_id)
        .single();

      if (!product?.track_inventory) continue;

      // Restore inventory
      await supabase
        .from('products')
        .update({
          quantity_on_hand: product.quantity_on_hand + line.quantity,
        })
        .eq('id', line.product_id);

      // Record movement
      await supabase.from('inventory_movements').insert({
        product_id: line.product_id,
        movement_type: 'return',
        quantity: line.quantity,
        reference_type: 'invoice_void',
        reference_id: invoiceId,
        created_by: userId,
      });
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

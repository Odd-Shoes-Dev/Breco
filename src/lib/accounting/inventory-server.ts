/**
 * Server-side inventory management functions
 * For use in API routes with raw SQL
 */

import { sql } from '@/lib/db';

interface InventoryUpdateResult {
  success: boolean;
  error?: string;
}

/**
 * Reduce inventory when invoice is posted/sent
 */
export async function reduceInventoryForInvoice(
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
      const productRows = await sql`
        SELECT track_inventory, name
        FROM products WHERE id = ${line.product_id} LIMIT 1
      `;
      const product = productRows[0];

      if (!product) {
        console.error('Error fetching product:', line.product_id);
        continue;
      }

      if (!product.track_inventory) continue;

      // Record inventory movement
      await sql`
        INSERT INTO inventory_movements (
          product_id, movement_type, quantity, reference_type, reference_id, notes, created_by
        ) VALUES (
          ${line.product_id}, 'sale', ${-line.quantity}, 'invoice', ${invoiceId},
          ${line.description}, ${userId}
        )
      `;
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

      const productRows = await sql`
        SELECT track_inventory, name
        FROM products WHERE id = ${line.product_id} LIMIT 1
      `;
      const product = productRows[0];

      if (!product?.track_inventory) continue;

      // Record reservation movement
      await sql`
        INSERT INTO inventory_movements (
          product_id, movement_type, quantity, reference_type, reference_id, created_by
        ) VALUES (
          ${line.product_id}, 'reserved', ${-line.quantity}, 'quotation', ${documentId}, ${userId}
        )
      `;
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
  documentId: string,
  lines: Array<{
    product_id?: string | null;
    quantity: number;
  }>
): Promise<InventoryUpdateResult> {
  try {
    for (const line of lines) {
      if (!line.product_id) continue;

      // Release reservation - record movement
      await sql`
        INSERT INTO inventory_movements (
          product_id, movement_type, quantity, reference_type, reference_id, created_by
        ) VALUES (
          ${line.product_id}, 'release', ${line.quantity}, 'quotation_cancel', ${documentId}, 'system'
        )
      `;
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
      const productRows = await sql`
        SELECT track_inventory
        FROM products WHERE id = ${line.product_id} LIMIT 1
      `;
      const product = productRows[0];

      if (!product?.track_inventory) continue;

      // Record inventory movement
      await sql`
        INSERT INTO inventory_movements (
          product_id, movement_type, quantity, unit_cost, total_cost,
          reference_type, reference_id, notes, created_by
        ) VALUES (
          ${line.product_id}, 'purchase', ${line.quantity}, ${line.unit_cost}, ${line.line_total},
          'bill', ${billId}, ${line.description}, ${userId}
        )
      `;

      // Create inventory lot for FIFO tracking
      await sql`
        INSERT INTO inventory_lots (
          product_id, quantity_received, quantity_remaining, unit_cost, received_date
        ) VALUES (
          ${line.product_id}, ${line.quantity}, ${line.quantity}, ${line.unit_cost}, ${billDate}
        )
      `;
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

      const productRows = await sql`
        SELECT track_inventory FROM products WHERE id = ${line.product_id} LIMIT 1
      `;
      const product = productRows[0];

      if (!product?.track_inventory) continue;

      // Record movement
      await sql`
        INSERT INTO inventory_movements (
          product_id, movement_type, quantity, reference_type, reference_id, created_by
        ) VALUES (
          ${line.product_id}, 'return', ${line.quantity}, 'invoice_void', ${invoiceId}, ${userId}
        )
      `;
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

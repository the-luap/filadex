/**
 * Batch operation utilities
 */

import { validateIds } from './validation';

export interface BatchResult<T> {
  success: T[];
  failed: Array<{ id: number; error: string }>;
  total: number;
}

/**
 * The most spools one batch request may name. A caller used to be able to
 * repeat one owned id ten thousand times in a 20 KB body; every occurrence ran
 * its own SELECT, UPDATE and SELECT, so the request budget was bytes rather
 * than database work. Deduplicating is what removes the amplification - the
 * ceiling is here so that a collection larger than any real one cannot be
 * driven in a single request either.
 */
export const MAX_BATCH_IDS = 1000;

/**
 * Validates batch IDs from request, keeping each id once
 * @param ids - The IDs to validate (from request body)
 * @returns Array of unique validated IDs as numbers, in first-seen order
 */
export function validateBatchIds(ids: unknown[]): number[] {
  return Array.from(new Set(validateIds(ids)));
}

/**
 * Processes a batch operation on multiple IDs
 * @param ids - Array of IDs to process
 * @param operation - The operation to perform on each ID
 * @returns Batch result with success and failed items
 */
export async function processBatchOperation<T>(
  ids: number[],
  operation: (id: number) => Promise<T>
): Promise<BatchResult<T>> {
  const result: BatchResult<T> = {
    success: [],
    failed: [],
    total: ids.length
  };

  for (const id of ids) {
    try {
      const item = await operation(id);
      result.success.push(item);
    } catch (error) {
      result.failed.push({
        id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return result;
}


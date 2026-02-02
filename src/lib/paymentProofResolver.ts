/**
 * paymentProofResolver.ts - Payment Proof File Resolution Utility
 * 
 * Resolves payment proof URLs from Supabase Storage when the database
 * record might be missing or outdated. This handles edge cases where:
 * 
 * 1. Payment proof was uploaded but database update failed (network issues)
 * 2. Multiple files exist for the same application (re-uploads)
 * 3. Group registrations share a combined payment proof
 * 
 * File Naming Convention:
 * - Individual: {applicationId}-{timestamp}.{ext}
 * - Combined: combined-{applicationId}-{timestamp}.{ext}
 * 
 * Resolution Strategy:
 * 1. Try server-side search with applicationId prefix
 * 2. Try search with "combined-" prefix for group proofs
 * 3. Fall back to paginated bucket scan if search fails
 * 4. Return the most recently uploaded matching file
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Storage file metadata type
 * Matches Supabase Storage API response structure
 */
type StorageFile = {
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * Extracts a timestamp from file metadata for sorting
 * Prefers updated_at, falls back to created_at
 * 
 * @param f - Storage file object
 * @returns Timestamp in milliseconds, or 0 if no valid date
 */
const getFileTime = (f: StorageFile) => {
  const t = f.updated_at || f.created_at;
  const ms = t ? new Date(t).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
};

/**
 * Resolves the latest payment proof URL for a given application ID
 * 
 * This function performs a multi-strategy search to find payment proof files:
 * 
 * Strategy 1: Server-side search with applicationId
 * - Fast but may miss files if storage search is not indexed
 * 
 * Strategy 2: Search with "combined-" prefix
 * - Catches group registration combined proofs
 * 
 * Strategy 3: Paginated bucket scan
 * - Comprehensive but slower
 * - Only used if strategies 1-2 find nothing
 * 
 * @param applicationId - The application ID to search for
 * @param opts - Optional configuration
 * @param opts.bucket - Storage bucket name (default: 'payment-proofs')
 * @param opts.pageSize - Number of files per page (default: 200, max: 1000)
 * @param opts.maxPages - Maximum pages to scan (default: 20, max: 50)
 * @returns Public URL of the most recent matching file, or null if not found
 * 
 * @example
 * ```ts
 * const url = await resolveLatestPaymentProofUrlFromStorage('ALM-ABC123-XYZ');
 * if (url) {
 *   await updateRegistration(appId, { payment_proof_url: url });
 * }
 * ```
 */
export async function resolveLatestPaymentProofUrlFromStorage(
  applicationId: string,
  opts?: {
    bucket?: string;
    pageSize?: number;
    maxPages?: number;
  }
): Promise<string | null> {
  // Configuration with defaults and bounds
  const bucket = opts?.bucket ?? "payment-proofs";
  const pageSize = Math.min(Math.max(opts?.pageSize ?? 200, 50), 1000);
  const maxPages = Math.min(Math.max(opts?.maxPages ?? 20, 1), 50);

  /**
   * Checks if a filename matches our naming convention for this application
   * Matches: {appId}-*.* or combined-{appId}-*.*
   */
  const isMatch = (name: string) =>
    name.startsWith(`${applicationId}-`) || name.startsWith(`combined-${applicationId}-`);

  try {
    // Collect ALL matching files across all search strategies
    const allMatches: StorageFile[] = [];

    // Strategy 1: Server-side search with applicationId prefix
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list("", { limit: 100, search: applicationId });

      if (!error && data?.length) {
        for (const f of data as StorageFile[]) {
          if (isMatch(f.name)) allMatches.push(f);
        }
      }
    } catch {
      // Ignore and continue to next strategy
    }

    // Strategy 2: Search with "combined-" prefix for group registrations
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list("", { limit: 100, search: `combined-${applicationId}` });

      if (!error && data?.length) {
        for (const f of data as StorageFile[]) {
          // Avoid duplicates - only add if not already matched
          if (isMatch(f.name) && !allMatches.some(m => m.name === f.name)) {
            allMatches.push(f);
          }
        }
      }
    } catch {
      // Ignore and continue to next strategy
    }

    // Strategy 3: Full paginated scan (only if nothing found yet)
    // This is comprehensive but slower
    if (allMatches.length === 0) {
      for (let page = 0; page < maxPages; page++) {
        const { data, error } = await supabase.storage
          .from(bucket)
          .list("", { limit: pageSize, offset: page * pageSize });

        if (error) {
          console.error(`Storage list page ${page} error:`, error);
          break;
        }
        
        const files = (data ?? []) as StorageFile[];
        if (files.length === 0) break; // No more files

        // Check each file for a match
        for (const f of files) {
          if (isMatch(f.name) && !allMatches.some(m => m.name === f.name)) {
            allMatches.push(f);
          }
        }

        // If we got fewer than a full page, we've reached the end
        if (files.length < pageSize) break;
      }
    }

    // No matches found after all strategies
    if (allMatches.length === 0) {
      console.log(`No payment proof found for ${applicationId} after scanning storage`);
      return null;
    }

    // Sort by newest first and pick the most recent file
    allMatches.sort((a, b) => getFileTime(b) - getFileTime(a));
    const best = allMatches[0];
    
    console.log(`Found ${allMatches.length} proof(s) for ${applicationId}, using: ${best.name}`);
    
    // Get the public URL for the file
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(best.name);
    return publicData.publicUrl ?? null;
  } catch (err) {
    console.error("Failed to resolve payment proof from storage:", err);
    return null;
  }
}

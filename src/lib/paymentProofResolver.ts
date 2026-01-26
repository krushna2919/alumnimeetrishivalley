import { supabase } from "@/integrations/supabase/client";

type StorageFile = {
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
};

const getFileTime = (f: StorageFile) => {
  const t = f.updated_at || f.created_at;
  const ms = t ? new Date(t).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
};

/**
 * Attempts to find the latest payment proof file for an application id.
 *
 * Why pagination: storage.list() returns paginated results. If there are many files in the bucket,
 * a single page (limit 50) can miss the file even if it exists.
 */
export async function resolveLatestPaymentProofUrlFromStorage(
  applicationId: string,
  opts?: {
    bucket?: string;
    pageSize?: number;
    maxPages?: number;
  }
): Promise<string | null> {
  const bucket = opts?.bucket ?? "payment-proofs";
  const pageSize = Math.min(Math.max(opts?.pageSize ?? 200, 50), 1000);
  const maxPages = Math.min(Math.max(opts?.maxPages ?? 20, 1), 50);

  const isMatch = (name: string) =>
    name.startsWith(`${applicationId}-`) || name.startsWith(`combined-${applicationId}-`);

  try {
    // Collect ALL matching files across all pages, then pick the newest
    const allMatches: StorageFile[] = [];

    // 1) Try server-side search first (can help narrow down)
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
      // ignore and fall back to paginated scan
    }

    // 2) Also try search with "combined-" prefix
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list("", { limit: 100, search: `combined-${applicationId}` });

      if (!error && data?.length) {
        for (const f of data as StorageFile[]) {
          if (isMatch(f.name) && !allMatches.some(m => m.name === f.name)) {
            allMatches.push(f);
          }
        }
      }
    } catch {
      // ignore
    }

    // 3) If still no matches, do a full paginated scan
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
        if (files.length === 0) break;

        for (const f of files) {
          if (isMatch(f.name) && !allMatches.some(m => m.name === f.name)) {
            allMatches.push(f);
          }
        }

        // If we got fewer than a full page, we've reached the end.
        if (files.length < pageSize) break;
      }
    }

    if (allMatches.length === 0) {
      console.log(`No payment proof found for ${applicationId} after scanning storage`);
      return null;
    }

    // Sort by newest first and pick the best
    allMatches.sort((a, b) => getFileTime(b) - getFileTime(a));
    const best = allMatches[0];
    
    console.log(`Found ${allMatches.length} proof(s) for ${applicationId}, using: ${best.name}`);
    
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(best.name);
    return publicData.publicUrl ?? null;
  } catch (err) {
    console.error("Failed to resolve payment proof from storage:", err);
    return null;
  }
}

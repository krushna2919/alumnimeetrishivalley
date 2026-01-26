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
  const maxPages = Math.min(Math.max(opts?.maxPages ?? 10, 1), 50);

  const isMatch = (name: string) =>
    name.startsWith(`${applicationId}-`) || name.startsWith(`combined-${applicationId}-`);

  try {
    // 1) Fast path: try server-side search first (if supported / effective)
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list("", { limit: 50, search: applicationId });

      if (!error && data?.length) {
        const matches = (data as StorageFile[])
          .filter((f) => isMatch(f.name))
          .sort((a, b) => getFileTime(b) - getFileTime(a));

        const latest = matches[0];
        if (latest) {
          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(latest.name);
          return publicData.publicUrl ?? null;
        }
      }
    } catch {
      // ignore and fall back to paginated scan
    }

    // 2) Robust path: paginated scan
    let best: StorageFile | null = null;
    for (let page = 0; page < maxPages; page++) {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await supabase.storage
        .from(bucket)
        .list("", { limit: pageSize, offset: page * pageSize });

      if (error) throw error;
      const files = (data ?? []) as StorageFile[];
      if (files.length === 0) break;

      for (const f of files) {
        if (!isMatch(f.name)) continue;
        if (!best || getFileTime(f) > getFileTime(best)) best = f;
      }

      // If we got fewer than a full page, we've reached the end.
      if (files.length < pageSize) break;
    }

    if (!best) return null;
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(best.name);
    return publicData.publicUrl ?? null;
  } catch (err) {
    console.error("Failed to resolve payment proof from storage:", err);
    return null;
  }
}

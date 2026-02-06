import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ReceiptItem = {
  path: string;
  url: string;
  created_at?: string | null;
  bucket: string;
};

async function listAllMatches(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  bucket: string;
  prefixes: string[];
  applicationId: string;
}): Promise<ReceiptItem[]> {
  const { supabaseAdmin, bucket, prefixes, applicationId } = params;

  const isMatch = (fullPath: string) => {
    const n = fullPath.toLowerCase();
    const id = applicationId.toLowerCase();
    return (
      n.startsWith(`receipt-${id}-`) ||
      n.includes(`/receipt-${id}-`) ||
      n.includes(`/${id}/`) ||
      n.includes(`receipt-${id}-`)
    );
  };

  const out: ReceiptItem[] = [];
  const seen = new Set<string>();

  const add = (fullPath: string, created_at?: string | null) => {
    if (!fullPath) return;
    const key = `${bucket}:${fullPath}`;
    if (seen.has(key)) return;
    if (!isMatch(fullPath)) return;
    seen.add(key);

    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(fullPath);
    if (!data?.publicUrl) return;
    out.push({ path: fullPath, url: data.publicUrl, created_at, bucket });
  };

  // Use both search (fast) and paged listing (fallback)
  for (const prefix of prefixes) {
    // Search first
    {
      const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, {
        limit: 1000,
        search: applicationId,
      });
      if (!error && data) {
        for (const f of data as any[]) {
          const fullPath = prefix ? `${prefix}/${f.name}` : f.name;
          add(fullPath, f.created_at ?? null);
        }
      }
    }

    // If search is empty (or misses), do a bounded scan
    if (out.length === 0) {
      const pageSize = 200;
      const maxPages = 25;
      for (let page = 0; page < maxPages; page++) {
        const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, {
          limit: pageSize,
          offset: page * pageSize,
        });
        if (error || !data || data.length === 0) break;
        for (const f of data as any[]) {
          const fullPath = prefix ? `${prefix}/${f.name}` : f.name;
          add(fullPath, f.created_at ?? null);
        }
        if (data.length < pageSize) break;
      }
    }
  }

  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { applicationId } = await req.json().catch(() => ({}));
    if (!applicationId || typeof applicationId !== "string") {
      return new Response(JSON.stringify({ error: "Missing applicationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const backendUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(backendUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) {
      return new Response(JSON.stringify({ error: "Invalid authorization token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Require registration-manager permissions
    const { data: ok, error: roleErr } = await supabaseAdmin.rpc("is_registration_manager", {
      _user_id: caller.id,
    });

    if (roleErr || !ok) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // We intentionally scan BOTH buckets:
    // - payment-receipts: current bucket
    // - payment-proofs: legacy bucket where some deployments accidentally stored receipt PDFs
    const commonPrefixes = [
      "",
      "payment-receipts",
      applicationId,
      `payment-receipts/${applicationId}`,
    ];

    const [inReceipts, inProofs] = await Promise.all([
      listAllMatches({
        supabaseAdmin,
        bucket: "payment-receipts",
        prefixes: commonPrefixes,
        applicationId,
      }),
      listAllMatches({
        supabaseAdmin,
        bucket: "payment-proofs",
        prefixes: commonPrefixes,
        applicationId,
      }),
    ]);

    const receipts = [...inReceipts, ...inProofs]
      // Sort newest first when possible
      .sort((a, b) => {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (at !== bt) return bt - at;
        // Put current bucket first for ties
        if (a.bucket !== b.bucket) return a.bucket === "payment-receipts" ? -1 : 1;
        return b.path.localeCompare(a.path);
      });

    return new Response(JSON.stringify({ receipts }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

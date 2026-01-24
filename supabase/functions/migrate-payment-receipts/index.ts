import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MigrateResult = {
  scanned: number;
  copied: number;
  deletedFromOld: number;
  dbUpdated: number;
  sampleNames: string[];
  errors: Array<{ file: string; step: string; message: string }>;
};

function extractApplicationIdFromReceiptFilename(name: string): string | null {
  // Expected: receipt-<application_id>-<timestamp>.pdf
  if (!name.startsWith("receipt-")) return null;
  const parts = name.split("-");
  // receipt, ALM, XXXXX, XXXX.pdf? => applicationId itself contains dashes (ALM-XXXX-YYYY)
  // So we find the last '-' before the timestamp by taking everything between 'receipt-' and the last '-'.
  const withoutPrefix = name.slice("receipt-".length);
  const lastDash = withoutPrefix.lastIndexOf("-");
  if (lastDash <= 0) return null;
  return withoutPrefix.slice(0, lastDash);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller and permissions
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) {
      return new Response(JSON.stringify({ error: "Invalid authorization token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isSuperadmin, error: roleErr } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "superadmin",
    });

    if (roleErr || !isSuperadmin) {
      return new Response(JSON.stringify({ error: "Only superadmins can run this migration" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Paginate through old bucket and move receipt files.
    // Some deployments stored receipts under a folder inside the old bucket.
    const result: MigrateResult = {
      scanned: 0,
      copied: 0,
      deletedFromOld: 0,
      dbUpdated: 0,
      sampleNames: [],
      errors: [],
    };

    // We keep a conservative batch size to avoid timeouts.
    const pageSize = 200;
    const prefixes = ["", "payment-receipts"];

    for (const prefix of prefixes) {
      let offset = 0;
      while (true) {
        const { data: files, error: listErr } = await supabaseAdmin.storage
          .from("payment-proofs")
          .list(prefix, { limit: pageSize, offset });

        if (listErr) throw listErr;
        if (!files || files.length === 0) break;

        result.scanned += files.length;

        for (const f of files) {
          if (result.sampleNames.length >= 30) break;
          const full = prefix ? `${prefix}/${f.name}` : f.name;
          result.sampleNames.push(full);
        }

        const receipts = files.filter((f) => {
          const name = (f?.name ?? "").toLowerCase();
          return (
            name.startsWith("receipt-") ||
            (name.includes("receipt") && name.endsWith(".pdf"))
          );
        });

        for (const f of receipts) {
          const fileName = f.name;
          const oldPath = prefix ? `${prefix}/${fileName}` : fileName;
          const newPath = fileName; // keep flat in the new bucket

        // Cross-bucket move: download+upload (then delete old)
        try {
          const { data: blob, error: dlErr } = await supabaseAdmin.storage
            .from("payment-proofs")
            .download(oldPath);
          if (dlErr) throw dlErr;

          const { error: upErr } = await supabaseAdmin.storage
            .from("payment-receipts")
            .upload(newPath, blob, { upsert: true, contentType: "application/pdf" });
          if (upErr) throw upErr;
          result.copied++;

          const { error: rmErr } = await supabaseAdmin.storage.from("payment-proofs").remove([oldPath]);
          if (!rmErr) result.deletedFromOld++;
        } catch (e) {
          result.errors.push({
            file: oldPath,
            step: "download/upload/remove",
            message: (e as Error)?.message ?? String(e),
          });
          continue;
        }

        // Update DB URLs for any registrations referencing this receipt
        const applicationId = extractApplicationIdFromReceiptFilename(newPath);
        const { data: publicData } = supabaseAdmin.storage.from("payment-receipts").getPublicUrl(newPath);
        const newUrl = publicData?.publicUrl ?? null;

        if (applicationId && newUrl) {
          const { error: updErr } = await supabaseAdmin
            .from("registrations")
            .update({ payment_receipt_url: newUrl, updated_at: new Date().toISOString() })
            .ilike("payment_receipt_url", `%${newPath}%`);

          if (updErr) {
            result.errors.push({ file: newPath, step: "db_update", message: updErr.message });
          } else {
            // Keep a best-effort counter; exact count isn't critical here.
            result.dbUpdated++;
          }
        }
        }

        offset += pageSize;
      }
    }

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error)?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);

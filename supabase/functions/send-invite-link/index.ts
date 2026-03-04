import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const fromEmail = Deno.env.get("RESEND_FROM") || "noreply@alumnimeetrishivalley.org";

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: isAdmin } = await supabaseAdmin.rpc("is_admin_or_superadmin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, inviteId } = await req.json();

    if (!email || !inviteId) {
      return new Response(JSON.stringify({ error: "Email and inviteId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the invite to get the token
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("registration_invites")
      .select("token, expires_at")
      .eq("id", inviteId)
      .single();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Invite not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the registration link
    const siteUrl = "https://alumnimeetrishivalley.lovable.app";
    const registrationLink = `${siteUrl}/invite/${invite.token}`;
    const expiresAt = new Date(invite.expires_at);
    const expiresFormatted = expiresAt.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "long",
      timeStyle: "short",
    });

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "You're Invited to Register – Rishi Valley Alumni Meet 2026",
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px;">Rishi Valley Alumni Meet 2026</h1>
            <p style="color: #444; font-size: 16px; line-height: 1.6;">
              Dear Alumni,
            </p>
            <p style="color: #444; font-size: 16px; line-height: 1.6;">
              You have been invited to register for the Rishi Valley Alumni Meet 2026. 
              Please use the link below to complete your registration.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${registrationLink}" 
                 style="background-color: #1a1a1a; color: #ffffff; padding: 14px 28px; 
                        text-decoration: none; border-radius: 8px; font-size: 16px; display: inline-block;">
                Complete Registration
              </a>
            </div>
            <p style="color: #888; font-size: 14px; line-height: 1.6;">
              ⏰ <strong>This link expires on ${expiresFormatted} IST.</strong> 
              Please complete your registration before the link expires.
            </p>
            <p style="color: #888; font-size: 14px; line-height: 1.6;">
              If the button doesn't work, copy and paste this URL into your browser:<br/>
              <a href="${registrationLink}" style="color: #666;">${registrationLink}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #aaa; font-size: 12px;">
              Rishi Valley Alumni Meet 2026 · This is an automated invitation.
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

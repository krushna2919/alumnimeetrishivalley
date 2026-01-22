import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "onboarding@resend.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  registrationFee: number;
  verifiedAt: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-accounts-notification function called");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with the user's auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify the user has accounts_admin role
    const { data: isAccountsAdmin, error: roleError } = await supabaseClient.rpc('is_accounts_admin', { 
      _user_id: user.id 
    });

    if (roleError) {
      console.error("Role check error:", roleError.message);
      return new Response(
        JSON.stringify({ success: false, error: "Error checking user role" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!isAccountsAdmin) {
      console.error(`User ${user.id} is not an accounts admin`);
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: Accounts admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { applicationId, applicantName, applicantEmail, registrationFee, verifiedAt }: NotificationRequest = await req.json();
    
    // Validate required fields
    if (!applicationId || !applicantName) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending payment verified notification for application ${applicationId}`);

    const subject = `Payment Verified - ${applicationId}`;
    const htmlContent = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2e7d32; border-bottom: 2px solid #b8860b; padding-bottom: 10px;">
          💰 Payment Verified by Accounts
        </h1>
        <p>A payment has been verified by the Accounts Admin and is ready for final approval.</p>
        <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2e7d32;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Application ID:</td>
              <td style="padding: 8px 0; font-weight: bold; font-family: monospace; color: #2e7d32;">${applicationId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Applicant Name:</td>
              <td style="padding: 8px 0; font-weight: bold;">${applicantName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Email:</td>
              <td style="padding: 8px 0;">${applicantEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Registration Fee:</td>
              <td style="padding: 8px 0;">₹${registrationFee}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Verified At:</td>
              <td style="padding: 8px 0;">${new Date(verifiedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
            </tr>
          </table>
        </div>
        <p style="color: #666; font-size: 14px;">
          This registration is now awaiting final approval by an Admin.
        </p>
        <p style="margin-top: 30px; color: #999; font-size: 12px;">
          This is an automated notification from the Alumni Meet Registration System.
        </p>
      </div>
    `;

    // Send email only to superuser
    const emailPayload = {
      from: `Rishi Valley Alumni Meet <${RESEND_FROM}>`,
      to: ["superuseralumnimeet@rishivalley.org"],
      subject: subject,
      html: htmlContent,
    };

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend error:", errorData);
      // Don't fail the request - just log the error
      return new Response(
        JSON.stringify({ success: false, error: `Email error: ${JSON.stringify(errorData)}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const result = await emailResponse.json();
    console.log("Notification email sent successfully:", result);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to send notification" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

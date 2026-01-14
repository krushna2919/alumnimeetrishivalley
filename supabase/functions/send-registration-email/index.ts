import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAILJS_SERVICE_ID = Deno.env.get("EMAILJS_SERVICE_ID");
const EMAILJS_PUBLIC_KEY = Deno.env.get("EMAILJS_PUBLIC_KEY");
const EMAILJS_TEMPLATE_ID_APPROVED = Deno.env.get("EMAILJS_TEMPLATE_ID_APPROVED");
const EMAILJS_TEMPLATE_ID_REJECTED = Deno.env.get("EMAILJS_TEMPLATE_ID_REJECTED");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  name: string;
  applicationId: string;
  type: "approved" | "rejected";
  rejectionReason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-registration-email function called");
  
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
        JSON.stringify({ success: false, error: "Unauthorized: No authorization header" }),
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
        JSON.stringify({ success: false, error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    // Verify the user has admin or superadmin role
    const { data: isAdmin, error: roleError } = await supabaseClient.rpc('is_admin_or_superadmin', { 
      _user_id: user.id 
    });

    if (roleError) {
      console.error("Role check error:", roleError.message);
      return new Response(
        JSON.stringify({ success: false, error: "Error checking user role" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!isAdmin) {
      console.error(`User ${user.id} is not an admin`);
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: Admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Admin access verified for user: ${user.id}`);

    const { to, name, applicationId, type, rejectionReason }: EmailRequest = await req.json();
    
    // Validate required fields
    if (!to || !name || !applicationId || !type) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: to, name, applicationId, type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate type
    if (type !== 'approved' && type !== 'rejected') {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid type: must be 'approved' or 'rejected'" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify the application exists and the email matches
    const { data: registration, error: regError } = await supabaseClient
      .from('registrations')
      .select('email, application_id')
      .eq('application_id', applicationId)
      .single();

    if (regError || !registration) {
      console.error("Registration lookup error:", regError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Application not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (registration.email !== to) {
      console.error(`Email mismatch: expected ${registration.email}, got ${to}`);
      return new Response(
        JSON.stringify({ success: false, error: "Email does not match registration" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending ${type} email to ${to} for application ${applicationId}`);

    // Select the appropriate template based on type
    const templateId = type === "approved" ? EMAILJS_TEMPLATE_ID_APPROVED : EMAILJS_TEMPLATE_ID_REJECTED;

    // Prepare template parameters
    const templateParams: Record<string, string> = {
      to_email: to,
      to_name: name,
      application_id: applicationId,
    };

    // Add rejection reason if provided and type is rejected
    if (type === "rejected" && rejectionReason) {
      templateParams.rejection_reason = rejectionReason.slice(0, 500);
    }

    // Send email via EmailJS API
    const emailjsResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: templateParams,
      }),
    });

    if (!emailjsResponse.ok) {
      const errorText = await emailjsResponse.text();
      console.error("EmailJS error:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: `EmailJS error: ${errorText}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully via EmailJS");

    return new Response(JSON.stringify({ success: true, message: "Email sent successfully" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to send email" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

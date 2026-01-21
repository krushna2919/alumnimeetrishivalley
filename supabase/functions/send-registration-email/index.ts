import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "onboarding@resend.dev";

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
  paymentReceiptUrl?: string;
}

// Helper function to fetch PDF and convert to base64
async function fetchPdfAsBase64(url: string): Promise<{ content: string; filename: string } | null> {
  try {
    console.log(`Fetching PDF from: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    
    // Extract filename from URL
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1] || 'payment-receipt.pdf';
    
    console.log(`Successfully fetched PDF, size: ${uint8Array.length} bytes`);
    return { content: base64, filename };
  } catch (error) {
    console.error('Error fetching PDF:', error);
    return null;
  }
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

    const { to, name, applicationId, type, rejectionReason, paymentReceiptUrl }: EmailRequest = await req.json();
    
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

    // Verify the application exists and get registration details including receipt
    const { data: registration, error: regError } = await supabaseClient
      .from('registrations')
      .select('email, application_id, payment_receipt_url')
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

    // Use the receipt URL from the request or from the database
    const receiptUrl = paymentReceiptUrl || registration.payment_receipt_url;

    console.log(`Sending ${type} email to ${to} for application ${applicationId}`);

    // Build email content based on type
    let subject: string;
    let htmlContent: string;

    if (type === "approved") {
      subject = `Registration Approved - Application ID: ${applicationId}`;
      htmlContent = `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2e7d32; border-bottom: 2px solid #b8860b; padding-bottom: 10px;">
            🎉 Registration Approved!
          </h1>
          <p>Dear ${name},</p>
          <p>We are pleased to inform you that your registration for the <strong>Rishi Valley Alumni Meet</strong> has been approved!</p>
          <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2e7d32;">
            <p style="margin: 0; font-size: 14px; color: #666;">Your Application ID:</p>
            <p style="margin: 10px 0 0; font-size: 24px; font-weight: bold; color: #2e7d32; font-family: monospace;">
              ${applicationId}
            </p>
          </div>
          ${receiptUrl ? `
          <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f57c00;">
            <p style="margin: 0; font-size: 14px; color: #666;">📄 Payment Receipt:</p>
            <p style="margin: 10px 0 0; color: #333;">
              Your payment receipt is attached to this email.
            </p>
          </div>
          ` : ''}
          <p>We look forward to seeing you at the event!</p>
          <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>Rishi Valley Alumni Meet Organizing Committee</strong>
          </p>
        </div>
      `;
    } else {
      subject = `Registration Update - Application ID: ${applicationId}`;
      htmlContent = `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #c62828; border-bottom: 2px solid #b8860b; padding-bottom: 10px;">
            Registration Update
          </h1>
          <p>Dear ${name},</p>
          <p>We regret to inform you that your registration for the <strong>Rishi Valley Alumni Meet</strong> could not be approved at this time.</p>
          <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #c62828;">
            <p style="margin: 0; font-size: 14px; color: #666;">Application ID:</p>
            <p style="margin: 10px 0 0; font-size: 18px; font-weight: bold; color: #c62828; font-family: monospace;">
              ${applicationId}
            </p>
            ${rejectionReason ? `
              <p style="margin: 15px 0 0; font-size: 14px; color: #666;">Reason:</p>
              <p style="margin: 5px 0 0; color: #333;">${rejectionReason}</p>
            ` : ''}
          </div>
          <p>If you believe this was in error or have questions, please contact the organizing committee.</p>
          <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>Rishi Valley Alumni Meet Organizing Committee</strong>
          </p>
        </div>
      `;
    }

    // BCC for superuser on all emails
    const bccEmail = "superuseralumnimeet@rishivalley.org";

    // Prepare attachments for approved emails with PDF receipt
    const attachments: Array<{ filename: string; content: string }> = [];
    
    if (type === "approved" && receiptUrl && receiptUrl.toLowerCase().endsWith('.pdf')) {
      console.log("Fetching PDF receipt for attachment...");
      const pdfData = await fetchPdfAsBase64(receiptUrl);
      if (pdfData) {
        attachments.push({
          filename: `Payment-Receipt-${applicationId}.pdf`,
          content: pdfData.content,
        });
        console.log("PDF attachment prepared successfully");
      } else {
        console.warn("Failed to fetch PDF, email will be sent without attachment");
      }
    }

    // Send email via Resend API
    const emailPayload: Record<string, unknown> = {
      from: `Rishi Valley Alumni Meet <${RESEND_FROM}>`,
      to: [to],
      bcc: [bccEmail],
      subject: subject,
      html: htmlContent,
    };

    // Add attachments if any
    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

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
      return new Response(
        JSON.stringify({ success: false, error: `Email error: ${JSON.stringify(errorData)}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const result = await emailResponse.json();
    console.log("Email sent successfully via Resend:", result);

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

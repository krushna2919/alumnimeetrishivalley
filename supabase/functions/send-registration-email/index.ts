import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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
    const { to, name, applicationId, type, rejectionReason }: EmailRequest = await req.json();
    
    console.log(`Sending ${type} email to ${to} for application ${applicationId}`);

    let subject: string;
    let htmlContent: string;

    if (type === "approved") {
      subject = "🎉 Your Alumni Meet 2026 Registration is Approved!";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #b85c38 0%, #2d5a4a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Rishi Valley School</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Alumni Meet 2026</p>
          </div>
          
          <div style="background: #faf7f5; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e8e0d8; border-top: none;">
            <h2 style="color: #2d5a4a; margin-top: 0;">Dear ${name},</h2>
            
            <p style="font-size: 16px;">We are delighted to inform you that your registration for the <strong>Alumni Meet 2026</strong> has been <span style="color: #2d5a4a; font-weight: bold;">approved</span>!</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2d5a4a;">
              <p style="margin: 0;"><strong>Application ID:</strong> ${applicationId}</p>
              <p style="margin: 10px 0 0 0;"><strong>Event Date:</strong> 30 & 31 October 2026</p>
            </div>
            
            <p>We look forward to seeing you at the campus and reliving those cherished memories together.</p>
            
            <p style="margin-top: 30px;">Warm regards,<br><strong>Alumni Meet Organizing Committee</strong><br>Rishi Valley School</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </body>
        </html>
      `;
    } else {
      subject = "Update on Your Alumni Meet 2026 Registration";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #b85c38 0%, #2d5a4a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Rishi Valley School</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Alumni Meet 2026</p>
          </div>
          
          <div style="background: #faf7f5; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e8e0d8; border-top: none;">
            <h2 style="color: #b85c38; margin-top: 0;">Dear ${name},</h2>
            
            <p style="font-size: 16px;">Thank you for your interest in the Alumni Meet 2026. Unfortunately, we are unable to approve your registration at this time.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #b85c38;">
              <p style="margin: 0;"><strong>Application ID:</strong> ${applicationId}</p>
              ${rejectionReason ? `<p style="margin: 10px 0 0 0;"><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
            </div>
            
            <p>If you believe this is an error or have any questions, please contact the organizing committee.</p>
            
            <p style="margin-top: 30px;">Warm regards,<br><strong>Alumni Meet Organizing Committee</strong><br>Rishi Valley School</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </body>
        </html>
      `;
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Alumni Meet <centenaryalumnimeet@rishivalley.org>",
        to: [to],
        subject: subject,
        html: htmlContent,
      }),
    });

    const emailData = await emailResponse.json();

    console.log("Email sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true, data: emailData }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

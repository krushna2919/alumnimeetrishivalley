import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "onboarding@resend.dev";

interface AttendeeInfo {
  name: string;
  email: string; // Primary registrant's email (always set)
  secondaryEmail?: string; // Optional secondary email for individual confirmation
  phone: string;
  occupation: string;
  boardType: string;
  yearOfPassing: number;
  stayType: string;
  tshirtSize: string;
  gender: string;
  registrationFee: number;
}

interface BotValidation {
  honeypot: string;
  formLoadTime: number;
  submitTime: number;
}

interface RegistrationRequest {
  botValidation: BotValidation;
  paymentProof?: {
    base64: string;
    name: string;
    type: string;
    size?: number;
  };
  inviteToken?: string;
  // Main registrant info
  name: string;
  email: string;
  phone: string;
  occupation: string;
  boardType: string;
  yearOfPassing: number;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  district: string;
  state: string;
  postalCode: string;
  country: string;
  stayType: string;
  tshirtSize: string;
  gender: string;
  registrationFee: number;
  // Additional attendees
  additionalAttendees?: AttendeeInfo[];
}

function validateBotProtection(validation: BotValidation): { success: boolean; reason?: string } {
  // Check if honeypot field was filled (bots fill all fields)
  if (validation.honeypot && validation.honeypot.length > 0) {
    console.warn("Bot detected: honeypot field was filled");
    return { success: false, reason: "honeypot" };
  }

  // Check if form was submitted too quickly (less than 3 seconds)
  const timeDiff = validation.submitTime - validation.formLoadTime;
  if (timeDiff < 3000) {
    console.warn("Bot detected: form submitted too quickly", { timeDiff });
    return { success: false, reason: "too_fast" };
  }

  // Check for unreasonably long time (more than 1 hour - might be stale/automated)
  if (timeDiff > 3600000) {
    console.warn("Suspicious: form took too long", { timeDiff });
    // Don't fail, just log - could be legitimate user
  }

  console.log("Bot validation passed", { timeDiff: `${(timeDiff / 1000).toFixed(1)}s` });
  return { success: true };
}

interface RegistrationInfo {
  applicationId: string;
  name: string;
  email: string;
  stayType: string;
  registrationFee: number;
}

function normalizeGender(input: string): "M" | "F" | null {
  const normalized = input.trim().toLowerCase();

  if (["m", "male"].includes(normalized)) return "M";
  if (["f", "female"].includes(normalized)) return "F";

  return null;
}

function normalizeTshirtSize(input: string): string | null {
  const normalized = input.trim().toUpperCase();

  const sizeMap: Record<string, string> = {
    S: 'S (Chest: 36")',
    'S (CHEST: 36")': 'S (Chest: 36")',
    M: 'M (Chest: 38-40")',
    'M (CHEST: 38-40")': 'M (Chest: 38-40")',
    L: 'L (Chest: 42")',
    'L (CHEST: 42")': 'L (Chest: 42")',
    XL: 'XL (Chest: 44")',
    'XL (CHEST: 44")': 'XL (Chest: 44")',
  };

  return sizeMap[normalized] ?? null;
}

function base64ToBytes(input: string): Uint8Array {
  const normalized = input.includes(",") ? input.split(",").pop() ?? "" : input;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function getProofExtension(fileName: string, contentType: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName) return fromName;

  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

async function sendConsolidatedConfirmationEmail(
  email: string,
  primaryName: string,
  primaryApplicationId: string,
  allRegistrations: RegistrationInfo[],
  totalFee: number
): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured, skipping confirmation email");
    return;
  }

  try {
    // Build the registrations list HTML
    const registrationsHtml = allRegistrations.map((reg, index) => `
      <tr style="border-bottom: 1px solid #e0e0e0;">
        <td style="padding: 12px; font-family: monospace; font-weight: bold; color: #5c4a3d;">${reg.applicationId}</td>
        <td style="padding: 12px;">${reg.name}${index === 0 ? ' <span style="color: #b8860b; font-size: 12px;">(Primary)</span>' : ''}</td>
        <td style="padding: 12px;">${reg.stayType === 'on-campus' ? 'On Campus' : 'Staying Outside'}</td>
        <td style="padding: 12px; text-align: right;">₹${reg.registrationFee.toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    const subject = allRegistrations.length > 1 
      ? `Registration Received - ${allRegistrations.length} Registrations (Primary: ${primaryApplicationId})`
      : `Registration Received - Application ID: ${primaryApplicationId}`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Rishi Valley Alumni Meet <${RESEND_FROM}>`,
        to: [email],
        subject: subject,
        html: `
          <div style="font-family: Georgia, serif; max-width: 700px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #5c4a3d; border-bottom: 2px solid #b8860b; padding-bottom: 10px;">
              Registration Received
            </h1>
            <p>Dear ${primaryName},</p>
            <p>Thank you for registering for the Rishi Valley Alumni Meet! Your registration has been received along with your payment proof.</p>
            
            ${allRegistrations.length > 1 ? `
              <p>You have registered <strong>${allRegistrations.length} people</strong> for the event. Here are the details:</p>
            ` : ''}
            
            <div style="background: #f5f5dc; padding: 20px; border-radius: 8px; margin: 20px 0; overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; min-width: 500px;">
                <thead>
                  <tr style="background: #e8e4d8; border-bottom: 2px solid #b8860b;">
                    <th style="padding: 12px; text-align: left; color: #5c4a3d;">Application ID</th>
                    <th style="padding: 12px; text-align: left; color: #5c4a3d;">Name</th>
                    <th style="padding: 12px; text-align: left; color: #5c4a3d;">Stay Type</th>
                    <th style="padding: 12px; text-align: right; color: #5c4a3d;">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  ${registrationsHtml}
                </tbody>
                <tfoot>
                  <tr style="background: #e8e4d8; font-weight: bold;">
                    <td colspan="3" style="padding: 12px; text-align: right; color: #5c4a3d;">Total Amount Paid:</td>
                    <td style="padding: 12px; text-align: right; color: #5c4a3d; font-size: 18px;">₹${totalFee.toLocaleString('en-IN')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #155724;"><strong>✅ Payment Proof Submitted</strong></p>
              <p style="margin: 10px 0 0; color: #155724; font-size: 14px;">
                Your payment proof has been received. The organizing committee will verify and confirm your registration via email.
              </p>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;"><strong>⚠️ Important:</strong> Please save your Primary Application ID (<strong>${primaryApplicationId}</strong>) for future reference.</p>
            </div>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>Rishi Valley Alumni Meet Organizing Committee</strong>
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Resend error:", errorData);
    } else {
      const result = await response.json();
      console.log("Consolidated confirmation email sent to:", email, result);
    }
  } catch (error) {
    console.error("Error sending confirmation email:", error);
    // Don't throw - email failure shouldn't fail the registration
  }
}

// Send individual confirmation email to attendee with their own email
async function sendAttendeeConfirmationEmail(
  attendeeEmail: string,
  attendeeName: string,
  attendeeApplicationId: string,
  primaryApplicationId: string,
  primaryName: string,
  stayType: string,
  registrationFee: number
): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured, skipping attendee email");
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Rishi Valley Alumni Meet <${RESEND_FROM}>`,
        to: [attendeeEmail],
        subject: `Registration Received - Application ID: ${attendeeApplicationId}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 700px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #5c4a3d; border-bottom: 2px solid #b8860b; padding-bottom: 10px;">
              Registration Received
            </h1>
            <p>Dear ${attendeeName},</p>
            <p>You have been registered for the Rishi Valley Alumni Meet by ${primaryName}. Your registration has been received along with payment proof.</p>
            
            <div style="background: #f5f5dc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #5c4a3d; margin-top: 0;">Your Registration Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #5c4a3d;">Application ID:</td>
                  <td style="padding: 8px 0; font-family: monospace; font-weight: bold;">${attendeeApplicationId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #5c4a3d;">Stay Type:</td>
                  <td style="padding: 8px 0;">${stayType === 'on-campus' ? 'On Campus' : 'Staying Outside'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #5c4a3d;">Registration Fee:</td>
                  <td style="padding: 8px 0;">₹${registrationFee.toLocaleString('en-IN')}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #155724;"><strong>✅ Payment Proof Submitted</strong></p>
              <p style="margin: 10px 0 0; color: #155724; font-size: 14px;">
                Your payment proof has been received. The organizing committee will verify and confirm your registration via email.
              </p>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;"><strong>ℹ️ Note:</strong> Your registration is part of a group registration managed by ${primaryName}.</p>
              <p style="margin: 10px 0 0; color: #856404;">Primary Application ID: <strong>${primaryApplicationId}</strong></p>
            </div>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>Rishi Valley Alumni Meet Organizing Committee</strong>
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Resend error for attendee email:", errorData);
    } else {
      const result = await response.json();
      console.log("Individual confirmation email sent to attendee:", attendeeEmail, result);
    }
  } catch (error) {
    console.error("Error sending attendee confirmation email:", error);
    // Don't throw - email failure shouldn't fail the registration
  }
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: RegistrationRequest = await req.json();
    console.log("Registration request received for:", data.email);
    console.log("Additional attendees count:", data.additionalAttendees?.length || 0);

    // Validate bot protection (honeypot + timing)
    const botResult = validateBotProtection(data.botValidation);
    
    if (!botResult.success) {
      console.warn("Bot protection failed for:", data.email, "reason:", botResult.reason);
      return new Response(
        JSON.stringify({ 
          error: "Verification failed. Please try again.",
          code: "BOT_DETECTED"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Bot protection verified successfully");

    // --- SERVER-SIDE: Validate email and phone formats ---
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9]{10,15}$/;

    if (!data.email || !emailRegex.test(data.email)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address.", code: "INVALID_EMAIL" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!data.phone || !phoneRegex.test(data.phone)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid phone number (10-15 digits, optional + prefix).", code: "INVALID_PHONE" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const normalizedPrimaryGender = normalizeGender(data.gender);
    const normalizedPrimaryTshirtSize = normalizeTshirtSize(data.tshirtSize);

    if (!normalizedPrimaryGender) {
      return new Response(
        JSON.stringify({ error: "Please select a valid gender.", code: "INVALID_GENDER" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!normalizedPrimaryTshirtSize) {
      return new Response(
        JSON.stringify({ error: "Please select a valid T-shirt size.", code: "INVALID_TSHIRT_SIZE" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate attendee emails and phones
    if (data.additionalAttendees && data.additionalAttendees.length > 0) {
      for (let i = 0; i < data.additionalAttendees.length; i++) {
        const att = data.additionalAttendees[i];
        if (!att.phone || !phoneRegex.test(att.phone)) {
          return new Response(
            JSON.stringify({ error: `Attendee ${i + 1} (${att.name}): Invalid phone number.`, code: "INVALID_PHONE" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        if (att.secondaryEmail && att.secondaryEmail.trim() !== "" && !emailRegex.test(att.secondaryEmail)) {
          return new Response(
            JSON.stringify({ error: `Attendee ${i + 1} (${att.name}): Invalid secondary email.`, code: "INVALID_EMAIL" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const attendeeGender = normalizeGender(att.gender);
        const attendeeTshirtSize = normalizeTshirtSize(att.tshirtSize);

        if (!attendeeGender) {
          return new Response(
            JSON.stringify({ error: `Attendee ${i + 1} (${att.name}): Invalid gender.`, code: "INVALID_GENDER" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        if (!attendeeTshirtSize) {
          return new Response(
            JSON.stringify({ error: `Attendee ${i + 1} (${att.name}): Invalid T-shirt size.`, code: "INVALID_TSHIRT_SIZE" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }
    }

    // Create Supabase client with service role for inserting
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- SERVER-SIDE: Validate invite token if provided ---
    if (data.inviteToken) {
      const { data: invite, error: inviteError } = await supabase
        .from("registration_invites")
        .select("id, used, expires_at")
        .eq("token", data.inviteToken)
        .single();

      if (inviteError || !invite) {
        return new Response(
          JSON.stringify({ error: "Invalid invite link.", code: "INVALID_INVITE" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (invite.used) {
        return new Response(
          JSON.stringify({ error: "This invite link has already been used for a registration.", code: "INVITE_USED" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (new Date(invite.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "This invite link has expired.", code: "INVITE_EXPIRED" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Mark invite as used atomically
      const { error: markError } = await supabase
        .from("registration_invites")
        .update({ used: true, used_at: new Date().toISOString() })
        .eq("id", invite.id)
        .eq("used", false); // optimistic lock

      if (markError) {
        console.error("Failed to mark invite as used:", markError);
        return new Response(
          JSON.stringify({ error: "This invite link has already been used.", code: "INVITE_USED" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("Invite token validated and marked as used:", data.inviteToken);
    }

    // --- SERVER-SIDE: Validate and upload payment proof ---
    if (!data.paymentProof?.base64 || !data.paymentProof?.name || !data.paymentProof?.type) {
      console.warn("Registration rejected: no payment proof payload provided");
      return new Response(
        JSON.stringify({
          error: "Payment proof is required. Please upload your payment proof and try again.",
          code: "MISSING_PROOF",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(data.paymentProof.type)) {
      return new Response(
        JSON.stringify({
          error: "Unsupported payment proof file type. Please upload JPG, PNG, WebP, or PDF.",
          code: "INVALID_PROOF_TYPE",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const proofBytes = base64ToBytes(data.paymentProof.base64);
    const proofSize = data.paymentProof.size ?? proofBytes.byteLength;
    if (proofSize > 5 * 1024 * 1024 || proofBytes.byteLength > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({
          error: "Payment proof must be 5MB or smaller.",
          code: "PROOF_TOO_LARGE",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate application ID for main registrant using the database function
    const { data: appIdData, error: appIdError } = await supabase.rpc("generate_application_id");

    if (appIdError) {
      console.error("Error generating application ID:", appIdError);
      throw new Error("Failed to generate application ID");
    }

    const applicationId = appIdData;
    console.log("Generated application ID:", applicationId);

    const isBulkRegistration = !!(data.additionalAttendees && data.additionalAttendees.length > 0);
    const proofExtension = getProofExtension(data.paymentProof.name, data.paymentProof.type);
    const paymentProofFileName = isBulkRegistration
      ? `combined-${applicationId}-${Date.now()}.${proofExtension}`
      : `${applicationId}-${Date.now()}.${proofExtension}`;

    const { error: proofUploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(paymentProofFileName, proofBytes, {
        upsert: true,
        cacheControl: "3600",
        contentType: data.paymentProof.type,
      });

    if (proofUploadError) {
      console.error("Payment proof upload failed:", proofUploadError);
      return new Response(
        JSON.stringify({
          error: "Unable to upload payment proof right now. Please try again.",
          code: "PROOF_UPLOAD_FAILED",
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: proofUrlData } = supabase.storage
      .from("payment-proofs")
      .getPublicUrl(paymentProofFileName);

    const paymentProofUrl = proofUrlData.publicUrl;
    console.log("Payment proof uploaded successfully:", paymentProofFileName);

    // Insert main registrant
    const { data: registration, error: insertError } = await supabase
      .from("registrations")
      .insert({
        application_id: applicationId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        occupation: data.occupation,
        board_type: data.boardType,
        year_of_passing: data.yearOfPassing,
        address_line1: data.addressLine1,
        address_line2: data.addressLine2 || null,
        city: data.city,
        district: data.district,
        state: data.state,
        postal_code: data.postalCode,
        country: data.country || "India",
        stay_type: data.stayType,
        tshirt_size: normalizedPrimaryTshirtSize,
        gender: normalizedPrimaryGender,
        registration_fee: data.registrationFee,
        payment_proof_url: paymentProofUrl,
        payment_status: "submitted",
        registration_status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting registration:", insertError);
      await supabase.storage.from("payment-proofs").remove([paymentProofFileName]);
      
      // Check for duplicate email
      if (insertError.code === "23505") {
        return new Response(
          JSON.stringify({ 
            error: "A registration with this email already exists.",
            code: "DUPLICATE_EMAIL"
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
      
      throw new Error("Failed to save registration");
    }

    console.log("Main registration saved successfully:", applicationId);

    // Collect all registrations for the consolidated email
    const allRegistrations: RegistrationInfo[] = [{
      applicationId: registration.application_id,
      name: registration.name,
      email: registration.email,
      stayType: registration.stay_type,
      registrationFee: registration.registration_fee,
    }];

    // Process additional attendees if any
    const additionalRegistrations: {
      applicationId: string;
      name: string;
      email: string;
      secondaryEmail?: string;
      stayType: string;
      registrationFee: number;
      hasSecondaryEmail: boolean;
    }[] = [];

    if (data.additionalAttendees && data.additionalAttendees.length > 0) {
      console.log("Processing additional attendees...");
      
      for (const attendee of data.additionalAttendees) {
        const attendeeGender = normalizeGender(attendee.gender);
        const attendeeTshirtSize = normalizeTshirtSize(attendee.tshirtSize);

        if (!attendeeGender || !attendeeTshirtSize) {
          console.error("Skipping attendee due to invalid normalized values", {
            attendeeName: attendee.name,
            attendeeGender: attendee.gender,
            attendeeTshirtSize: attendee.tshirtSize,
          });
          continue;
        }

        // Generate unique application ID for each attendee
        const { data: attendeeAppId, error: attendeeAppIdError } = await supabase.rpc("generate_application_id");
        
        if (attendeeAppIdError) {
          console.error("Error generating application ID for attendee:", attendeeAppIdError);
          continue; // Skip this attendee but continue with others
        }

        // Use main registrant's address for additional attendees
        // Always use primary email for the registration record
        const attendeeEmail = attendee.email || data.email;
        
        // Link to parent application ID
        const { data: attendeeReg, error: attendeeError } = await supabase
          .from("registrations")
          .insert({
            application_id: attendeeAppId,
            parent_application_id: applicationId, // Link to primary registrant
            name: attendee.name,
            email: attendeeEmail, // Use primary email
            phone: attendee.phone,
            occupation: attendee.occupation,
            board_type: attendee.boardType,
            year_of_passing: attendee.yearOfPassing,
            address_line1: data.addressLine1,
            address_line2: data.addressLine2 || null,
            city: data.city,
            district: data.district,
            state: data.state,
            postal_code: data.postalCode,
            country: data.country || "India",
            stay_type: attendee.stayType,
            tshirt_size: attendeeTshirtSize,
            gender: attendeeGender,
            registration_fee: attendee.registrationFee,
            payment_proof_url: paymentProofUrl,
            payment_status: "submitted",
            registration_status: "pending",
          })
          .select()
          .single();

        if (attendeeError) {
          console.error("Error inserting attendee:", attendeeEmail, attendeeError);
          // Check for duplicate and report
          if (attendeeError.code === "23505") {
            console.warn("Duplicate email for attendee:", attendeeEmail);
          }
        } else {
          console.log("Attendee registered:", attendeeAppId);
          
          // Check if attendee has a secondary email for individual notification
          const hasSecondaryEmail = attendee.secondaryEmail && attendee.secondaryEmail.trim() !== "";
          
          additionalRegistrations.push({
            applicationId: attendeeReg.application_id,
            name: attendeeReg.name,
            email: attendeeReg.email,
            secondaryEmail: attendee.secondaryEmail, // Store secondary email for sending individual notification
            stayType: attendeeReg.stay_type,
            registrationFee: attendeeReg.registration_fee,
            hasSecondaryEmail: !!hasSecondaryEmail, // Flag to determine if separate email should be sent
          });

          // Add to consolidated email list
          allRegistrations.push({
            applicationId: attendeeReg.application_id,
            name: attendeeReg.name,
            email: attendeeReg.email,
            stayType: attendeeReg.stay_type,
            registrationFee: attendeeReg.registration_fee,
          });
        }
      }
    }

    // Calculate total fee
    const totalFee = data.registrationFee + 
      (data.additionalAttendees?.reduce((sum, a) => sum + a.registrationFee, 0) || 0);

    // Send ONE consolidated confirmation email to the primary registrant only
    await sendConsolidatedConfirmationEmail(
      data.email,
      data.name,
      applicationId,
      allRegistrations,
      totalFee
    );

    // Send individual emails to attendees who have a secondary email address
    for (const attendeeReg of additionalRegistrations) {
      if (attendeeReg.hasSecondaryEmail && attendeeReg.secondaryEmail) {
        await sendAttendeeConfirmationEmail(
          attendeeReg.secondaryEmail, // Send to secondary email
          attendeeReg.name,
          attendeeReg.applicationId,
          applicationId,
          data.name,
          attendeeReg.stayType,
          attendeeReg.registrationFee
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        applicationId: registration.application_id,
        registration: {
          applicationId: registration.application_id,
          name: registration.name,
          email: registration.email,
          stayType: registration.stay_type,
          registrationFee: registration.registration_fee,
          paymentStatus: registration.payment_status,
          createdAt: registration.created_at,
        },
        additionalRegistrations,
        totalFee,
        totalRegistrants: 1 + additionalRegistrations.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in verify-captcha-register", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An unexpected error occurred. Please try again." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

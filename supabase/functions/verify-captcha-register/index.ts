import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Create Supabase client with service role for inserting
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate application ID for main registrant using the database function
    const { data: appIdData, error: appIdError } = await supabase.rpc("generate_application_id");
    
    if (appIdError) {
      console.error("Error generating application ID:", appIdError);
      throw new Error("Failed to generate application ID");
    }

    const applicationId = appIdData;
    console.log("Generated application ID:", applicationId);

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
        tshirt_size: data.tshirtSize,
        gender: data.gender,
        registration_fee: data.registrationFee,
        payment_status: "pending",
        registration_status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting registration:", insertError);
      
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
            tshirt_size: attendee.tshirtSize,
            gender: attendee.gender,
            registration_fee: attendee.registrationFee,
            payment_status: "pending",
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
    console.error("Error in verify-captcha-register");
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

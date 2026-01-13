import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AttendeeInfo {
  name: string;
  email: string;
  phone: string;
  occupation: string;
  yearOfPassing: number;
  stayType: string;
  tshirtSize: string;
  gender: string;
  registrationFee: number;
}

interface RegistrationRequest {
  captchaToken: string;
  // Main registrant info
  name: string;
  email: string;
  phone: string;
  occupation: string;
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

async function verifyTurnstile(token: string): Promise<{ success: boolean }> {
  const secretKey = Deno.env.get("TURNSTILE_SECRET_KEY");
  
  if (!secretKey) {
    console.error("TURNSTILE_SECRET_KEY not configured");
    throw new Error("Turnstile not configured");
  }

  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  console.log("Turnstile verification result:", { success: result.success });
  
  if (!result.success) {
    console.error("Turnstile error codes:", result["error-codes"]);
  }

  return { success: result.success };
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

    // Verify Turnstile token
    const captchaResult = await verifyTurnstile(data.captchaToken);
    
    if (!captchaResult.success) {
      console.warn("Turnstile verification failed for:", data.email);
      return new Response(
        JSON.stringify({ 
          error: "CAPTCHA verification failed. Please complete the verification and try again.",
          code: "CAPTCHA_FAILED"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Turnstile verified successfully");

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

    // Process additional attendees if any
    const additionalRegistrations: any[] = [];
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
        const { data: attendeeReg, error: attendeeError } = await supabase
          .from("registrations")
          .insert({
            application_id: attendeeAppId,
            name: attendee.name,
            email: attendee.email,
            phone: attendee.phone,
            occupation: attendee.occupation,
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
          console.error("Error inserting attendee:", attendee.email, attendeeError);
          // Check for duplicate and report
          if (attendeeError.code === "23505") {
            console.warn("Duplicate email for attendee:", attendee.email);
          }
        } else {
          console.log("Attendee registered:", attendeeAppId);
          additionalRegistrations.push({
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

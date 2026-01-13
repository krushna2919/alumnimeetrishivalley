import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdditionalRegistrant {
  name: string;
  gender: string;
  tshirtSize: string;
  stayType: string;
}

interface RegistrationRequest {
  captchaToken: string;
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
  additionalRegistrants?: AdditionalRegistrant[];
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
    console.log("Additional registrants count:", data.additionalRegistrants?.length || 0);

    // Validate additional registrants count
    const additionalRegistrants = data.additionalRegistrants || [];
    if (additionalRegistrants.length > 4) {
      return new Response(
        JSON.stringify({ 
          error: "Maximum 5 people can be registered at once (1 primary + 4 additional).",
          code: "MAX_REGISTRANTS_EXCEEDED"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate additional registrant names
    for (let i = 0; i < additionalRegistrants.length; i++) {
      if (!additionalRegistrants[i].name || additionalRegistrants[i].name.trim().length < 2) {
        return new Response(
          JSON.stringify({ 
            error: `Please enter a valid name for additional registrant ${i + 1}.`,
            code: "INVALID_REGISTRANT_NAME"
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

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

    // Generate application ID using the database function
    const { data: appIdData, error: appIdError } = await supabase.rpc("generate_application_id");
    
    if (appIdError) {
      console.error("Error generating application ID:", appIdError);
      throw new Error("Failed to generate application ID");
    }

    const applicationId = appIdData;
    console.log("Generated application ID:", applicationId);

    // Calculate individual fees
    const primaryFee = data.stayType === "on-campus" ? 15000 : 7500;

    // Insert primary registration
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
        registration_fee: data.registrationFee, // Total fee for all registrants
        payment_status: "pending",
        registration_status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting primary registration:", insertError);
      
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

    console.log("Primary registration saved successfully:", applicationId);

    // Insert additional registrants with linked application IDs
    if (additionalRegistrants.length > 0) {
      const additionalInserts = additionalRegistrants.map((registrant, index) => {
        const additionalFee = registrant.stayType === "on-campus" ? 15000 : 7500;
        return {
          application_id: `${applicationId}-${index + 2}`, // e.g., ALM-XXX-2, ALM-XXX-3
          name: registrant.name.trim(),
          email: data.email, // Same email as primary
          phone: data.phone, // Same phone as primary
          occupation: "Guest of " + data.name, // Indicate relationship
          year_of_passing: data.yearOfPassing, // Same batch
          address_line1: data.addressLine1,
          address_line2: data.addressLine2 || null,
          city: data.city,
          district: data.district,
          state: data.state,
          postal_code: data.postalCode,
          country: data.country || "India",
          stay_type: registrant.stayType,
          tshirt_size: registrant.tshirtSize,
          gender: registrant.gender,
          registration_fee: additionalFee,
          payment_status: "pending",
          registration_status: "pending",
        };
      });

      const { error: additionalError } = await supabase
        .from("registrations")
        .insert(additionalInserts);

      if (additionalError) {
        console.error("Error inserting additional registrations:", additionalError);
        // Don't fail the whole registration, just log the error
        // The primary registration is already saved
      } else {
        console.log(`${additionalRegistrants.length} additional registrations saved`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        applicationId: registration.application_id,
        totalRegistrants: 1 + additionalRegistrants.length,
        registration: {
          applicationId: registration.application_id,
          name: registration.name,
          email: registration.email,
          stayType: registration.stay_type,
          registrationFee: registration.registration_fee,
          paymentStatus: registration.payment_status,
          createdAt: registration.created_at,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-captcha-register:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

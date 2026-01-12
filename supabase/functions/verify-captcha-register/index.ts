import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
}

async function verifyCaptcha(token: string): Promise<{ success: boolean; score?: number }> {
  const secretKey = Deno.env.get("RECAPTCHA_SECRET_KEY");
  
  if (!secretKey) {
    console.error("RECAPTCHA_SECRET_KEY not configured");
    throw new Error("reCAPTCHA not configured");
  }

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `secret=${secretKey}&response=${token}`,
  });

  const result = await response.json();
  console.log("reCAPTCHA verification result:", { success: result.success, score: result.score });
  
  return {
    success: result.success && (result.score === undefined || result.score >= 0.5),
    score: result.score,
  };
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: RegistrationRequest = await req.json();
    console.log("Registration request received for:", data.email);

    // Verify reCAPTCHA token
    const captchaResult = await verifyCaptcha(data.captchaToken);
    
    if (!captchaResult.success) {
      console.warn("reCAPTCHA verification failed for:", data.email);
      return new Response(
        JSON.stringify({ 
          error: "CAPTCHA verification failed. Please try again.",
          code: "CAPTCHA_FAILED"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("reCAPTCHA verified successfully. Score:", captchaResult.score);

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

    // Insert registration
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

    console.log("Registration saved successfully:", applicationId);

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

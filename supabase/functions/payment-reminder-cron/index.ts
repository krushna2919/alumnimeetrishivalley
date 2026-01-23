import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/smtp-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Convert date to IST midnight
function toISTMidnight(date: Date): Date {
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  const istTime = new Date(utcTime + istOffset);
  istTime.setHours(0, 0, 0, 0);
  return istTime;
}

// Get current date in IST
function getCurrentISTDate(): Date {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcTime + istOffset);
}

// Format date for display
function formatDateIST(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
}

// Calculate days remaining
function getDaysRemaining(endDate: Date): number {
  const now = getCurrentISTDate();
  const end = toISTMidnight(endDate);
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

async function sendPaymentReminderEmail(
  email: string,
  name: string,
  applicationId: string,
  daysRemaining: number,
  endDate: string
): Promise<boolean> {
  try {
    console.log(`Sending payment reminder to ${email} for application ${applicationId}, ${daysRemaining} days remaining`);
    
    const urgencyText = daysRemaining <= 2 
      ? "⚠️ URGENT: This is your final reminder!"
      : daysRemaining <= 4 
        ? "⚡ Time is running out!"
        : "📢 Friendly Reminder";

    const htmlContent = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #f57c00; border-bottom: 2px solid #b8860b; padding-bottom: 10px;">
          ${urgencyText}
        </h1>
        <p>Dear ${name},</p>
        <p>This is a reminder that your payment proof for the <strong>Rishi Valley Alumni Meet</strong> registration is still pending.</p>
        
        <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f57c00;">
          <p style="margin: 0; font-size: 14px; color: #666;">Application ID:</p>
          <p style="margin: 10px 0 0; font-size: 20px; font-weight: bold; color: #f57c00; font-family: monospace;">
            ${applicationId}
          </p>
          <p style="margin: 15px 0 0; font-size: 14px; color: #666;">Days Remaining:</p>
          <p style="margin: 5px 0 0; font-size: 28px; font-weight: bold; color: ${daysRemaining <= 2 ? '#c62828' : '#f57c00'};">
            ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}
          </p>
          <p style="margin: 15px 0 0; font-size: 14px; color: #666;">Payment Deadline:</p>
          <p style="margin: 5px 0 0; font-weight: bold; color: #333;">
            ${formatDateIST(endDate)} (11:59 PM IST)
          </p>
        </div>
        
        <p style="color: #c62828; font-weight: bold;">
          ⚠️ Please submit your payment proof before the deadline to complete your registration. 
          Failure to submit payment details by the deadline will result in automatic rejection of your application.
        </p>
        
        <p>Please visit the application lookup page on our website and submit your payment proof at the earliest.</p>
        
        <p style="margin-top: 30px;">
          Best regards,<br>
          <strong>Rishi Valley Alumni Meet Organizing Committee</strong>
        </p>
      </div>
    `;

    const result = await sendEmail({
      to: email,
      subject: `${urgencyText} - Payment Pending for Application ${applicationId}`,
      html: htmlContent,
    });

    if (result.success) {
      console.log(`Payment reminder email sent successfully to ${email}`);
    } else {
      console.error(`Failed to send payment reminder to ${email}:`, result.error);
    }

    return result.success;
  } catch (error) {
    console.error("Error sending payment reminder email:", error);
    return false;
  }
}

async function sendAutoRejectionEmail(
  email: string,
  name: string,
  applicationId: string
): Promise<boolean> {
  try {
    console.log(`Sending auto-rejection email to ${email} for application ${applicationId}`);
    
    const htmlContent = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #c62828; border-bottom: 2px solid #b8860b; padding-bottom: 10px;">
          Registration Rejected
        </h1>
        <p>Dear ${name},</p>
        <p>We regret to inform you that your registration for the <strong>Rishi Valley Alumni Meet</strong> has been rejected.</p>
        
        <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #c62828;">
          <p style="margin: 0; font-size: 14px; color: #666;">Application ID:</p>
          <p style="margin: 10px 0 0; font-size: 20px; font-weight: bold; color: #c62828; font-family: monospace;">
            ${applicationId}
          </p>
          <p style="margin: 15px 0 0; font-size: 14px; color: #666;">Reason for Rejection:</p>
          <p style="margin: 5px 0 0; color: #333; font-weight: bold;">
            Payment details were not submitted within the registration period deadline.
          </p>
        </div>
        
        <p>We understand this may be disappointing. If you believe this was in error or have any questions, please contact the organizing committee.</p>
        
        <p style="margin-top: 30px;">
          Best regards,<br>
          <strong>Rishi Valley Alumni Meet Organizing Committee</strong>
        </p>
      </div>
    `;

    const result = await sendEmail({
      to: email,
      subject: `Registration Rejected - Application ${applicationId}`,
      html: htmlContent,
    });

    if (result.success) {
      console.log(`Auto-rejection email sent successfully to ${email}`);
    } else {
      console.error(`Failed to send auto-rejection email to ${email}:`, result.error);
    }

    return result.success;
  } catch (error) {
    console.error("Error sending auto-rejection email:", error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log("payment-reminder-cron function called");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get the current batch configuration
    const { data: batchConfig, error: configError } = await supabaseAdmin
      .from('batch_configuration')
      .select('*')
      .eq('is_registration_open', true)
      .limit(1)
      .single();

    if (configError || !batchConfig) {
      console.log("No active registration period found");
      return new Response(
        JSON.stringify({ success: true, message: "No active registration period" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const endDate = new Date(batchConfig.registration_end_date);
    const daysRemaining = getDaysRemaining(endDate);
    
    console.log(`Registration end date: ${batchConfig.registration_end_date}, Days remaining: ${daysRemaining}`);

    let remindersSent = 0;
    let rejectionsProcessed = 0;

    // Case 1: Registration period has ended - auto-reject applications without payment
    if (daysRemaining < 0) {
      console.log("Registration period has ended. Processing auto-rejections...");
      
      // Find all applications with pending payment status
      const { data: pendingPayments, error: pendingError } = await supabaseAdmin
        .from('registrations')
        .select('id, email, name, application_id')
        .eq('payment_status', 'pending')
        .eq('registration_status', 'pending');

      if (pendingError) {
        console.error("Error fetching pending payments:", pendingError);
        throw pendingError;
      }

      if (pendingPayments && pendingPayments.length > 0) {
        console.log(`Found ${pendingPayments.length} applications to auto-reject`);
        
        for (const registration of pendingPayments) {
          // Update registration status to rejected
          const { error: updateError } = await supabaseAdmin
            .from('registrations')
            .update({
              registration_status: 'rejected',
              rejection_reason: 'Payment details were not submitted within the registration period deadline.',
              updated_at: new Date().toISOString()
            })
            .eq('id', registration.id);

          if (updateError) {
            console.error(`Error rejecting application ${registration.application_id}:`, updateError);
            continue;
          }

          // Send rejection email
          await sendAutoRejectionEmail(
            registration.email,
            registration.name,
            registration.application_id
          );
          
          rejectionsProcessed++;
        }
      }
    }
    // Case 2: Within last 7 days - send daily reminders
    else if (daysRemaining <= 7 && daysRemaining >= 0) {
      console.log(`Within reminder period (${daysRemaining} days remaining). Sending reminders...`);
      
      // Find all applications with pending payment status
      const { data: pendingPayments, error: pendingError } = await supabaseAdmin
        .from('registrations')
        .select('id, email, name, application_id')
        .eq('payment_status', 'pending')
        .eq('registration_status', 'pending');

      if (pendingError) {
        console.error("Error fetching pending payments:", pendingError);
        throw pendingError;
      }

      if (pendingPayments && pendingPayments.length > 0) {
        console.log(`Found ${pendingPayments.length} applications needing payment reminder`);
        
        for (const registration of pendingPayments) {
          const success = await sendPaymentReminderEmail(
            registration.email,
            registration.name,
            registration.application_id,
            daysRemaining,
            batchConfig.registration_end_date
          );
          
          if (success) {
            remindersSent++;
          }
        }
      }
    } else {
      console.log(`Not in reminder period yet. ${daysRemaining} days remaining.`);
    }

    const result = {
      success: true,
      daysRemaining,
      remindersSent,
      rejectionsProcessed,
      message: daysRemaining < 0 
        ? `Processed ${rejectionsProcessed} auto-rejections`
        : `Sent ${remindersSent} payment reminders`
    };

    console.log("Cron job completed:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in payment-reminder-cron:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to process payment reminders" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

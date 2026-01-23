import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: Uint8Array;
    contentType?: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

// Get SMTP configuration from environment
function getSmtpConfig() {
  const host = Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com";
  const port = parseInt(Deno.env.get("SMTP_PORT") ?? "587", 10);
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");

  if (!user || !pass) {
    throw new Error("SMTP_USER and SMTP_PASS must be configured");
  }

  return { host, port, user, pass };
}

// Get the sender email (from SMTP_USER or RESEND_FROM for backwards compatibility)
export function getSenderEmail(): string {
  return Deno.env.get("SMTP_USER") ?? Deno.env.get("RESEND_FROM") ?? "noreply@example.com";
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const config = getSmtpConfig();
  
  const client = new SMTPClient({
    connection: {
      hostname: config.host,
      port: config.port,
      tls: true,
      auth: {
        username: config.user,
        password: config.pass,
      },
    },
  });

  try {
    // Build the recipient list
    const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
    
    // Build BCC list if provided
    const bccAddresses = options.bcc 
      ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc])
      : [];

    // Prepare attachments with proper encoding - use inline type
    const attachments = options.attachments?.map(att => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType ?? "application/octet-stream",
      encoding: "binary" as const,
    })) ?? [];

    // Prepare email content - let TypeScript infer the type
    const emailConfig = {
      from: `Rishi Valley Alumni Meet <${config.user}>`,
      to: toAddresses,
      bcc: bccAddresses.length > 0 ? bccAddresses : undefined,
      subject: options.subject,
      html: options.html,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    await client.send(emailConfig);
    await client.close();

    console.log(`Email sent successfully to: ${toAddresses.join(", ")}`);
    return { success: true };
  } catch (error) {
    console.error("SMTP error:", error);
    await client.close();
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown SMTP error" 
    };
  }
}

// Helper to convert base64 to Uint8Array for attachments
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

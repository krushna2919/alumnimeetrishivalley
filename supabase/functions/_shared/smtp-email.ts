// SMTP Email utility using direct SMTP protocol
// This implementation sends emails through SMTP without external dependencies

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

// Get the sender email
export function getSenderEmail(): string {
  return Deno.env.get("SMTP_USER") ?? Deno.env.get("RESEND_FROM") ?? "noreply@example.com";
}

// Encode string to base64
function btoa_utf8(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

// Generate a unique boundary for multipart messages
function generateBoundary(): string {
  return `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

// Convert Uint8Array to base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Read a line from the SMTP connection
async function readLine(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let line = '';
  
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    line += chunk;
    
    if (line.includes('\r\n')) {
      break;
    }
  }
  
  return line.trim();
}

// Read all response lines until we get a final response (no continuation)
async function readResponse(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<{ code: number; message: string }> {
  const decoder = new TextDecoder();
  let buffer = '';
  let lastCode = 0;
  let lastMessage = '';
  
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    
    // Check for complete lines
    const lines = buffer.split('\r\n');
    
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      if (line.length >= 3) {
        lastCode = parseInt(line.substring(0, 3), 10);
        lastMessage = line.substring(4);
        
        // If character at position 3 is space, this is the final line
        if (line[3] === ' ' || line.length === 3) {
          return { code: lastCode, message: lastMessage };
        }
      }
    }
    
    // Keep the incomplete last line in buffer
    buffer = lines[lines.length - 1];
  }
  
  return { code: lastCode, message: lastMessage };
}

// Send a command and read the response
async function sendCommand(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  command: string
): Promise<{ code: number; message: string }> {
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(command + '\r\n'));
  return readResponse(reader);
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const config = getSmtpConfig();
  
  console.log(`Connecting to SMTP server: ${config.host}:${config.port}`);
  
  try {
    // Connect to SMTP server
    let conn: Deno.TcpConn | Deno.TlsConn;
    
    if (config.port === 465) {
      // Implicit TLS
      conn = await Deno.connectTls({
        hostname: config.host,
        port: config.port,
      });
    } else {
      // Plain connection first (for STARTTLS on port 587)
      conn = await Deno.connect({
        hostname: config.host,
        port: config.port,
      });
    }
    
    const reader = conn.readable.getReader();
    const writer = conn.writable.getWriter();
    
    try {
      // Read server greeting
      const greeting = await readResponse(reader);
      console.log(`SMTP greeting: ${greeting.code} ${greeting.message}`);
      
      if (greeting.code !== 220) {
        throw new Error(`Unexpected greeting: ${greeting.code} ${greeting.message}`);
      }
      
      // Send EHLO
      let response = await sendCommand(writer, reader, `EHLO ${config.host}`);
      console.log(`EHLO response: ${response.code}`);
      
      // If using port 587, initiate STARTTLS
      if (config.port === 587) {
        response = await sendCommand(writer, reader, 'STARTTLS');
        console.log(`STARTTLS response: ${response.code}`);
        
        if (response.code !== 220) {
          throw new Error(`STARTTLS failed: ${response.code} ${response.message}`);
        }
        
        // Release the reader and writer before upgrading
        reader.releaseLock();
        writer.releaseLock();
        
        // Upgrade to TLS
        const tlsConn = await Deno.startTls(conn as Deno.TcpConn, {
          hostname: config.host,
        });
        
        // Get new reader/writer from TLS connection
        const tlsReader = tlsConn.readable.getReader();
        const tlsWriter = tlsConn.writable.getWriter();
        
        // Send EHLO again after TLS upgrade
        response = await sendCommand(tlsWriter, tlsReader, `EHLO ${config.host}`);
        console.log(`EHLO after TLS response: ${response.code}`);
        
        // Continue with TLS connection
        return await sendEmailWithConnection(tlsWriter, tlsReader, config, options, tlsConn);
      }
      
      // Continue with current connection
      return await sendEmailWithConnection(writer, reader, config, options, conn);
      
    } catch (error) {
      reader.releaseLock();
      writer.releaseLock();
      throw error;
    }
    
  } catch (error) {
    console.error("SMTP connection error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown SMTP error" 
    };
  }
}

async function sendEmailWithConnection(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  config: { user: string; pass: string },
  options: EmailOptions,
  conn: Deno.Conn
): Promise<EmailResult> {
  try {
    // AUTH LOGIN
    let response = await sendCommand(writer, reader, 'AUTH LOGIN');
    console.log(`AUTH LOGIN response: ${response.code}`);
    
    if (response.code !== 334) {
      throw new Error(`AUTH LOGIN failed: ${response.code} ${response.message}`);
    }
    
    // Send username (base64 encoded)
    response = await sendCommand(writer, reader, btoa(config.user));
    if (response.code !== 334) {
      throw new Error(`Username failed: ${response.code} ${response.message}`);
    }
    
    // Send password (base64 encoded)
    response = await sendCommand(writer, reader, btoa(config.pass));
    if (response.code !== 235) {
      throw new Error(`Authentication failed: ${response.code} ${response.message}`);
    }
    console.log("SMTP authentication successful");
    
    // Build recipient lists
    const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
    const bccAddresses = options.bcc 
      ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc])
      : [];
    const allRecipients = [...toAddresses, ...bccAddresses];
    
    // MAIL FROM
    response = await sendCommand(writer, reader, `MAIL FROM:<${config.user}>`);
    if (response.code !== 250) {
      throw new Error(`MAIL FROM failed: ${response.code} ${response.message}`);
    }
    
    // RCPT TO for each recipient
    for (const recipient of allRecipients) {
      response = await sendCommand(writer, reader, `RCPT TO:<${recipient}>`);
      if (response.code !== 250 && response.code !== 251) {
        throw new Error(`RCPT TO failed for ${recipient}: ${response.code} ${response.message}`);
      }
    }
    
    // DATA
    response = await sendCommand(writer, reader, 'DATA');
    if (response.code !== 354) {
      throw new Error(`DATA failed: ${response.code} ${response.message}`);
    }
    
    // Build email message
    const boundary = generateBoundary();
    const hasAttachments = options.attachments && options.attachments.length > 0;
    
    let message = '';
    message += `From: Rishi Valley Alumni Meet <${config.user}>\r\n`;
    message += `To: ${toAddresses.join(', ')}\r\n`;
    message += `Subject: ${options.subject}\r\n`;
    message += `MIME-Version: 1.0\r\n`;
    message += `Date: ${new Date().toUTCString()}\r\n`;
    
    if (hasAttachments) {
      message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;
      message += `\r\n`;
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/html; charset=utf-8\r\n`;
      message += `Content-Transfer-Encoding: base64\r\n`;
      message += `\r\n`;
      message += btoa_utf8(options.html).match(/.{1,76}/g)?.join('\r\n') + '\r\n';
      
      // Add attachments
      for (const attachment of options.attachments!) {
        message += `\r\n--${boundary}\r\n`;
        message += `Content-Type: ${attachment.contentType ?? 'application/octet-stream'}; name="${attachment.filename}"\r\n`;
        message += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
        message += `Content-Transfer-Encoding: base64\r\n`;
        message += `\r\n`;
        message += uint8ArrayToBase64(attachment.content).match(/.{1,76}/g)?.join('\r\n') + '\r\n';
      }
      
      message += `--${boundary}--\r\n`;
    } else {
      message += `Content-Type: text/html; charset=utf-8\r\n`;
      message += `Content-Transfer-Encoding: base64\r\n`;
      message += `\r\n`;
      message += btoa_utf8(options.html).match(/.{1,76}/g)?.join('\r\n') + '\r\n';
    }
    
    // End with <CRLF>.<CRLF>
    message += `\r\n.\r\n`;
    
    // Send the message
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(message));
    
    // Read final response
    response = await readResponse(reader);
    if (response.code !== 250) {
      throw new Error(`Message sending failed: ${response.code} ${response.message}`);
    }
    
    // QUIT
    await sendCommand(writer, reader, 'QUIT');
    
    // Close connection
    reader.releaseLock();
    writer.releaseLock();
    conn.close();
    
    console.log(`Email sent successfully to: ${toAddresses.join(", ")}`);
    return { success: true };
    
  } catch (error) {
    reader.releaseLock();
    writer.releaseLock();
    try { conn.close(); } catch { /* ignore */ }
    
    console.error("SMTP error:", error);
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

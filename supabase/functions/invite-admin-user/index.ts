import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[invite-admin-user] request received', {
      method: req.method,
      hasAuth: !!req.headers.get('Authorization'),
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get the authorization header to verify the caller is a superadmin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller's token and get their user ID
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      console.error('[invite-admin-user] invalid auth token', authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is a superadmin
    const { data: isSuperadmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: caller.id,
      _role: 'superadmin'
    });

    if (roleError || !isSuperadmin) {
      console.error('[invite-admin-user] caller not superadmin', {
        caller: caller.email,
        roleError: roleError?.message,
      });
      return new Response(
        JSON.stringify({ error: "Only superadmins can invite users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { email, role, password, siteUrl } = body;
    const sendInviteEmail: boolean = body?.sendInviteEmail ?? true;

    console.log('[invite-admin-user] payload', { email, role, siteUrl, sendInviteEmail });

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Email and role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate role
    if (!['admin', 'superadmin'].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role. Must be 'admin' or 'superadmin'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trySendInviteEmail = async (actionLink: string) => {
      if (!sendInviteEmail) {
        return { attempted: false, sent: false, error: null as string | null };
      }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome!</h1>
          <p>You have been invited to join as an <strong>${role}</strong>.</p>
          <p>Please click the button below to set your password and access the admin dashboard:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionLink}"
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Set Your Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
          <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      `;

      // NOTE: Resend requires the FROM domain to be verified.
      // We'll try the custom FROM first, and if the domain isn't verified, fall back to a verified resend.dev sender.
      const primaryFrom = "Alumni Meet <alumnimeet@rishivalley.org>";
      const fallbackFrom = "Alumni Meet <onboarding@resend.dev>";

      const send = async (from: string) => {
        return await resend.emails.send({
          from,
          to: [email],
          subject: "You've been invited as an Admin",
          html,
          reply_to: "alumnimeet@rishivalley.org",
        });
      };

      try {
        const emailResult = await send(primaryFrom);
        console.log('[invite-admin-user] resend send result', JSON.stringify(emailResult));
        return { attempted: true, sent: true, error: null as string | null };
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.error('[invite-admin-user] resend send error (primary from)', msg);

        // Domain not verified → retry with fallback sender so invites still deliver.
        if (msg.toLowerCase().includes('domain is not verified')) {
          try {
            const emailResult2 = await send(fallbackFrom);
            console.log('[invite-admin-user] resend send result (fallback from)', JSON.stringify(emailResult2));
            return {
              attempted: true,
              sent: true,
              error: 'Primary sender domain not verified; sent via fallback sender.',
            };
          } catch (err2: any) {
            const msg2 = err2?.message || String(err2);
            console.error('[invite-admin-user] resend send error (fallback from)', msg2);
            return { attempted: true, sent: false, error: msg2 };
          }
        }

        return { attempted: true, sent: false, error: msg };
      }
    };

    const generateResetLink = async () => {
      const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: siteUrl ? `${siteUrl}/admin` : undefined,
        }
      });

      if (resetError) {
        console.error('[invite-admin-user] generateLink error', resetError.message);
        return { actionLink: null as string | null, error: resetError.message };
      }

      const actionLink = resetData?.properties?.action_link ?? null;
      if (!actionLink) {
        console.error('[invite-admin-user] generateLink: no action_link in response');
        return { actionLink: null as string | null, error: 'No reset link generated' };
      }

      console.log('[invite-admin-user] generated reset link', { email });
      return { actionLink, error: null as string | null };
    };

    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error('[invite-admin-user] listUsers error', listError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to lookup existing users' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;
    let isNewUser = false;
    let actionLinkForResponse: string | null = null;
    let emailStatus: { attempted: boolean; sent: boolean; error: string | null } = {
      attempted: false,
      sent: false,
      error: null,
    };

    if (existingUser) {
      userId = existingUser.id;

      // Ensure a profile row exists (used by Admin Users UI to display email)
      const { error: profileUpsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({ id: userId, email }, { onConflict: 'id' });
      if (profileUpsertError) {
        console.error('[invite-admin-user] profile upsert error (existing user):', profileUpsertError.message);
      }

      // Optional: still send (or re-send) password setup email for existing users
      const { actionLink } = await generateResetLink();
      if (actionLink) {
        actionLinkForResponse = actionLink;
        emailStatus = await trySendInviteEmail(actionLink);
      }

      // Check if they already have this role
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', role)
        .maybeSingle();

      if (existingRole) {
        return new Response(
          JSON.stringify({
            error: `User already has the ${role} role`,
            emailStatus,
            actionLink: actionLinkForResponse,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Create new user with provided or generated password
      const userPassword = password || generateSecurePassword();

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: userPassword,
        email_confirm: true, // Auto-confirm the email
      });

      if (createError) {
        console.error("[invite-admin-user] createUser error:", createError.message);
        return new Response(
          JSON.stringify({ error: "Failed to create user account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;
      isNewUser = true;

      // Create (or update) profile for the new user
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert(
          {
            id: userId,
            email: email,
          },
          { onConflict: 'id' }
        );

      if (profileError) {
        console.error("[invite-admin-user] profile upsert error:", profileError.message);
        // Don't fail the request, profile can be created later
      }

      const { actionLink } = await generateResetLink();
      if (actionLink) {
        actionLinkForResponse = actionLink;
        emailStatus = await trySendInviteEmail(actionLink);
      }
    }

    // Assign the role
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role,
      });

    if (roleInsertError) {
      console.error("[invite-admin-user] role insert error:", roleInsertError.message);
      return new Response(
        JSON.stringify({ error: "Failed to assign role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        isNewUser,
        emailStatus,
        // If email sending fails, superadmin can still copy this link and share it.
        actionLink: actionLinkForResponse,
        message: isNewUser
          ? `New user created and assigned ${role} role.`
          : `Role ${role} assigned to existing user`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[invite-admin-user] unexpected error:", error?.message || error);
    return new Response(
      JSON.stringify({ error: error?.message || "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  for (let i = 0; i < 16; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      return new Response(
        JSON.stringify({ error: "Only superadmins can invite users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { email, role, password } = await req.json();

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

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      
      // Check if they already have this role
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', role)
        .maybeSingle();

      if (existingRole) {
        return new Response(
          JSON.stringify({ error: `User already has the ${role} role` }),
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
        console.error("Error creating user:", createError.message);
        return new Response(
          JSON.stringify({ error: "Failed to create user account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;

      // Create profile for the new user
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          email: email,
        });

      if (profileError) {
        console.error("Error creating profile:", profileError.message);
        // Don't fail the request, profile can be created later
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
      console.error("Error assigning role:", roleInsertError.message);
      return new Response(
        JSON.stringify({ error: "Failed to assign role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: existingUser 
          ? `Role ${role} assigned to existing user` 
          : `New user created and assigned ${role} role`,
        isNewUser: !existingUser
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
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

/**
 * Admin Roles Management - Secure edge function for granting/revoking admin roles
 * All writes to admin_roles go through here using service role key
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Authenticate the caller
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get caller's wallet from user metadata or ID
  const callerWallet = userData.user.user_metadata?.wallet_address || userData.user.id;

  // Verify caller is an owner
  const { data: isOwner } = await supabase.rpc("wallet_has_role", {
    _wallet: callerWallet,
    _role: "owner",
  });

  if (!isOwner) {
    return new Response(JSON.stringify({ error: "Only owners can manage roles" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { action, wallet_address, role, notes } = body;

    if (!action || !wallet_address || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields: action, wallet_address, role" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validRoles = ["owner", "admin", "moderator", "viewer"];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "grant") {
      const { error: insertError } = await supabase
        .from("admin_roles")
        .upsert({
          wallet_address: wallet_address.toLowerCase(),
          role,
          granted_by: callerWallet.toLowerCase(),
          notes: notes || null,
          is_active: true,
        }, {
          onConflict: "wallet_address,role",
        });

      if (insertError) throw insertError;

      return new Response(JSON.stringify({ success: true, action: "granted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "revoke") {
      // Prevent owner from revoking their own owner role
      if (wallet_address.toLowerCase() === callerWallet.toLowerCase() && role === "owner") {
        return new Response(JSON.stringify({ error: "Cannot revoke your own owner role" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("admin_roles")
        .update({ is_active: false })
        .ilike("wallet_address", wallet_address)
        .eq("role", role);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, action: "revoked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'grant' or 'revoke'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[manage-admin-roles] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

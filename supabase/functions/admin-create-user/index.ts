// SP-lite — admin-create-user Edge Function.
// The browser can't create auth.users rows (needs the service_role key, which
// must never ship to the client). This function holds the service_role
// server-side (auto-injected as SUPABASE_SERVICE_ROLE_KEY), verifies the
// caller is an Admin via their JWT, then creates the user + activates them.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing auth token" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Caller-scoped client (RLS applies) — used only to confirm the caller is Admin.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await caller.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);
  const { data: callerProf } = await caller
    .from("profiles").select("role").eq("id", user.id).single();
  if (callerProf?.role !== "Admin") return json({ error: "Admins only" }, 403);

  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { email, password, username, full_name, role } = body;
  if (!email || !password) return json({ error: "email and password are required" }, 400);

  // Service-role client — bypasses RLS to create the auth user + profile.
  const admin = createClient(url, serviceKey);

  if (role) {
    const { data: r } = await admin.from("roles").select("name").eq("name", role).maybeSingle();
    if (!r) return json({ error: `Unknown role: ${role}` }, 400);
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // admin-created → no email confirmation needed
    user_metadata: { username, full_name },
  });
  if (error) return json({ error: error.message }, 400);

  // Upsert the profile — don't assume handle_new_user fired (it doesn't,
  // reliably, for every auth.users insert). Admin-created users are active.
  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .upsert({
      id: data.user.id,
      username: username || data.user.email.split("@")[0],
      full_name: full_name || null,
      role: role || "QA",
      is_active: true,
    })
    .select("id, username, role, full_name, is_active, created_at, updated_at")
    .single();
  if (profErr) return json({ error: profErr.message }, 500);

  return json({ user: profile });
});

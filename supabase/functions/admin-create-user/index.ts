import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type CreateUserRequest = {
  fullName?: string;
  email?: string;
  roleId?: string;
  status?: "active" | "invited" | "suspended";
  title?: string;
  department?: string;
  notes?: string;
  workspaceId?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeRole = (roleId?: string) => {
  const roleMap: Record<string, string> = {
    super_admin: "super_admin",
    admin: "admin",
    organization_admin: "organization_admin",
    project_admin: "project_admin",
    project_manager: "project_manager",
    pm: "project_manager",
    lead: "team_member",
    team_member: "team_member",
    standard_member: "standard_member",
    viewer: "standard_member",
    guest: "guest",
  };
  return roleMap[roleId ?? ""] ?? "standard_member";
};

const isPrivilegedRole = (role?: string | null) =>
  ["super_admin", "admin", "organization_admin", "project_admin", "project_manager"].includes(role ?? "");

const findUserByEmail = async (adminClient: ReturnType<typeof createClient>, email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;
  const perPage = 1000;

  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail);
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }

  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase Edge Function environment variables are not configured." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing authenticated user session." }, 401);
  }

  const requestClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: requesterData, error: requesterError } = await requestClient.auth.getUser();
  if (requesterError || !requesterData.user) {
    return jsonResponse({ error: "Invalid or expired user session." }, 401);
  }

  let payload: CreateUserRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, 400);
  }

  const email = payload.email?.trim().toLowerCase();
  const fullName = payload.fullName?.trim();
  if (!email || !fullName) {
    return jsonResponse({ error: "Full name and email are required." }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "A valid email address is required." }, 400);
  }

  const role = normalizeRole(payload.roleId);
  const requestedStatus = payload.status ?? "invited";

  const { data: contextRows, error: contextError } = await adminClient
    .from("workspace_memberships")
    .select("workspace_id, role, status, workspaces(id, name)")
    .eq("user_id", requesterData.user.id)
    .eq("status", "active");

  if (contextError) {
    return jsonResponse({ error: `Unable to verify requester workspace access: ${contextError.message}` }, 500);
  }

  const requesterMembership = payload.workspaceId
    ? contextRows?.find((row) => row.workspace_id === payload.workspaceId)
    : contextRows?.[0];

  if (!requesterMembership?.workspace_id || !isPrivilegedRole(requesterMembership.role)) {
    return jsonResponse({ error: "Only workspace admins and project managers can invite users." }, 403);
  }

  const workspaceId = requesterMembership.workspace_id;

  try {
    let authUser = await findUserByEmail(adminClient, email);
    let inviteSent = false;

    if (!authUser) {
      const { data: invitedUser, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          role_id: role,
          title: payload.title ?? "",
          department: payload.department ?? "",
          workspace_id: workspaceId,
        },
      });

      if (inviteError) throw inviteError;
      authUser = invitedUser.user;
      inviteSent = true;
    }

    if (!authUser?.id) {
      return jsonResponse({ error: "Unable to create or locate Supabase Auth user." }, 500);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .upsert(
        {
          user_id: authUser.id,
          display_name: fullName,
          department: payload.department ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .single();

    if (profileError) throw profileError;

    const { error: userRoleError } = await adminClient
      .from("user_roles")
      .upsert(
        { user_id: authUser.id, role },
        { onConflict: "user_id,role" },
      );
    if (userRoleError) throw userRoleError;

    const { error: membershipError } = await adminClient
      .from("workspace_memberships")
      .upsert(
        {
          workspace_id: workspaceId,
          user_id: authUser.id,
          role,
          status: requestedStatus === "suspended" ? "suspended" : "active",
          title: payload.title ?? null,
        },
        { onConflict: "workspace_id,user_id" },
      );
    if (membershipError) throw membershipError;

    const { error: teamMemberError } = await adminClient
      .from("team_members")
      .upsert(
        {
          workspace_id: workspaceId,
          user_id: authUser.id,
          profile_id: profile?.id ?? null,
          name: fullName,
          email,
          role_title: payload.title ?? null,
          department: payload.department ?? null,
          privilege_role: role,
          metadata: {
            source: "admin-create-user",
            notes: payload.notes ?? "",
            inviteSent,
          },
        },
        { onConflict: "workspace_id,email" },
      );

    if (teamMemberError) {
      console.warn("Team member sync failed", teamMemberError.message);
    }

    const { error: auditError } = await adminClient.from("audit_events").insert({
      workspace_id: workspaceId,
      actor_user_id: requesterData.user.id,
      entity_type: "user",
      entity_id: authUser.id,
      action: inviteSent ? "User invited" : "User access provisioned",
      detail: `${fullName} (${email}) was provisioned as ${role}.`,
      payload: { email, fullName, role, status: requestedStatus, inviteSent },
    });

    if (auditError) console.warn("Audit insert failed", auditError.message);

    return jsonResponse({
      ok: true,
      userId: authUser.id,
      email,
      fullName,
      role,
      status: requestedStatus === "suspended" ? "suspended" : "active",
      workspaceId,
      profileId: profile?.id ?? null,
      inviteSent,
      message: inviteSent
        ? "User was invited, added to the workspace, and can set access from the email invitation."
        : "Existing Auth user was added to the workspace.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user.";
    return jsonResponse({ error: message }, 500);
  }
});

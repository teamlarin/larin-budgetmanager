import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

// Supabase Edge Functions inject SUPABASE_ANON_KEY; newer runtimes also expose
// SUPABASE_PUBLISHABLE_KEY. Read both so the tools never construct a client
// with `undefined` (which throws synchronously and surfaces as handler_error).
function anonKey(): string {
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    "";
  if (!key) {
    throw new Error(
      "Missing Supabase anon key in the edge function environment (SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY).",
    );
  }
  return key;
}

function projectUrl(): string {
  const url = process.env.SUPABASE_URL ?? "";
  if (!url) throw new Error("Missing SUPABASE_URL in the edge function environment.");
  return url;
}

/** User-scoped client — RLS applies as the signed-in MCP caller. */
export function supabaseForUser(ctx: ToolContext): SupabaseClient {
  return createClient(projectUrl(), anonKey(), {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-role client — use ONLY after verifying the caller's role. */
export function supabaseAdmin(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in the edge function environment.");
  return createClient(projectUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Wraps a handler so thrown errors become readable MCP errors instead of crashes. */
export async function guarded(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn();
  } catch (e) {
    return errorResult(e instanceof Error ? e.message : String(e));
  }
}

export type Scope = "admin" | "team_leader" | "self";

/**
 * Resolves the caller's scope and the set of user ids they may inspect.
 * `allowedUserIds === null` means unrestricted (admin).
 */
export async function resolveScope(
  ctx: ToolContext,
): Promise<{ scope: Scope; meId: string; allowedUserIds: Set<string> | null }> {
  const meId = ctx.getUserId()!;
  const userClient = supabaseForUser(ctx);

  const [{ data: isAdmin }, { data: isTeamLeader }] = await Promise.all([
    userClient.rpc("has_role", { _user_id: meId, _role: "admin" }),
    userClient.rpc("has_role", { _user_id: meId, _role: "team_leader" }),
  ]);

  if (isAdmin) return { scope: "admin", meId, allowedUserIds: null };

  if (isTeamLeader) {
    const admin = supabaseAdmin();
    const { data: areas, error: areasErr } = await admin
      .from("team_leader_areas")
      .select("area")
      .eq("user_id", meId);
    if (areasErr) throw new Error(areasErr.message);
    const areaList = (areas ?? []).map((a: { area: string }) => a.area);
    const ids = new Set<string>([meId]);
    if (areaList.length > 0) {
      const { data: profs, error: profErr } = await admin
        .from("profiles")
        .select("id")
        .in("area", areaList);
      if (profErr) throw new Error(profErr.message);
      for (const p of profs ?? []) ids.add((p as { id: string }).id);
    }
    return { scope: "team_leader", meId, allowedUserIds: ids };
  }

  return { scope: "self", meId, allowedUserIds: new Set<string>([meId]) };
}

export type UserMatch = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  area: string | null;
};

/** Case-insensitive search on first name, last name, full name and email. */
export async function searchUsers(
  query: string,
  allowedUserIds: Set<string> | null,
): Promise<UserMatch[]> {
  const admin = supabaseAdmin();
  let q = admin
    .from("profiles")
    .select("id, first_name, last_name, email, area, approved")
    .eq("approved", true)
    .limit(500);
  if (allowedUserIds) q = q.in("id", Array.from(allowedUserIds));

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  return ((data ?? []) as UserMatch[])
    .filter((p) => {
      const haystack = [p.first_name, p.last_name, p.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((t) => haystack.includes(t));
    })
    .map((p) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      area: p.area,
    }));
}

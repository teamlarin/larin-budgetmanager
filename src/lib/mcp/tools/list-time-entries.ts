import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

// User-scoped client (RLS applied) — used to check the caller's role.
function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

// Service-role client — used ONLY after the caller's role has been verified.
// Never leaves this edge function.
function supabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function hoursBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round((ms / 3_600_000) * 100) / 100;
}

export default defineTool({
  name: "list_time_entries",
  title: "List time entries",
  description:
    "List confirmed time-tracking entries. Admins can query any user; team leaders are limited to users in their assigned areas; other roles are limited to their own entries. Only entries with actual_start_time and actual_end_time set are returned.",
  inputSchema: {
    user_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filter by user UUID. Requires admin, or team_leader access to that user's area."),
    project_id: z.string().uuid().optional().describe("Filter by project UUID."),
    from: z.string().optional().describe("Inclusive start date (YYYY-MM-DD)."),
    to: z.string().optional().describe("Inclusive end date (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(500).optional().describe("Max rows (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ user_id, project_id, from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const meId = ctx.getUserId();
    const userClient = supabaseForUser(ctx);

    // Resolve caller role via SECURITY DEFINER RPC (no RLS recursion).
    const [{ data: isAdmin }, { data: isTeamLeader }] = await Promise.all([
      userClient.rpc("has_role", { _user_id: meId, _role: "admin" }),
      userClient.rpc("has_role", { _user_id: meId, _role: "team_leader" }),
    ]);

    // Build the allowed user_id set based on role.
    let allowedUserIds: Set<string> | null = null; // null = unrestricted (admin)
    if (isAdmin) {
      allowedUserIds = null;
    } else if (isTeamLeader) {
      const admin = supabaseAdmin();
      const { data: areas, error: areasErr } = await admin
        .from("team_leader_areas")
        .select("area")
        .eq("user_id", meId);
      if (areasErr) {
        return { content: [{ type: "text", text: areasErr.message }], isError: true };
      }
      const areaList = (areas ?? []).map((a: { area: string }) => a.area);
      const ids = new Set<string>([meId]);
      if (areaList.length > 0) {
        const { data: profs, error: profErr } = await admin
          .from("profiles")
          .select("id")
          .in("area", areaList);
        if (profErr) {
          return { content: [{ type: "text", text: profErr.message }], isError: true };
        }
        for (const p of profs ?? []) ids.add((p as { id: string }).id);
      }
      allowedUserIds = ids;
    } else {
      allowedUserIds = new Set<string>([meId]);
    }

    // Enforce requested user_id against allowed set.
    if (user_id && allowedUserIds && !allowedUserIds.has(user_id)) {
      return {
        content: [{ type: "text", text: "forbidden: user_id not in your allowed scope" }],
        isError: true,
      };
    }

    // Query with service role, applying filters manually.
    const admin = supabaseAdmin();
    let q = admin
      .from("activity_time_tracking")
      .select(
        "id, scheduled_date, actual_start_time, actual_end_time, notes, user_id, budget_item_id, budget_items:budget_item_id ( project_id, activity_name, category )",
      )
      .not("actual_start_time", "is", null)
      .not("actual_end_time", "is", null)
      .order("scheduled_date", { ascending: false })
      .limit(limit ?? 100);

    if (user_id) {
      q = q.eq("user_id", user_id);
    } else if (allowedUserIds) {
      q = q.in("user_id", Array.from(allowedUserIds));
    }
    if (from) q = q.gte("scheduled_date", from);
    if (to) q = q.lte("scheduled_date", to);

    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    let rows = (data ?? []) as Array<{
      id: string;
      scheduled_date: string | null;
      actual_start_time: string | null;
      actual_end_time: string | null;
      notes: string | null;
      user_id: string;
      budget_item_id: string;
      budget_items: { project_id: string | null; activity_name: string | null; category: string | null } | null;
    }>;

    if (project_id) {
      rows = rows.filter((r) => r.budget_items?.project_id === project_id);
    }

    const entries = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      project_id: r.budget_items?.project_id ?? null,
      budget_item_id: r.budget_item_id,
      activity_name: r.budget_items?.activity_name ?? null,
      category: r.budget_items?.category ?? null,
      scheduled_date: r.scheduled_date,
      actual_start_time: r.actual_start_time,
      actual_end_time: r.actual_end_time,
      hours: hoursBetween(r.actual_start_time, r.actual_end_time),
      notes: r.notes,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(entries, null, 2) }],
      structuredContent: {
        entries,
        scope: isAdmin ? "admin" : isTeamLeader ? "team_leader" : "self",
      },
    };
  },
});

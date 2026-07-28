import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  errorResult,
  guarded,
  resolveScope,
  searchUsers,
  supabaseAdmin,
} from "./_supabase";

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
    "List confirmed time-tracking entries. Pass user_id (UUID) or user_search (a person's name/email). Admins can query any user; team leaders are limited to users in their assigned areas; other roles are limited to their own entries. Only entries with actual_start_time and actual_end_time set are returned. Returns the entries plus an aggregated summary (total hours, hours per project).",
  inputSchema: {
    user_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filter by user UUID. Requires admin, or team_leader access to that user's area."),
    user_search: z
      .string()
      .optional()
      .describe(
        "Alternative to user_id: a name or email fragment. If several users match, the tool returns the candidates instead of entries.",
      ),
    project_id: z.string().uuid().optional().describe("Filter by project UUID."),
    from: z.string().optional().describe("Inclusive start date (YYYY-MM-DD)."),
    to: z.string().optional().describe("Inclusive end date (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(500).optional().describe("Max rows (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ user_id, user_search, project_id, from, to, limit }, ctx) =>
    guarded(async () => {
      if (!ctx.isAuthenticated()) return errorResult("Not authenticated");

      const { scope, allowedUserIds } = await resolveScope(ctx);

      // Resolve user_search -> user_id when needed.
      let targetUserId = user_id;
      let resolvedUser: { id: string; first_name: string | null; last_name: string | null } | null =
        null;

      if (!targetUserId && user_search) {
        const matches = await searchUsers(user_search, allowedUserIds);
        if (matches.length === 0) {
          return errorResult(
            `No approved user matches "${user_search}" within your allowed scope (${scope}).`,
          );
        }
        if (matches.length > 1) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Multiple users match "${user_search}". Re-run with one of these user_id values:\n${JSON.stringify(matches, null, 2)}`,
              },
            ],
            structuredContent: { ambiguous: true, candidates: matches },
          };
        }
        targetUserId = matches[0].id;
        resolvedUser = matches[0];
      }

      if (targetUserId && allowedUserIds && !allowedUserIds.has(targetUserId)) {
        return errorResult("forbidden: user_id not in your allowed scope");
      }

      const admin = supabaseAdmin();
      let q = admin
        .from("activity_time_tracking")
        .select(
          "id, scheduled_date, actual_start_time, actual_end_time, notes, user_id, budget_item_id, budget_items:budget_item_id ( project_id, activity_name, category, projects:project_id ( name ) )",
        )
        .not("actual_start_time", "is", null)
        .not("actual_end_time", "is", null)
        .order("scheduled_date", { ascending: false })
        .limit(limit ?? 100);

      if (targetUserId) {
        q = q.eq("user_id", targetUserId);
      } else if (allowedUserIds) {
        q = q.in("user_id", Array.from(allowedUserIds));
      }
      if (from) q = q.gte("scheduled_date", from);
      if (to) q = q.lte("scheduled_date", to);

      const { data, error } = await q;
      if (error) return errorResult(error.message);

      type Item = {
        project_id: string | null;
        activity_name: string | null;
        category: string | null;
        projects: { name: string | null } | Array<{ name: string | null }> | null;
      };

      let rows = ((data ?? []) as unknown as Array<{
        id: string;
        scheduled_date: string | null;
        actual_start_time: string | null;
        actual_end_time: string | null;
        notes: string | null;
        user_id: string;
        budget_item_id: string;
        budget_items: Item | Item[] | null;
      }>).map((r) => {
        const bi = Array.isArray(r.budget_items) ? r.budget_items[0] ?? null : r.budget_items;
        const proj = bi && (Array.isArray(bi.projects) ? bi.projects[0] ?? null : bi.projects);
        return { ...r, budget_items: bi, project_name: proj?.name ?? null };
      });

      if (project_id) {
        rows = rows.filter((r) => r.budget_items?.project_id === project_id);
      }

      const entries = rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        project_id: r.budget_items?.project_id ?? null,
        project_name: r.project_name,
        budget_item_id: r.budget_item_id,
        activity_name: r.budget_items?.activity_name ?? null,
        category: r.budget_items?.category ?? null,
        scheduled_date: r.scheduled_date,
        actual_start_time: r.actual_start_time,
        actual_end_time: r.actual_end_time,
        hours: hoursBetween(r.actual_start_time, r.actual_end_time),
        notes: r.notes,
      }));

      const byProject = new Map<string, { project_id: string | null; project_name: string | null; hours: number; entries: number }>();
      for (const e of entries) {
        const key = e.project_id ?? "unknown";
        const cur = byProject.get(key) ?? {
          project_id: e.project_id,
          project_name: e.project_name,
          hours: 0,
          entries: 0,
        };
        cur.hours = Math.round((cur.hours + e.hours) * 100) / 100;
        cur.entries += 1;
        byProject.set(key, cur);
      }

      const summary = {
        scope,
        user_id: targetUserId ?? null,
        user_name: resolvedUser
          ? [resolvedUser.first_name, resolvedUser.last_name].filter(Boolean).join(" ")
          : null,
        from: from ?? null,
        to: to ?? null,
        entry_count: entries.length,
        total_hours: Math.round(entries.reduce((s, e) => s + e.hours, 0) * 100) / 100,
        truncated: entries.length >= (limit ?? 100),
        by_project: Array.from(byProject.values()).sort((a, b) => b.hours - a.hours),
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ summary, entries }, null, 2) },
        ],
        structuredContent: { summary, entries, scope },
      };
    }),
});

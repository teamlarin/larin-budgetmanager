import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  errorResult,
  guarded,
  resolveScope,
  supabaseAdmin,
  supabaseForUser,
} from "./_supabase";

/** Hours between two ISO timestamps, rounded to the nearest minute (dashboard-consistent). */
function hoursBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 60_000) / 60;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Monday (YYYY-MM-DD) of the week containing `date`. */
function weekStart(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export default defineTool({
  name: "list_project_time_entries",
  title: "List project time entries",
  description:
    "List confirmed time-tracking entries for a project, with person, planned activity, linked client (internal projects), hours and notes, plus aggregated summaries (total hours, per person, per activity, per week). Visibility: admins see everyone, team leaders only users in their areas, other roles only their own entries.",
  inputSchema: {
    project_id: z.string().uuid().describe("Project UUID."),
    from: z.string().optional().describe("Inclusive start date (YYYY-MM-DD)."),
    to: z.string().optional().describe("Inclusive end date (YYYY-MM-DD)."),
    user_id: z.string().uuid().optional().describe("Restrict to a single user UUID."),
    limit: z.number().int().min(1).max(2000).optional().describe("Max rows (default 500)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id, from, to, user_id, limit }, ctx) =>
    guarded(async () => {
      if (!ctx.isAuthenticated()) return errorResult("Not authenticated");

      // The project must be visible to the caller under RLS.
      const userClient = supabaseForUser(ctx);
      const { data: project, error: projErr } = await userClient
        .from("projects")
        .select("id, name, project_type, project_status, total_hours, total_budget")
        .eq("id", project_id)
        .maybeSingle();
      if (projErr) return errorResult(projErr.message);
      if (!project) return errorResult("Project not found or not accessible");

      const { scope, allowedUserIds } = await resolveScope(ctx);
      if (user_id && allowedUserIds && !allowedUserIds.has(user_id)) {
        return errorResult("forbidden: user_id not in your allowed scope");
      }

      const admin = supabaseAdmin();
      const { data: items, error: itemsErr } = await admin
        .from("budget_items")
        .select("id, activity_name, category, hourly_rate")
        .eq("project_id", project_id);
      if (itemsErr) return errorResult(itemsErr.message);

      const itemMap = new Map(
        ((items ?? []) as Array<{ id: string; activity_name: string | null; category: string | null; hourly_rate: number | null }>).map(
          (i) => [i.id, i],
        ),
      );
      const itemIds = Array.from(itemMap.keys());

      const maxRows = limit ?? 500;
      const rows: Array<{
        id: string;
        user_id: string;
        budget_item_id: string;
        scheduled_date: string | null;
        actual_start_time: string | null;
        actual_end_time: string | null;
        notes: string | null;
        client_id: string | null;
      }> = [];

      const idsBatchSize = 100;
      const pageSize = 1000;
      outer: for (let i = 0; i < itemIds.length; i += idsBatchSize) {
        const chunk = itemIds.slice(i, i + idsBatchSize);
        let offset = 0;
        while (true) {
          let q = admin
            .from("activity_time_tracking")
            .select(
              "id, user_id, budget_item_id, scheduled_date, actual_start_time, actual_end_time, notes, client_id",
            )
            .in("budget_item_id", chunk)
            .not("actual_start_time", "is", null)
            .not("actual_end_time", "is", null)
            .order("id", { ascending: true })
            .range(offset, offset + pageSize - 1);
          if (from) q = q.gte("scheduled_date", from);
          if (to) q = q.lte("scheduled_date", to);
          if (user_id) q = q.eq("user_id", user_id);
          else if (allowedUserIds) q = q.in("user_id", Array.from(allowedUserIds));

          const { data: batch, error } = await q;
          if (error) return errorResult(error.message);
          const page = (batch ?? []) as typeof rows;
          rows.push(...page);
          if (rows.length >= maxRows) break outer;
          if (page.length < pageSize) break;
          offset += pageSize;
        }
      }

      const trimmed = rows.slice(0, maxRows);

      // Resolve people names in one shot.
      const userIds = Array.from(new Set(trimmed.map((r) => r.user_id)));
      const nameById = new Map<string, string | null>();
      if (userIds.length > 0) {
        const { data: profs } = await admin
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", userIds);
        for (const p of (profs ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>) {
          nameById.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || null);
        }
      }

      const entries = trimmed.map((r) => {
        const item = itemMap.get(r.budget_item_id);
        return {
          id: r.id,
          user_id: r.user_id,
          user_name: nameById.get(r.user_id) ?? null,
          budget_item_id: r.budget_item_id,
          activity_name: item?.activity_name ?? null,
          category: item?.category ?? null,
          client_id: r.client_id ?? null,
          scheduled_date: r.scheduled_date,
          actual_start_time: r.actual_start_time,
          actual_end_time: r.actual_end_time,
          hours: round2(hoursBetween(r.actual_start_time, r.actual_end_time)),
          cost: round2(
            hoursBetween(r.actual_start_time, r.actual_end_time) * Number(item?.hourly_rate ?? 0),
          ),
          notes: r.notes,
        };
      });

      function group<K extends string>(keyOf: (e: typeof entries[number]) => K, labelOf: (e: typeof entries[number]) => string | null) {
        const map = new Map<string, { key: string; label: string | null; hours: number; entries: number }>();
        for (const e of entries) {
          const key = keyOf(e) ?? "unknown";
          const cur = map.get(key) ?? { key, label: labelOf(e), hours: 0, entries: 0 };
          cur.hours = round2(cur.hours + e.hours);
          cur.entries += 1;
          map.set(key, cur);
        }
        return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
      }

      const totalHours = round2(entries.reduce((s, e) => s + e.hours, 0));
      const totalCost = round2(entries.reduce((s, e) => s + e.cost, 0));

      const summary = {
        scope,
        project: project,
        from: from ?? null,
        to: to ?? null,
        entry_count: entries.length,
        total_hours: totalHours,
        total_hours_formatted: `${Math.floor(totalHours)}h ${Math.round((totalHours % 1) * 60)}m`,
        total_cost: totalCost,
        truncated: entries.length >= maxRows,
        by_user: group((e) => e.user_id as string, (e) => e.user_name),
        by_activity: group((e) => e.budget_item_id as string, (e) => e.activity_name),
        by_week: Array.from(
          entries.reduce((map, e) => {
            const wk = weekStart(e.scheduled_date) ?? "unknown";
            map.set(wk, round2((map.get(wk) ?? 0) + e.hours));
            return map;
          }, new Map<string, number>()),
        )
          .map(([week_start, hours]) => ({ week_start, hours }))
          .sort((a, b) => a.week_start.localeCompare(b.week_start)),
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ summary, entries }, null, 2) }],
        structuredContent: { summary, entries },
      };
    }),
});

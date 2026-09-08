import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, guarded, supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_project_tasks",
  title: "List project tasks",
  description:
    "List operational tasks of a project (RLS applied): title, status, priority, start/due dates, estimated hours, assignees and the linked planned activity. Filter by status, priority or due date window.",
  inputSchema: {
    project_id: z.string().uuid().describe("Project UUID."),
    status: z
      .string()
      .optional()
      .describe("Filter by status (backlog, todo, in_progress, done, blocked — as stored)."),
    priority: z.string().optional().describe("Filter by priority (high, normal, low — as stored)."),
    due_before: z.string().optional().describe("Only tasks with due_date on/before this date (YYYY-MM-DD)."),
    due_after: z.string().optional().describe("Only tasks with due_date on/after this date (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(300).optional().describe("Max rows (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id, status, priority, due_before, due_after, limit }, ctx) =>
    guarded(async () => {
      if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
      const supabase = supabaseForUser(ctx);

      let q = supabase
        .from("project_tasks")
        .select(
          `id, title, description, status, priority, start_date, due_date, estimated_hours,
           completed_at, created_at, budget_item_id,
           budget_items:budget_item_id ( activity_name, category ),
           project_task_assignees ( user_id, profiles:user_id ( first_name, last_name ) )`,
        )
        .eq("project_id", project_id)
        .order("due_date", { ascending: true })
        .limit(limit ?? 100);

      if (status) q = q.eq("status", status);
      if (priority) q = q.eq("priority", priority);
      if (due_before) q = q.lte("due_date", due_before);
      if (due_after) q = q.gte("due_date", due_after);

      const { data, error } = await q;
      if (error) return errorResult(error.message);

      type Assignee = {
        user_id: string;
        profiles: { first_name: string | null; last_name: string | null } | Array<{ first_name: string | null; last_name: string | null }> | null;
      };

      const tasks = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((t) => {
        const bi = Array.isArray(t.budget_items) ? t.budget_items[0] : t.budget_items;
        const item = bi as { activity_name?: string | null; category?: string | null } | null;
        const assignees = ((t.project_task_assignees ?? []) as Assignee[]).map((a) => {
          const p = Array.isArray(a.profiles) ? a.profiles[0] ?? null : a.profiles;
          return {
            user_id: a.user_id,
            name: p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || null : null,
          };
        });
        return {
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          start_date: t.start_date,
          due_date: t.due_date,
          estimated_hours: t.estimated_hours,
          completed_at: t.completed_at,
          created_at: t.created_at,
          budget_item_id: t.budget_item_id,
          activity_name: item?.activity_name ?? null,
          activity_category: item?.category ?? null,
          assignees,
        };
      });

      const byStatus = new Map<string, number>();
      for (const t of tasks) {
        const key = String(t.status ?? "unknown");
        byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
      }

      const summary = {
        project_id,
        task_count: tasks.length,
        by_status: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
        truncated: tasks.length >= (limit ?? 100),
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ summary, tasks }, null, 2) }],
        structuredContent: { summary, tasks },
      };
    }),
});

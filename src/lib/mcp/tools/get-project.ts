import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, guarded, supabaseForUser } from "./_supabase";

type Person = { id?: string; first_name: string | null; last_name: string | null } | null;

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function name(p: Person | Person[] | null | undefined): string | null {
  const r = one(p as Person[] | Person);
  if (!r) return null;
  return [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default defineTool({
  name: "get_project",
  title: "Get project",
  description:
    "Fetch a full project card by id (RLS applied): type, area, discipline, status, progress, dates, economics (budget, hours, discount, margin, additional costs), client and contact, leader/account, team members, planned activities, external links (Drive, Slack, quote number) and the latest progress updates.",
  inputSchema: {
    id: z.string().uuid().describe("Project UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) =>
    guarded(async () => {
      if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
      const supabase = supabaseForUser(ctx);

      const { data: p, error } = await supabase
        .from("projects")
        .select(
          `id, name, description, objective, secondary_objective, project_type, project_status,
           area, discipline, progress, start_date, end_date, created_at, updated_at, status_changed_at,
           total_budget, total_hours, discount_percentage, margin_percentage, manual_activities_budget,
           is_billable, billing_type, payment_terms, manual_quote_number, brief_link,
           drive_folder_id, drive_folder_name, slack_channel_id, slack_channel_name,
           client_id, clients:client_id ( id, name ),
           client_contacts:client_contact_id ( id, first_name, last_name, email ),
           leader:project_leader_id ( id, first_name, last_name ),
           account:account_user_id ( id, first_name, last_name ),
           assigned:assigned_user_id ( id, first_name, last_name )`,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!p) return errorResult("Project not found or not accessible");

      const row = p as unknown as Record<string, unknown>;

      const [membersRes, itemsRes, costsRes, updatesRes, tasksRes] = await Promise.all([
        supabase
          .from("project_members")
          .select("user_id, profiles:user_id ( first_name, last_name )")
          .eq("project_id", id),
        supabase
          .from("budget_items")
          .select("id, activity_name, category, hours_worked, hourly_rate, total_cost, assignee_name, is_product")
          .eq("project_id", id)
          .order("display_order", { ascending: true }),
        supabase.from("project_additional_costs").select("name, amount").eq("project_id", id),
        supabase
          .from("project_progress_updates")
          .select("progress_value, update_text, roadblocks_text, created_at, user_id")
          .eq("project_id", id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("project_tasks").select("id, status, due_date").eq("project_id", id),
      ]);

      for (const r of [membersRes, itemsRes, costsRes, updatesRes, tasksRes]) {
        if (r.error) return errorResult(r.error.message);
      }

      const items = (itemsRes.data ?? []) as Array<{
        id: string;
        activity_name: string | null;
        category: string | null;
        hours_worked: number | null;
        hourly_rate: number | null;
        total_cost: number | null;
        assignee_name: string | null;
        is_product: boolean | null;
      }>;
      const additionalCosts = (costsRes.data ?? []) as Array<{ name: string | null; amount: number | null }>;
      const tasks = (tasksRes.data ?? []) as Array<{ id: string; status: string | null; due_date: string | null }>;

      const plannedHours = round2(items.reduce((s, i) => s + Number(i.hours_worked ?? 0), 0));
      const plannedCost = round2(items.reduce((s, i) => s + Number(i.total_cost ?? 0), 0));
      const additionalCostsTotal = round2(
        additionalCosts.reduce((s, c) => s + Number(c.amount ?? 0), 0),
      );

      const project = {
        identity: {
          id: row.id,
          name: row.name,
          description: row.description,
          objective: row.objective,
          secondary_objective: row.secondary_objective,
          project_type: row.project_type,
          area: row.area,
          discipline: row.discipline,
          status: row.project_status,
          progress: row.progress,
        },
        dates: {
          start_date: row.start_date,
          end_date: row.end_date,
          created_at: row.created_at,
          updated_at: row.updated_at,
          status_changed_at: row.status_changed_at,
        },
        economics: {
          total_budget: row.total_budget,
          total_hours: row.total_hours,
          planned_hours_from_activities: plannedHours,
          planned_cost_from_activities: plannedCost,
          manual_activities_budget: row.manual_activities_budget,
          discount_percentage: row.discount_percentage,
          margin_percentage: row.margin_percentage,
          additional_costs_total: additionalCostsTotal,
          additional_costs: additionalCosts,
          is_billable: row.is_billable,
          billing_type: row.billing_type,
          payment_terms: row.payment_terms,
        },
        people: {
          client: one(row.clients as never),
          client_contact: (() => {
            const c = one(row.client_contacts as never) as
              | { id: string; first_name: string | null; last_name: string | null; email: string | null }
              | null;
            return c ? { id: c.id, name: name(c as Person), email: c.email } : null;
          })(),
          project_leader: name(row.leader as never),
          account: name(row.account as never),
          assigned_user: name(row.assigned as never),
          members: ((membersRes.data ?? []) as Array<{ user_id: string; profiles: Person | Person[] }>).map(
            (m) => ({ user_id: m.user_id, name: name(m.profiles) }),
          ),
        },
        activities: items.map((i) => ({
          id: i.id,
          activity_name: i.activity_name,
          category: i.category,
          planned_hours: i.hours_worked,
          hourly_rate: i.hourly_rate,
          total_cost: i.total_cost,
          assignee_name: i.assignee_name,
          is_product: i.is_product,
        })),
        tasks_overview: {
          total: tasks.length,
          open: tasks.filter((t) => t.status !== "done" && t.status !== "completato").length,
          overdue: tasks.filter(
            (t) =>
              t.due_date &&
              t.status !== "done" &&
              t.status !== "completato" &&
              t.due_date < new Date().toISOString().slice(0, 10),
          ).length,
        },
        links: {
          brief_link: row.brief_link,
          drive_folder_id: row.drive_folder_id,
          drive_folder_name: row.drive_folder_name,
          slack_channel_id: row.slack_channel_id,
          slack_channel_name: row.slack_channel_name,
          quote_number: row.manual_quote_number,
        },
        recent_progress_updates: updatesRes.data ?? [],
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }],
        structuredContent: { project },
      };
    }),
});

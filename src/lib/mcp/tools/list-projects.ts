import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, guarded, supabaseForUser } from "./_supabase";

type Ref = { id?: string | null; name?: string | null } | null;
type MaybeArr<T> = T | T[] | null;

function one<T>(v: MaybeArr<T>): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function personName(p: MaybeArr<{ first_name: string | null; last_name: string | null }>) {
  const r = one(p);
  if (!r) return null;
  const n = [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
  return n || null;
}

export default defineTool({
  name: "list_projects",
  title: "List projects",
  description:
    "List projects visible to the signed-in user (RLS applied), with type, dates, budget, hours, progress, client, leader and billing metadata. Supports filtering by status, area, project type, client, name search and an activity date window.",
  inputSchema: {
    status: z
      .string()
      .optional()
      .describe("Filter by project_status (aperto, in_partenza, da_fatturare, completato)."),
    area: z
      .string()
      .optional()
      .describe("Filter by area (marketing, tech, branding, sales, ai, struttura, interno)."),
    project_type: z
      .string()
      .optional()
      .describe("Filter by project_type (e.g. pack, recurring, one_shot)."),
    client_id: z.string().uuid().optional().describe("Filter by client UUID."),
    search: z.string().optional().describe("Case-insensitive substring match on project name."),
    active_from: z
      .string()
      .optional()
      .describe("Only projects whose end_date is on/after this date (YYYY-MM-DD)."),
    active_to: z
      .string()
      .optional()
      .describe("Only projects whose start_date is on/before this date (YYYY-MM-DD)."),
    order_by: z
      .enum(["updated_at", "start_date", "end_date", "name"])
      .optional()
      .describe("Sort field (default updated_at, descending)."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (
    { status, area, project_type, client_id, search, active_from, active_to, order_by, limit },
    ctx,
  ) =>
    guarded(async () => {
      if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
      const supabase = supabaseForUser(ctx);
      const orderField = order_by ?? "updated_at";
      let query = supabase
        .from("projects")
        .select(
          `id, name, project_type, project_status, area, discipline, progress,
           start_date, end_date, created_at, status_changed_at, updated_at,
           total_budget, total_hours, margin_percentage, discount_percentage,
           is_billable, billing_type, manual_quote_number,
           client_id, clients:client_id ( id, name ),
           client_contacts:client_contact_id ( id, first_name, last_name ),
           leader:project_leader_id ( id, first_name, last_name ),
           account:account_user_id ( id, first_name, last_name )`,
        )
        .order(orderField, { ascending: orderField === "name" })
        .limit(limit ?? 50);

      if (status) query = query.eq("project_status", status);
      if (area) query = query.eq("area", area);
      if (project_type) query = query.eq("project_type", project_type);
      if (client_id) query = query.eq("client_id", client_id);
      if (search) query = query.ilike("name", `%${search}%`);
      if (active_from) query = query.or(`end_date.gte.${active_from},end_date.is.null`);
      if (active_to) query = query.or(`start_date.lte.${active_to},start_date.is.null`);

      const { data, error } = await query;
      if (error) return errorResult(error.message);

      const projects = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((p) => ({
        id: p.id,
        name: p.name,
        project_type: p.project_type,
        status: p.project_status,
        area: p.area,
        discipline: p.discipline,
        progress: p.progress,
        start_date: p.start_date,
        end_date: p.end_date,
        created_at: p.created_at,
        status_changed_at: p.status_changed_at,
        updated_at: p.updated_at,
        total_budget: p.total_budget,
        total_hours: p.total_hours,
        margin_percentage: p.margin_percentage,
        discount_percentage: p.discount_percentage,
        is_billable: p.is_billable,
        billing_type: p.billing_type,
        quote_number: p.manual_quote_number,
        client: one(p.clients as MaybeArr<Ref>),
        client_contact_name: personName(
          p.client_contacts as MaybeArr<{ first_name: string | null; last_name: string | null }>,
        ),
        project_leader_name: personName(
          p.leader as MaybeArr<{ first_name: string | null; last_name: string | null }>,
        ),
        account_name: personName(
          p.account as MaybeArr<{ first_name: string | null; last_name: string | null }>,
        ),
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(projects, null, 2) }],
        structuredContent: { projects, count: projects.length },
      };
    }),
});

import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

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

// Duration in hours between two ISO timestamps, guarding against negatives.
function hoursBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / 3_600_000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default defineTool({
  name: "get_project_summary",
  title: "Get project summary",
  description:
    "Return a summary of a project (visible to the signed-in user via RLS): planned budget and hours, confirmed hours and cost from time tracking, plus additional costs. Numbers reflect only rows the caller is allowed to see.",
  inputSchema: {
    id: z.string().uuid().describe("Project UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    // 1. Project + client
    const { data: project, error: projectErr } = await supabase
      .from("projects")
      .select(
        "id, name, area, project_status, start_date, end_date, total_budget, total_hours, client_id, clients:client_id (id, name)",
      )
      .eq("id", id)
      .maybeSingle();
    if (projectErr) {
      return { content: [{ type: "text", text: projectErr.message }], isError: true };
    }
    if (!project) {
      return {
        content: [{ type: "text", text: "Project not found or not accessible" }],
        isError: true,
      };
    }

    // 2. Budget items (planned)
    const { data: items, error: itemsErr } = await supabase
      .from("budget_items")
      .select("id, activity_name, category, hourly_rate, hours_worked, total_cost")
      .eq("project_id", id);
    if (itemsErr) {
      return { content: [{ type: "text", text: itemsErr.message }], isError: true };
    }
    const budgetItems = items ?? [];
    const plannedHours = budgetItems.reduce((s, it) => s + Number(it.hours_worked ?? 0), 0);
    const plannedCost = budgetItems.reduce((s, it) => s + Number(it.total_cost ?? 0), 0);
    const rateById = new Map<string, number>(
      budgetItems.map((it) => [it.id as string, Number(it.hourly_rate ?? 0)]),
    );
    const itemIds = budgetItems.map((it) => it.id as string);

    // 3. Time tracking, paginated in 100-id chunks with .range() to bypass the
    //    1000-row default limit (matches existing patterns in this codebase).
    const timeEntries: Array<{
      budget_item_id: string;
      user_id: string;
      actual_start_time: string | null;
      actual_end_time: string | null;
    }> = [];
    const idsBatchSize = 100;
    const pageSize = 1000;
    for (let i = 0; i < itemIds.length; i += idsBatchSize) {
      const chunk = itemIds.slice(i, i + idsBatchSize);
      let offset = 0;
      while (true) {
        const { data: batch, error: ttErr } = await supabase
          .from("activity_time_tracking")
          .select("budget_item_id, user_id, actual_start_time, actual_end_time")
          .in("budget_item_id", chunk)
          .not("actual_start_time", "is", null)
          .not("actual_end_time", "is", null)
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (ttErr) {
          return { content: [{ type: "text", text: ttErr.message }], isError: true };
        }
        const rows = batch ?? [];
        timeEntries.push(...(rows as typeof timeEntries));
        if (rows.length < pageSize) break;
        offset += pageSize;
      }
    }

    let confirmedHoursTotal = 0;
    let confirmedCostTotal = 0;
    let confirmedHoursMe = 0;
    let confirmedCostMe = 0;
    const meId = ctx.getUserId();
    for (const e of timeEntries) {
      const h = hoursBetween(e.actual_start_time, e.actual_end_time);
      if (h === 0) continue;
      const rate = rateById.get(e.budget_item_id) ?? 0;
      const cost = h * rate;
      confirmedHoursTotal += h;
      confirmedCostTotal += cost;
      if (e.user_id === meId) {
        confirmedHoursMe += h;
        confirmedCostMe += cost;
      }
    }

    // 4. Additional costs
    const { data: extraCosts, error: extraErr } = await supabase
      .from("project_additional_costs")
      .select("amount")
      .eq("project_id", id);
    if (extraErr) {
      return { content: [{ type: "text", text: extraErr.message }], isError: true };
    }
    const additionalCosts = (extraCosts ?? []).reduce(
      (s, c) => s + Number(c.amount ?? 0),
      0,
    );

    const totalBudget = Number(project.total_budget ?? 0);
    const totalActualCost = confirmedCostTotal + additionalCosts;
    const residualBudget = totalBudget - totalActualCost;
    const budgetUsedPct = totalBudget > 0 ? (totalActualCost / totalBudget) * 100 : null;
    const hoursUsedPct =
      plannedHours > 0 ? (confirmedHoursTotal / plannedHours) * 100 : null;

    const summary = {
      project: {
        id: project.id,
        name: project.name,
        area: project.area,
        status: project.project_status,
        start_date: project.start_date,
        end_date: project.end_date,
        client: project.clients ?? null,
      },
      planned: {
        total_budget: round2(totalBudget),
        total_hours: round2(plannedHours),
        total_cost: round2(plannedCost),
        activities_count: budgetItems.length,
      },
      confirmed: {
        hours: round2(confirmedHoursTotal),
        cost: round2(confirmedCostTotal),
        entries_count: timeEntries.length,
      },
      my_contribution: {
        hours: round2(confirmedHoursMe),
        cost: round2(confirmedCostMe),
      },
      additional_costs: round2(additionalCosts),
      totals: {
        total_actual_cost: round2(totalActualCost),
        residual_budget: round2(residualBudget),
        budget_used_pct: budgetUsedPct === null ? null : round2(budgetUsedPct),
        hours_used_pct: hoursUsedPct === null ? null : round2(hoursUsedPct),
      },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});

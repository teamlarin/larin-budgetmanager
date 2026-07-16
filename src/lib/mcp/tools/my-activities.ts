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

export default defineTool({
  name: "list_my_time_entries",
  title: "List my time entries",
  description:
    "List time-tracking entries recorded by the signed-in user, optionally within a date range. Uses RLS so only the caller's data is returned.",
  inputSchema: {
    from: z.string().optional().describe("Inclusive start date (YYYY-MM-DD)."),
    to: z.string().optional().describe("Inclusive end date (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(500).optional().describe("Max rows (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("activity_time_tracking")
      .select("id, scheduled_date, actual_start_time, actual_end_time, notes, budget_item_id, user_id")
      .eq("user_id", ctx.getUserId())
      .order("scheduled_date", { ascending: false })
      .limit(limit ?? 100);
    if (from) q = q.gte("scheduled_date", from);
    if (to) q = q.lte("scheduled_date", to);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { entries: data ?? [] },
    };
  },
});

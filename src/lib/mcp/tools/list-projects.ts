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
  name: "list_projects",
  title: "List projects",
  description:
    "List projects visible to the signed-in user (RLS applied). Supports filtering by status and free-text search on project name.",
  inputSchema: {
    status: z
      .string()
      .optional()
      .describe("Filter by project_status (e.g. approvato, in_corso, completato)."),
    search: z.string().optional().describe("Case-insensitive substring match on project name."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("projects")
      .select("id, name, project_status, area, start_date, end_date, client_id, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 50);
    if (status) query = query.eq("project_status", status);
    if (search) query = query.ilike("name", `%${search}%`);
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { projects: data ?? [] },
    };
  },
});

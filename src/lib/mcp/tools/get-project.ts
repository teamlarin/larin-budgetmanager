import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, guarded, supabaseForUser } from "./_supabase";


export default defineTool({
  name: "get_project",
  title: "Get project",
  description: "Fetch a single project by id, with its client and basic metadata (RLS applied).",
  inputSchema: {
    id: z.string().uuid().describe("Project UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("projects")
      .select("*, clients:client_id (id, name)")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (!data) {
      return { content: [{ type: "text", text: "Project not found or not accessible" }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { project: data },
    };
  },
});

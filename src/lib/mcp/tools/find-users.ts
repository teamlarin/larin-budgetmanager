import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, guarded, resolveScope, searchUsers } from "./_supabase";

export default defineTool({
  name: "find_users",
  title: "Find users",
  description:
    "Search approved TimeTrap users by name or email and return their UUIDs. Use this first to resolve a person's name into a user_id before calling list_time_entries. Admins can search everyone; team leaders only users in their areas; other roles only themselves.",
  inputSchema: {
    query: z.string().describe("Name, surname, full name or email fragment (case-insensitive)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query }, ctx) =>
    guarded(async () => {
      if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
      const { scope, allowedUserIds } = await resolveScope(ctx);
      const users = await searchUsers(query, allowedUserIds);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(users, null, 2) }],
        structuredContent: { users, scope, count: users.length },
      };
    }),
});

import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import myTimeEntriesTool from "./tools/my-activities";
import listTimeEntriesTool from "./tools/list-time-entries";
import projectSummaryTool from "./tools/project-summary";
import findUsersTool from "./tools/find-users";

// Direct supabase.co issuer, built from the project ref (never SUPABASE_URL,
// which may be a lovable.cloud proxy that mcp-js rejects during RFC 8414
// discovery). The fallback keeps the issuer well-formed during the
// build-time manifest-extract eval.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "timetrap-mcp",
  title: "TimeTrap MCP",
  version: "0.1.0",
  instructions:
    "Tools for TimeTrap (Larin Budget Manager). To analyse a specific person's hours, first call find_users with their name to get their user_id, then call list_time_entries with that user_id (or pass user_search directly). Use list_projects to browse projects the signed-in user can see, get_project / get_project_summary for details, and list_my_time_entries for the caller's own timesheet.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    // Also accept plain Supabase session tokens (no `client_id` claim) so the
    // API-key proxy function `mcp-key` can serve clients without OAuth support.
    requireOAuthClientClaim: false,
  }),
  tools: [
    listProjectsTool,
    getProjectTool,
    myTimeEntriesTool,
    listTimeEntriesTool,
    projectSummaryTool,
    findUsersTool,
  ],
});


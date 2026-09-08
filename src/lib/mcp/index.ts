import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import myTimeEntriesTool from "./tools/my-activities";
import listTimeEntriesTool from "./tools/list-time-entries";
import projectSummaryTool from "./tools/project-summary";
import findUsersTool from "./tools/find-users";
import projectTimeEntriesTool from "./tools/project-time-entries";
import projectTasksTool from "./tools/project-tasks";


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
    "Tools for TimeTrap (Larin Budget Manager). Projects: use list_projects to browse (filters: status, area, project_type, client_id, name search, activity date window), get_project for the full project card (type, dates, economics, client, team, planned activities, links, latest progress updates) and get_project_summary for planned-vs-confirmed budget and hours. Time: list_project_time_entries for all confirmed hours on a project (per person, per activity, per week), list_time_entries for a specific person (call find_users first to resolve a name into user_id, or pass user_search), list_my_time_entries for the caller's own timesheet. Tasks: list_project_tasks for a project's operational tasks with status, priority, due dates and assignees. Visibility always follows the caller's role: admins see everything, team leaders their areas, other roles only their own data.",
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
    projectSummaryTool,
    projectTimeEntriesTool,
    projectTasksTool,
    myTimeEntriesTool,
    listTimeEntriesTool,
    findUsersTool,
  ],

});


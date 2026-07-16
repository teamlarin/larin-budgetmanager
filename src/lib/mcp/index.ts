import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import myTimeEntriesTool from "./tools/my-activities";

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
    "Tools for TimeTrap (Larin Budget Manager). Use list_projects to browse projects the signed-in user can see, get_project for details, and list_my_time_entries to inspect the caller's own timesheet entries.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjectsTool, getProjectTool, myTimeEntriesTool],
});

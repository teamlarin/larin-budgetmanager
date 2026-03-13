import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface CommitData {
  message: string;
  author?: string;
}

interface WebhookPayload {
  commits: CommitData[];
  version?: string;
}

const PREFIX_CATEGORY_MAP: Record<string, string> = {
  feat: "feature",
  fix: "bugfix",
  perf: "improvement",
  refactor: "improvement",
  chore: "maintenance",
  ci: "maintenance",
  build: "maintenance",
};

function parseCommitMessage(message: string): {
  category: string;
  title: string;
} | null {
  // Match conventional commit format: type(scope): description or type: description
  const match = message.match(
    /^(feat|fix|perf|refactor|chore|ci|build)(?:\(.+?\))?:\s*(.+)/i
  );
  if (!match) return null;

  const prefix = match[1].toLowerCase();
  const title = match[2].trim();
  const category = PREFIX_CATEGORY_MAP[prefix] || "feature";

  return { category, title };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret
    const webhookSecret = Deno.env.get("CHANGELOG_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret");

    if (!webhookSecret || providedSecret !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: WebhookPayload = await req.json();

    if (!payload.commits || !Array.isArray(payload.commits)) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: commits array required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const entries: Array<{
      title: string;
      description: string;
      category: string;
      version: string | null;
    }> = [];

    for (const commit of payload.commits) {
      const parsed = parseCommitMessage(commit.message);
      if (!parsed) continue;

      entries.push({
        title: parsed.title.charAt(0).toUpperCase() + parsed.title.slice(1),
        description: commit.message,
        category: parsed.category,
        version: payload.version || null,
      });
    }

    if (entries.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No conventional commits found",
          inserted: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data, error } = await supabase.from("changelog").insert(entries);

    if (error) {
      console.error("Insert error:", error);
      throw error;
    }

    console.log(`Inserted ${entries.length} changelog entries`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted: entries.length,
        entries: entries.map((e) => ({ title: e.title, category: e.category })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Changelog webhook error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

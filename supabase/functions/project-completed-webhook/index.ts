import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProjectCompletedPayload {
  project_id: string;
  project_name: string;
  client_name?: string;
  account_name?: string;
  project_leader_name?: string;
  contact_first_name?: string;
  contact_last_name?: string;
  contact_email?: string;
  completed_at: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { project_id } = await req.json();

    if (!project_id) {
      return new Response(
        JSON.stringify({ error: "project_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing project completed webhook for project:", project_id);

    // Fetch the webhook URL from app_settings
    const { data: webhookSetting, error: settingError } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "make_webhook_project_completed")
      .maybeSingle();

    if (settingError) {
      console.error("Error fetching webhook setting:", settingError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch webhook setting" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!webhookSetting?.setting_value?.url) {
      console.log("No webhook URL configured, skipping");
      return new Response(
        JSON.stringify({ message: "No webhook URL configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookUrl = webhookSetting.setting_value.url;

    // Fetch project details with client and contact info
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        id,
        name,
        account_user_id,
        project_leader_id,
        status_changed_at,
        client:clients(name),
        contact:client_contacts(first_name, last_name, email)
      `)
      .eq("id", project_id)
      .single();

    if (projectError || !project) {
      console.error("Error fetching project:", projectError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch project details" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch account user name if available
    let accountName: string | undefined;
    if (project.account_user_id) {
      const { data: accountUser } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", project.account_user_id)
        .single();
      
      if (accountUser) {
        accountName = `${accountUser.first_name || ""} ${accountUser.last_name || ""}`.trim();
      }
    }

    // Fetch project leader name if available
    let projectLeaderName: string | undefined;
    if (project.project_leader_id) {
      const { data: leaderUser } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", project.project_leader_id)
        .single();
      
      if (leaderUser) {
        projectLeaderName = `${leaderUser.first_name || ""} ${leaderUser.last_name || ""}`.trim();
      }
    }

    // Build payload for Make
    const payload: ProjectCompletedPayload = {
      project_id: project.id,
      project_name: project.name,
      client_name: project.client?.name || undefined,
      account_name: accountName,
      project_leader_name: projectLeaderName,
      contact_first_name: project.contact?.first_name || undefined,
      contact_last_name: project.contact?.last_name || undefined,
      contact_email: project.contact?.email || undefined,
      completed_at: project.status_changed_at || new Date().toISOString(),
    };

    console.log("Sending payload to Make webhook:", webhookUrl);

    // Send to Make webhook
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error("Make webhook error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to send to Make webhook", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully sent to Make webhook");

    return new Response(
      JSON.stringify({ success: true, message: "Webhook sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in project-completed-webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

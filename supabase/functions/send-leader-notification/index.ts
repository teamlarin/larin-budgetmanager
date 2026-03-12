import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from '../_shared/mandrill.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LeaderNotificationRequest {
  user_id: string;
  project_id: string;
  project_name: string;
  client_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError && !authHeader.includes(supabaseServiceKey)) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { user_id, project_id, project_name, client_name }: LeaderNotificationRequest = await req.json();

    console.log("Sending leader notification for project:", project_name, "to user:", user_id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", user_id)
      .single();

    if (profileError || !profile?.email) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userName = profile.first_name 
      ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`
      : 'Utente';

    const clientInfo = client_name ? ` per il cliente ${client_name}` : '';

    const emailResponse = await sendEmail({
      from_email: 'noreply@timetrap.it',
      from_name: 'Budget Manager',
      to: [profile.email],
      subject: `Sei stato assegnato come Project Leader: ${project_name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .project-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .badge { display: inline-block; background: #667eea; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>👑 Nuovo Progetto Assegnato</h1>
            </div>
            <div class="content">
              <p>Ciao <strong>${userName}</strong>,</p>
              <p>Sei stato assegnato come <strong>Project Leader</strong> per un nuovo progetto${clientInfo}.</p>
              
              <div class="project-card">
                <span class="badge">Project Leader</span>
                <h2 style="margin: 10px 0 5px 0;">${project_name}</h2>
                ${client_name ? `<p style="margin: 0; color: #666;">Cliente: ${client_name}</p>` : ''}
              </div>
              
              <p>In qualità di Project Leader, sarai responsabile della gestione e del coordinamento delle attività del progetto.</p>
              
              <p>Accedi alla piattaforma per visualizzare i dettagli del progetto e iniziare a pianificare le attività.</p>
              
              <div class="footer">
                <p>Budget Manager - Gestione Progetti</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-leader-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BudgetNotificationRequest {
  projectId: string;
  projectName: string;
  status: string;
  clientName?: string;
  creatorName?: string;
  totalBudget?: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, projectName, status, clientName, creatorName, totalBudget }: BudgetNotificationRequest = await req.json();

    console.log("Sending notification for project:", projectId, "status:", status);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get project details including account user
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("account_user_id, total_budget, total_hours")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      console.error("Error fetching project:", projectError);
      throw new Error("Project not found");
    }

    // Get account user's profile with email
    const { data: accountProfile, error: profileError } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", project.account_user_id)
      .single();

    if (profileError || !accountProfile || !accountProfile.email) {
      console.error("Error fetching account profile:", profileError);
      throw new Error("Account user not found or email missing");
    }

    const accountName = `${accountProfile.first_name} ${accountProfile.last_name}`.trim();

    // Determine email content based on status
    let subject = "";
    let htmlContent = "";

    if (status === "nuovo_budget") {
      subject = `Nuovo budget per ${projectName}`;
      const budgetLink = `${Deno.env.get("SITE_URL") || "https://dmwyqyqaseyuybqfawvk.supabase.co"}/budget/${projectId}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Questo è un messaggio automatico.</p>
          <p>È stato generato un nuovo budget per la seguente iniziativa:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Progetto:</strong> ${projectName}</p>
            <p><strong>Cliente:</strong> ${clientName || 'Non specificato'}</p>
            <p><strong>Creato da:</strong> ${creatorName || accountName}</p>
            <p><strong>Importo:</strong> ${totalBudget?.toFixed(2) || '0.00'} €</p>
          </div>
          <p>Il budget è visibile qui: <a href="${budgetLink}" style="color: #2754C5;">${budgetLink}</a></p>
          <p style="color: #898989; font-size: 12px; margin-top: 20px;">
            Si prega di non rispondere a questa email. Per assistenza, contattare <a href="mailto:assistenza@larin.it" style="color: #2754C5;">assistenza@larin.it</a>
          </p>
        </div>
      `;
    } else if (status === "approvato") {
      subject = `Budget Approvato: ${projectName}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #22c55e;">✓ Budget Approvato</h1>
          <p>Ciao ${accountName},</p>
          <p>Il budget per il progetto <strong>${projectName}</strong> è stato approvato.</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Dettagli Budget</h2>
            <p><strong>Importo Totale:</strong> ${project.total_budget.toFixed(2)} €</p>
            <p><strong>Ore Totali:</strong> ${project.total_hours.toFixed(1)}h</p>
          </div>
          <p>Puoi procedere con le attività previste nel progetto.</p>
          <p>Cordiali saluti,<br>Il Team Budget Manager</p>
        </div>
      `;
    } else if (status === "rifiutato") {
      subject = `Budget Rifiutato: ${projectName}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ef4444;">✗ Budget Rifiutato</h1>
          <p>Ciao ${accountName},</p>
          <p>Il budget per il progetto <strong>${projectName}</strong> è stato rifiutato.</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Dettagli Budget</h2>
            <p><strong>Importo Proposto:</strong> ${project.total_budget.toFixed(2)} €</p>
            <p><strong>Ore Proposte:</strong> ${project.total_hours.toFixed(1)}h</p>
          </div>
          <p>Ti consigliamo di rivedere il budget e apportare le modifiche necessarie.</p>
          <p>Cordiali saluti,<br>Il Team Budget Manager</p>
        </div>
      `;
    }

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Budget Manager <onboarding@resend.dev>",
      to: [accountProfile.email],
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-budget-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

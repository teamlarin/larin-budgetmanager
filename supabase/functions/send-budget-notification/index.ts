import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from '../_shared/mandrill.ts';

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Authenticated user:", user.id);

    const { projectId, projectName, status, clientName, creatorName, totalBudget }: BudgetNotificationRequest = await req.json();

    console.log("Sending notification for project:", projectId, "status:", status);

    let entityData: { account_user_id: string | null; total_budget: number | null; total_hours: number | null } | null = null;
    
    const { data: projectData } = await supabase
      .from("projects")
      .select("account_user_id, total_budget, total_hours")
      .eq("id", projectId)
      .maybeSingle();

    if (projectData) {
      entityData = projectData;
    } else {
      const { data: budget } = await supabase
        .from("budgets")
        .select("account_user_id, total_budget, total_hours")
        .eq("id", projectId)
        .maybeSingle();
      if (budget) entityData = budget;
    }

    if (!entityData) {
      throw new Error("Project or budget not found");
    }

    const project = entityData;

    const { data: accountProfile, error: profileError } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", project.account_user_id)
      .single();

    if (profileError || !accountProfile || !accountProfile.email) {
      throw new Error("Account user not found or email missing");
    }

    const accountName = `${accountProfile.first_name} ${accountProfile.last_name}`.trim();

    let subject = "";
    let htmlContent = "";

    const emailWrapper = (title: string, bodyHtml: string) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="font-family: Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a3330; margin: 0; padding: 20px; background-color: #f2f8f6;">
        <div style="max-width: 600px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 25px -8px rgba(61,190,170,0.25);">
          <div style="background: linear-gradient(135deg, #3dbeaa, #fac320); padding: 30px 40px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0;">TimeTrap</h1>
          </div>
          <div style="background-color: #ffffff; padding: 32px 40px;">
            <h2 style="color: #1a3330; font-size: 22px; font-weight: 700; margin: 0 0 16px;">${title}</h2>
            ${bodyHtml}
          </div>
          <div style="background-color: #f2f8f6; padding: 20px 40px; text-align: center; border-top: 1px solid #cce5df;">
            <p style="color: #527a73; font-size: 12px; margin: 0;">TimeTrap — Gestione Progetti e Budget</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (status === "nuovo_budget") {
      subject = `Nuovo budget per ${projectName}`;
      const budgetLink = `${Deno.env.get("SITE_URL") || "https://dmwyqyqaseyuybqfawvk.supabase.co"}/projects/${projectId}`;
      htmlContent = emailWrapper('📋 Nuovo Budget', `
        <p style="font-size: 15px;">Questo è un messaggio automatico.</p>
        <p style="font-size: 15px;">È stato generato un nuovo budget per la seguente iniziativa:</p>
        <div style="background-color: #f2f8f6; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #cce5df;">
          <p style="margin: 6px 0; font-size: 15px;"><strong>Progetto:</strong> ${projectName}</p>
          <p style="margin: 6px 0; font-size: 15px;"><strong>Cliente:</strong> ${clientName || 'Non specificato'}</p>
          <p style="margin: 6px 0; font-size: 15px;"><strong>Creato da:</strong> ${creatorName || accountName}</p>
          <p style="margin: 6px 0; font-size: 15px;"><strong>Importo:</strong> ${totalBudget?.toFixed(2) || '0.00'} €</p>
        </div>
        <p style="font-size: 15px;">Il budget è visibile qui: <a href="${budgetLink}" style="color: #3dbeaa; font-weight: 600;">${budgetLink}</a></p>
        <p style="color: #527a73; font-size: 12px; margin-top: 20px;">
          Si prega di non rispondere a questa email. Per assistenza, contattare <a href="mailto:assistenza@larin.it" style="color: #3dbeaa;">assistenza@larin.it</a>
        </p>
      `);
    } else if (status === "approvato") {
      subject = `Budget Approvato: ${projectName}`;
      htmlContent = emailWrapper('✅ Budget Approvato', `
        <p style="font-size: 15px;">Ciao <strong>${accountName}</strong>,</p>
        <p style="font-size: 15px;">Il budget per il progetto <strong>${projectName}</strong> è stato approvato.</p>
        <div style="background-color: #f2f8f6; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #cce5df;">
          <h3 style="margin: 0 0 10px; color: #1a3330; font-size: 16px;">Dettagli Budget</h3>
          <p style="margin: 6px 0; font-size: 15px;"><strong>Importo Totale:</strong> ${project.total_budget?.toFixed(2)} €</p>
          <p style="margin: 6px 0; font-size: 15px;"><strong>Ore Totali:</strong> ${project.total_hours?.toFixed(1)}h</p>
        </div>
        <p style="font-size: 15px;">Puoi procedere con le attività previste nel progetto.</p>
        <p style="font-size: 15px; color: #527a73;">Il Team TimeTrap</p>
      `);
    } else if (status === "rifiutato") {
      subject = `Budget Rifiutato: ${projectName}`;
      htmlContent = emailWrapper('❌ Budget Rifiutato', `
        <p style="font-size: 15px;">Ciao <strong>${accountName}</strong>,</p>
        <p style="font-size: 15px;">Il budget per il progetto <strong>${projectName}</strong> è stato rifiutato.</p>
        <div style="background-color: #f2f8f6; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #cce5df;">
          <h3 style="margin: 0 0 10px; color: #1a3330; font-size: 16px;">Dettagli Budget</h3>
          <p style="margin: 6px 0; font-size: 15px;"><strong>Importo Proposto:</strong> ${project.total_budget?.toFixed(2)} €</p>
          <p style="margin: 6px 0; font-size: 15px;"><strong>Ore Proposte:</strong> ${project.total_hours?.toFixed(1)}h</p>
        </div>
        <p style="font-size: 15px;">Ti consigliamo di rivedere il budget e apportare le modifiche necessarie.</p>
        <p style="font-size: 15px; color: #527a73;">Il Team TimeTrap</p>
      `);
    } else if (status === "in_revisione") {
      subject = `Budget in Revisione: ${projectName}`;
      htmlContent = emailWrapper('🔍 Budget in Revisione', `
        <p style="font-size: 15px;">Ciao <strong>${accountName}</strong>,</p>
        <p style="font-size: 15px;">Il budget per il progetto <strong>${projectName}</strong> è stato inviato in revisione ed è pronto per la tua approvazione.</p>
        <div style="background-color: #f2f8f6; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #cce5df;">
          <h3 style="margin: 0 0 10px; color: #1a3330; font-size: 16px;">Dettagli Budget</h3>
          <p style="margin: 6px 0; font-size: 15px;"><strong>Importo:</strong> ${project.total_budget?.toFixed(2)} €</p>
          <p style="margin: 6px 0; font-size: 15px;"><strong>Ore:</strong> ${project.total_hours?.toFixed(1)}h</p>
        </div>
        <p style="font-size: 15px;">Accedi a TimeTrap per approvare o rifiutare il budget.</p>
        <p style="font-size: 15px; color: #527a73;">Il Team TimeTrap</p>
      `);
    }

    const emailResponse = await sendEmail({
      from_email: 'noreply@timetrap.it',
      from_name: 'TimeTrap',
      to: [accountProfile.email],
      subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-budget-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

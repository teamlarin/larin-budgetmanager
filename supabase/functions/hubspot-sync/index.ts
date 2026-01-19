import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HUBSPOT_API_BASE = "https://api.hubapi.com";

interface HubSpotCompany {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    phone?: string;
    description?: string;
    hubspot_owner_id?: string;
  };
}

interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    jobtitle?: string;
    hs_notes_body?: string;
  };
  associations?: {
    companies?: {
      results: Array<{ id: string; type: string }>;
    };
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const hubspotToken = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    if (!hubspotToken) {
      throw new Error("HUBSPOT_ACCESS_TOKEN not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, companyId, contactId } = await req.json();

    const hubspotHeaders = {
      Authorization: `Bearer ${hubspotToken}`,
      "Content-Type": "application/json",
    };

    if (action === "test-connection") {
      // Test HubSpot connection
      const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/companies?limit=1`, {
        headers: hubspotHeaders,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HubSpot connection failed: ${error}`);
      }

      return new Response(JSON.stringify({ success: true, message: "Connessione HubSpot attiva" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync-companies") {
      // Fetch all companies from HubSpot
      let allCompanies: HubSpotCompany[] = [];
      let after: string | undefined;

      do {
        const url = new URL(`${HUBSPOT_API_BASE}/crm/v3/objects/companies`);
        url.searchParams.set("limit", "100");
        url.searchParams.set("properties", "name,domain,phone,description,hubspot_owner_id");
        if (after) url.searchParams.set("after", after);

        const response = await fetch(url.toString(), { headers: hubspotHeaders });
        if (!response.ok) throw new Error(`Failed to fetch companies: ${await response.text()}`);

        const data = await response.json();
        allCompanies = allCompanies.concat(data.results || []);
        after = data.paging?.next?.after;
      } while (after);

      // Get user to assign as user_id (first admin)
      const { data: adminUser } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .single();

      const defaultUserId = adminUser?.user_id;

      // Sync companies to clients table
      let synced = 0;
      let updated = 0;

      for (const company of allCompanies) {
        if (!company.properties.name) continue;

        // Check if client exists (by name)
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("name", company.properties.name)
          .maybeSingle();

        const clientData = {
          name: company.properties.name,
          email: company.properties.domain ? `info@${company.properties.domain}` : null,
          phone: company.properties.phone || null,
          notes: company.properties.description || null,
        };

        if (existingClient) {
          await supabase
            .from("clients")
            .update(clientData)
            .eq("id", existingClient.id);
          updated++;
        } else {
          await supabase
            .from("clients")
            .insert({ ...clientData, user_id: defaultUserId });
          synced++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Sincronizzati ${synced} nuovi clienti, ${updated} aggiornati`,
          synced,
          updated,
          total: allCompanies.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "sync-contacts") {
      // Fetch all contacts from HubSpot with company associations
      let allContacts: HubSpotContact[] = [];
      let after: string | undefined;

      do {
        const url = new URL(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`);
        url.searchParams.set("limit", "100");
        url.searchParams.set("properties", "firstname,lastname,email,phone,jobtitle,hs_notes_body");
        url.searchParams.set("associations", "companies");
        if (after) url.searchParams.set("after", after);

        const response = await fetch(url.toString(), { headers: hubspotHeaders });
        if (!response.ok) throw new Error(`Failed to fetch contacts: ${await response.text()}`);

        const data = await response.json();
        allContacts = allContacts.concat(data.results || []);
        after = data.paging?.next?.after;
      } while (after);

      // Fetch all HubSpot companies to map IDs to names
      const companiesResponse = await fetch(
        `${HUBSPOT_API_BASE}/crm/v3/objects/companies?limit=100&properties=name`,
        { headers: hubspotHeaders }
      );
      const companiesData = await companiesResponse.json();
      const hubspotCompanyMap: Record<string, string> = {};
      for (const c of companiesData.results || []) {
        hubspotCompanyMap[c.id] = c.properties.name;
      }

      // Get all clients from our DB to map names to IDs
      const { data: allClients } = await supabase.from("clients").select("id, name");
      const clientNameMap: Record<string, string> = {};
      for (const c of allClients || []) {
        clientNameMap[c.name.toLowerCase()] = c.id;
      }

      let synced = 0;
      let updated = 0;
      let skipped = 0;

      for (const contact of allContacts) {
        if (!contact.properties.firstname && !contact.properties.lastname) {
          skipped++;
          continue;
        }

        // Find associated company
        const companyAssoc = contact.associations?.companies?.results?.[0];
        let clientId: string | null = null;

        if (companyAssoc) {
          const companyName = hubspotCompanyMap[companyAssoc.id];
          if (companyName) {
            clientId = clientNameMap[companyName.toLowerCase()] || null;
          }
        }

        if (!clientId) {
          skipped++;
          continue; // Skip contacts without a matching client
        }

        const firstName = contact.properties.firstname || "";
        const lastName = contact.properties.lastname || "";

        // Check if contact exists
        const { data: existingContact } = await supabase
          .from("client_contacts")
          .select("id")
          .eq("client_id", clientId)
          .eq("first_name", firstName)
          .eq("last_name", lastName)
          .maybeSingle();

        const contactData = {
          client_id: clientId,
          first_name: firstName,
          last_name: lastName,
          email: contact.properties.email || null,
          phone: contact.properties.phone || null,
          role: contact.properties.jobtitle || null,
          notes: contact.properties.hs_notes_body || null,
        };

        if (existingContact) {
          await supabase
            .from("client_contacts")
            .update(contactData)
            .eq("id", existingContact.id);
          updated++;
        } else {
          await supabase.from("client_contacts").insert(contactData);
          synced++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Sincronizzati ${synced} nuovi contatti, ${updated} aggiornati, ${skipped} saltati`,
          synced,
          updated,
          skipped,
          total: allContacts.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "webhook") {
      // Handle HubSpot webhook events
      const webhookPayload = await req.json();
      console.log("HubSpot webhook received:", JSON.stringify(webhookPayload));

      // Process webhook events (company/contact created/updated)
      // This will be called by HubSpot when changes occur
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("HubSpot sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

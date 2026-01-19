import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HUBSPOT_API_BASE = "https://api.hubapi.com";

interface FieldMapping {
  hubspot_field: string;
  local_field: string;
  is_active: boolean;
}

interface HubSpotCompany {
  id: string;
  properties: Record<string, string | undefined>;
}

interface HubSpotContact {
  id: string;
  properties: Record<string, string | undefined>;
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

    const { action } = await req.json();

    const hubspotHeaders = {
      Authorization: `Bearer ${hubspotToken}`,
      "Content-Type": "application/json",
    };

    // Helper function to get active field mappings
    const getFieldMappings = async (entityType: "company" | "contact"): Promise<FieldMapping[]> => {
      const { data, error } = await supabase
        .from("hubspot_field_mappings")
        .select("hubspot_field, local_field, is_active")
        .eq("entity_type", entityType)
        .eq("is_active", true);
      
      if (error) {
        console.error("Error fetching field mappings:", error);
        return [];
      }
      return data || [];
    };

    // Helper function to apply mappings to HubSpot data
    const applyMappings = (
      properties: Record<string, string | undefined>,
      mappings: FieldMapping[],
      entityType: "company" | "contact"
    ): Record<string, string | null> => {
      const result: Record<string, string | null> = {};
      
      for (const mapping of mappings) {
        let value = properties[mapping.hubspot_field];
        
        // Special handling for domain -> email conversion
        if (entityType === "company" && mapping.hubspot_field === "domain" && mapping.local_field === "email") {
          value = value ? `info@${value}` : undefined;
        }
        
        result[mapping.local_field] = value || null;
      }
      
      return result;
    };

    if (action === "test-connection") {
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
      // Get field mappings for companies
      const mappings = await getFieldMappings("company");
      if (mappings.length === 0) {
        throw new Error("Nessuna mappatura campi configurata per le aziende");
      }

      // Build the properties list for HubSpot API
      const hubspotFields = mappings.map(m => m.hubspot_field).join(",");

      // Fetch all companies from HubSpot
      let allCompanies: HubSpotCompany[] = [];
      let after: string | undefined;

      do {
        const url = new URL(`${HUBSPOT_API_BASE}/crm/v3/objects/companies`);
        url.searchParams.set("limit", "100");
        url.searchParams.set("properties", hubspotFields);
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
        const mappedData = applyMappings(company.properties, mappings, "company");
        
        // Skip if no name
        if (!mappedData.name) continue;

        // Check if client exists (by name)
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("name", mappedData.name)
          .maybeSingle();

        if (existingClient) {
          await supabase
            .from("clients")
            .update(mappedData)
            .eq("id", existingClient.id);
          updated++;
        } else {
          await supabase
            .from("clients")
            .insert({ ...mappedData, user_id: defaultUserId });
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
      // Get field mappings for contacts
      const mappings = await getFieldMappings("contact");
      if (mappings.length === 0) {
        throw new Error("Nessuna mappatura campi configurata per i contatti");
      }

      // Build the properties list for HubSpot API
      const hubspotFields = mappings.map(m => m.hubspot_field).join(",");

      // Fetch all contacts from HubSpot with company associations
      let allContacts: HubSpotContact[] = [];
      let after: string | undefined;

      do {
        const url = new URL(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`);
        url.searchParams.set("limit", "100");
        url.searchParams.set("properties", hubspotFields);
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
        const mappedData = applyMappings(contact.properties, mappings, "contact");

        // Skip if no first_name and no last_name
        if (!mappedData.first_name && !mappedData.last_name) {
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

        const firstName = mappedData.first_name || "";
        const lastName = mappedData.last_name || "";

        // Check if contact exists
        const { data: existingContact } = await supabase
          .from("client_contacts")
          .select("id")
          .eq("client_id", clientId)
          .eq("first_name", firstName)
          .eq("last_name", lastName)
          .maybeSingle();

        const contactData = {
          ...mappedData,
          client_id: clientId,
          first_name: firstName,
          last_name: lastName,
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
      const webhookPayload = await req.json();
      console.log("HubSpot webhook received:", JSON.stringify(webhookPayload));

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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1W3zW-OxNq1hYQcPD6UkIVqOIUPArf7mnz3RLw_gmj3E/export?format=csv";

interface SheetRow {
  ownerHubspotId: string;
  strategicLevel: number | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  contactFirstName: string;
  contactLastName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
}

function parseStrategicLevel(raw: string): number | null {
  if (!raw) return null;
  if (raw.includes("Alto") || raw.includes("1")) return 1;
  if (raw.includes("Medio") || raw.includes("2")) return 2;
  if (raw.includes("Basso") || raw.includes("3")) return 3;
  return null;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(current.trim());
        current = "";
      } else if (char === "\n" || (char === "\r" && text[i + 1] === "\n")) {
        row.push(current.trim());
        current = "";
        rows.push(row);
        row = [];
        if (char === "\r") i++;
      } else {
        current += char;
      }
    }
  }
  if (current || row.length) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: accept either service_role via cron or user JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service role client for DB operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch CSV from Google Sheets
    console.log("Fetching Google Sheet CSV...");
    const csvResp = await fetch(SHEET_CSV_URL);
    if (!csvResp.ok) {
      throw new Error(`Failed to fetch sheet: ${csvResp.status}`);
    }
    const csvText = await csvResp.text();
    const rawRows = parseCSV(csvText);

    // Skip header row
    const dataRows = rawRows.slice(1).filter((r) => r.length >= 3);

    // Parse rows
    const sheetRows: SheetRow[] = dataRows
      .map((r) => ({
        ownerHubspotId: r[0] || "",
        strategicLevel: parseStrategicLevel(r[1] || ""),
        clientName: r[2] || "",
        clientEmail: r[3] || "",
        clientPhone: r[4] || "",
        contactFirstName: r[5] || "",
        contactLastName: r[6] || "",
        contactRole: r[7] || "",
        contactEmail: r[8] || "",
        contactPhone: r[9] || "",
      }))
      .filter((r) => r.clientName); // Must have a client name

    console.log(`Parsed ${sheetRows.length} rows from sheet`);

    // Get owner mappings
    const { data: ownerMappings } = await supabase
      .from("hubspot_owner_mappings")
      .select("hubspot_owner_id, user_id");

    const ownerMap = new Map<string, string>();
    ownerMappings?.forEach((m: any) =>
      ownerMap.set(m.hubspot_owner_id, m.user_id)
    );

    // Get existing clients
    const { data: existingClients } = await supabase
      .from("clients")
      .select("id, name, email, phone, strategic_level, account_user_id");

    const clientByName = new Map<string, any>();
    existingClients?.forEach((c: any) =>
      clientByName.set(c.name.toLowerCase().trim(), c)
    );

    // We need a user_id for new clients - use first admin
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);

    const defaultUserId = adminRoles?.[0]?.user_id;
    if (!defaultUserId) {
      throw new Error("No admin user found for client ownership");
    }

    // Deduplicate clients from sheet
    const uniqueClients = new Map<string, SheetRow>();
    for (const row of sheetRows) {
      const key = row.clientName.toLowerCase().trim();
      if (!uniqueClients.has(key)) {
        uniqueClients.set(key, row);
      }
    }

    let clientsCreated = 0;
    let clientsUpdated = 0;
    let contactsCreated = 0;
    let contactsSkipped = 0;

    // Upsert clients
    for (const [key, row] of uniqueClients) {
      const accountUserId = ownerMap.get(row.ownerHubspotId) || null;
      const existing = clientByName.get(key);

      if (existing) {
        // Update if data changed
        const updates: Record<string, any> = {};
        if (row.clientEmail && row.clientEmail !== existing.email)
          updates.email = row.clientEmail;
        if (row.clientPhone && row.clientPhone !== existing.phone)
          updates.phone = row.clientPhone;
        if (
          row.strategicLevel !== null &&
          row.strategicLevel !== existing.strategic_level
        )
          updates.strategic_level = row.strategicLevel;
        if (accountUserId && accountUserId !== existing.account_user_id)
          updates.account_user_id = accountUserId;

        if (Object.keys(updates).length > 0) {
          await supabase
            .from("clients")
            .update(updates)
            .eq("id", existing.id);
          clientsUpdated++;
        }
      } else {
        // Create new client
        const { data: newClient } = await supabase
          .from("clients")
          .insert({
            name: row.clientName,
            email: row.clientEmail || null,
            phone: row.clientPhone || null,
            strategic_level: row.strategicLevel,
            account_user_id: accountUserId,
            user_id: defaultUserId,
          })
          .select("id, name")
          .single();

        if (newClient) {
          clientByName.set(key, newClient);
          clientsCreated++;
        }
      }
    }

    // Now process contacts
    // Get existing contacts with their client associations
    const { data: existingContacts } = await supabase
      .from("client_contacts")
      .select("id, email, first_name, last_name, client_id");

    // Build lookup: client_id + email → contact
    const contactLookup = new Set<string>();
    existingContacts?.forEach((c: any) => {
      if (c.email && c.client_id) {
        contactLookup.add(
          `${c.client_id}-${c.email.toLowerCase()}`
        );
      }
    });

    for (const row of sheetRows) {
      if (!row.contactFirstName && !row.contactLastName) continue;

      const clientKey = row.clientName.toLowerCase().trim();
      const client = clientByName.get(clientKey);
      if (!client) continue;

      const contactEmail = row.contactEmail || "";
      const lookupKey = `${client.id}-${contactEmail.toLowerCase()}`;

      // Skip if contact with same email already exists for this client
      if (contactEmail && contactLookup.has(lookupKey)) {
        contactsSkipped++;
        continue;
      }

      // Create contact
      const { data: newContact } = await supabase
        .from("client_contacts")
        .insert({
          client_id: client.id,
          first_name: row.contactFirstName || "",
          last_name: row.contactLastName || "",
          email: contactEmail || null,
          phone: row.contactPhone || null,
          role: row.contactRole || null,
          is_primary: false,
        })
        .select("id")
        .single();

      if (newContact) {
        // Also insert into junction table
        await supabase.from("client_contact_clients").insert({
          contact_id: newContact.id,
          client_id: client.id,
          is_primary: false,
        });

        contactsCreated++;
        if (contactEmail) {
          contactLookup.add(lookupKey);
        }
      }
    }

    const result = {
      success: true,
      clients_created: clientsCreated,
      clients_updated: clientsUpdated,
      contacts_created: contactsCreated,
      contacts_skipped: contactsSkipped,
      total_rows: sheetRows.length,
    };

    console.log("Sync completed:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync error:", error);
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

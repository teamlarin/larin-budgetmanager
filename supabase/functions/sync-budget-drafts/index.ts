import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1W3zW-OxNq1hYQcPD6UkIVqOIUPArf7mnz3RLw_gmj3E/export?format=csv&gid=1562960313";

interface SheetRow {
  dealName: string;
  ownerHubspotId: string;
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  amount: number | null;
  closeDate: string | null;
  area: string;
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

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[€\s.]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseCloseDate(raw: string): string | null {
  if (!raw) return null;
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Try DD/MM/YYYY
  const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Try MM/DD/YYYY
  const mmddyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    // Already handled above, ambiguous - assume DD/MM/YYYY for Italian locale
    return null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: CRON_SECRET or user JWT
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization") ?? "";
    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCronAuth) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error: authError,
      } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch CSV
    console.log("Fetching Google Sheet CSV (foglio 3)...");
    const csvResp = await fetch(SHEET_CSV_URL);
    if (!csvResp.ok) {
      throw new Error(`Failed to fetch sheet: ${csvResp.status}`);
    }
    const csvText = await csvResp.text();
    const rawRows = parseCSV(csvText);

    // Skip header row
    const dataRows = rawRows.slice(1).filter((r) => r.length >= 1 && r[0]);

    const sheetRows: SheetRow[] = dataRows.map((r) => ({
      dealName: r[0] || "",
      ownerHubspotId: r[1] || "",
      companyName: r[2] || "",
      contactFirstName: r[3] || "",
      contactLastName: r[4] || "",
      contactEmail: r[5] || "",
      amount: parseAmount(r[6] || ""),
      closeDate: parseCloseDate(r[7] || ""),
      area: r[8] || "",
    })).filter((r) => r.dealName);

    console.log(`Parsed ${sheetRows.length} rows from sheet`);

    // Get owner mappings
    const { data: ownerMappings } = await supabase
      .from("hubspot_owner_mappings")
      .select("hubspot_owner_id, user_id");

    const ownerMap = new Map<string, string>();
    ownerMappings?.forEach((m: any) =>
      ownerMap.set(m.hubspot_owner_id, m.user_id)
    );

    // Get existing clients (for matching by name)
    const { data: existingClients } = await supabase
      .from("clients")
      .select("id, name");

    const clientByName = new Map<string, string>();
    existingClients?.forEach((c: any) =>
      clientByName.set(c.name.toLowerCase().trim(), c.id)
    );

    // Get default admin user_id
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);

    const defaultUserId = adminRoles?.[0]?.user_id;
    if (!defaultUserId) {
      throw new Error("No admin user found");
    }

    // Get existing budget drafts for dedup (match by name + client_id)
    const { data: existingBudgets } = await supabase
      .from("budgets")
      .select("id, name, client_id, total_budget, area, account_user_id, expected_close_date")
      .in("status", ["bozza", "in_attesa"]);

    const budgetLookup = new Map<string, any>();
    existingBudgets?.forEach((b: any) => {
      const key = `${b.name.toLowerCase().trim()}|${b.client_id || ""}`;
      budgetLookup.set(key, b);
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of sheetRows) {
      const clientId = clientByName.get(row.companyName.toLowerCase().trim()) || null;
      const accountUserId = ownerMap.get(row.ownerHubspotId) || null;
      const lookupKey = `${row.dealName.toLowerCase().trim()}|${clientId || ""}`;

      const existing = budgetLookup.get(lookupKey);

      if (existing) {
        // Check if anything changed
        const updates: Record<string, any> = {};
        if (row.amount !== null && row.amount !== Number(existing.total_budget))
          updates.total_budget = row.amount;
        if (row.area && row.area !== existing.area)
          updates.area = row.area;
        if (accountUserId && accountUserId !== existing.account_user_id)
          updates.account_user_id = accountUserId;
        if (row.closeDate && row.closeDate !== existing.expected_close_date)
          updates.expected_close_date = row.closeDate;

        if (Object.keys(updates).length > 0) {
          await supabase.from("budgets").update(updates).eq("id", existing.id);
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Create new draft budget
        await supabase.from("budgets").insert({
          name: row.dealName,
          client_id: clientId,
          account_user_id: accountUserId,
          total_budget: row.amount || 0,
          area: row.area || null,
          expected_close_date: row.closeDate,
          status: "bozza",
          project_type: "Personalizzato",
          user_id: defaultUserId,
        });
        created++;
      }
    }

    const result = {
      success: true,
      budgets_created: created,
      budgets_updated: updated,
      budgets_skipped: skipped,
      total_rows: sheetRows.length,
    };

    console.log("Budget drafts sync completed:", result);

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

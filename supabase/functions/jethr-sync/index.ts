// Orchestratore sync Jethr → TimeTrap (read-only)
// Auth: Bearer CRON_SECRET (chiamato da pg_cron e dal pulsante manuale via service role)
//
// Sincronizza:
// 1) Contratti (user_contract_periods con source='jethr')
// 2) Assenze approvate (jethr_absences) — esclude smart working
// 3) Festività (jethr_holidays)
// 4) Richieste pending (jethr_pending_requests)
//
// Solo per profili con jethr_employee_id valorizzato.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getJethrToken,
  jethrFetchAll,
  JETHR_PATHS,
} from "../_shared/jethr.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Tipi assenza considerati smart working (esclusi)
const SMART_WORKING_TYPES = new Set([
  "smart_working",
  "smartworking",
  "smart-working",
  "remote",
  "lavoro_agile",
  "agile_work",
]);

function isSmartWorking(type: string): boolean {
  return SMART_WORKING_TYPES.has((type || "").toLowerCase().replace(/\s+/g, "_"));
}

function asDate(v: any): string | null {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function num(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface SyncSummary {
  contracts: { upserted: number; errors: string[] };
  absences: { upserted: number; skipped_smart_working: number; errors: string[] };
  holidays: { upserted: number; errors: string[] };
  pending: { upserted: number; errors: string[] };
  unmatched_users: { id: string; name: string }[];
  started_at: string;
  finished_at: string;
  duration_ms: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth via CRON_SECRET
  const authHeader = req.headers.get("Authorization") || "";
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startedAt = new Date();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const summary: SyncSummary = {
    contracts: { upserted: 0, errors: [] },
    absences: { upserted: 0, skipped_smart_working: 0, errors: [] },
    holidays: { upserted: 0, errors: [] },
    pending: { upserted: 0, errors: [] },
    unmatched_users: [],
    started_at: startedAt.toISOString(),
    finished_at: "",
    duration_ms: 0,
  };

  try {
    const token = getJethrToken();

    // Carica mapping utenti TimeTrap → Jethr
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, jethr_employee_id, deleted_at")
      .not("jethr_employee_id", "is", null)
      .is("deleted_at", null);
    if (pErr) throw pErr;

    const jethrToUser = new Map<string, { id: string; name: string }>();
    for (const p of profiles ?? []) {
      jethrToUser.set(String(p.jethr_employee_id), {
        id: p.id,
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      });
    }

    if (jethrToUser.size === 0) {
      summary.unmatched_users.push({
        id: "*",
        name: "Nessun utente con jethr_employee_id mappato",
      });
    }

    // === 1. CONTRATTI ===
    try {
      const employees: any[] = await jethrFetchAll(JETHR_PATHS.employees, token);
      for (const emp of employees) {
        const jid = String(emp.id ?? emp.employee_id ?? emp.uuid ?? "");
        const mapped = jethrToUser.get(jid);
        if (!mapped) continue;

        // Estrazione contratti — tollerante a varianti
        const contracts: any[] = Array.isArray(emp.contracts)
          ? emp.contracts
          : Array.isArray(emp.contract_periods)
          ? emp.contract_periods
          : emp.contract
          ? [emp.contract]
          : [];

        for (const c of contracts) {
          const startDate = asDate(c.start_date ?? c.from ?? c.valid_from);
          if (!startDate) continue;
          const endDate = asDate(c.end_date ?? c.to ?? c.valid_to);
          const weeklyHours = num(
            c.weekly_hours ?? c.hours_per_week ?? c.contract_hours,
          );
          const hourlyRate = num(c.hourly_rate ?? c.cost_per_hour);

          // Upsert su (user_id, start_date) per source=jethr
          const { error: upErr } = await supabase
            .from("user_contract_periods")
            .upsert(
              {
                user_id: mapped.id,
                start_date: startDate,
                end_date: endDate,
                weekly_hours: weeklyHours ?? undefined,
                hourly_rate: hourlyRate ?? undefined,
                source: "jethr",
              },
              { onConflict: "user_id,start_date" },
            );
          if (upErr) {
            summary.contracts.errors.push(`${mapped.name}: ${upErr.message}`);
          } else {
            summary.contracts.upserted++;
          }
        }
      }
    } catch (e) {
      summary.contracts.errors.push(String((e as Error).message));
    }

    // === 2. ASSENZE APPROVATE ===
    try {
      const absences: any[] = await jethrFetchAll(JETHR_PATHS.absences, token, {
        status: "approved",
      });
      for (const a of absences) {
        const empId = String(
          a.employee_id ?? a.employee?.id ?? a.user_id ?? "",
        );
        const mapped = jethrToUser.get(empId);
        if (!mapped) continue;

        const type = String(a.type ?? a.absence_type ?? a.category ?? "");
        if (isSmartWorking(type)) {
          summary.absences.skipped_smart_working++;
          continue;
        }

        const startDate = asDate(a.start_date ?? a.from);
        const endDate = asDate(a.end_date ?? a.to) ?? startDate;
        if (!startDate) continue;

        const { error } = await supabase
          .from("jethr_absences")
          .upsert(
            {
              jethr_id: String(a.id),
              user_id: mapped.id,
              type,
              start_date: startDate,
              end_date: endDate!,
              start_time: a.start_time ?? null,
              end_time: a.end_time ?? null,
              hours: num(a.hours ?? a.duration_hours),
              status: "approved",
              notes: a.notes ?? a.reason ?? null,
              raw: a,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "jethr_id" },
          );
        if (error) summary.absences.errors.push(error.message);
        else summary.absences.upserted++;
      }
    } catch (e) {
      summary.absences.errors.push(String((e as Error).message));
    }

    // === 3. FESTIVITA' ===
    try {
      const year = new Date().getFullYear();
      const holidays: any[] = await jethrFetchAll(JETHR_PATHS.holidays, token, {
        year,
      });
      for (const h of holidays) {
        const date = asDate(h.date ?? h.day);
        if (!date) continue;
        const name = String(h.name ?? h.label ?? "Festività");
        const { error } = await supabase
          .from("jethr_holidays")
          .upsert(
            {
              jethr_id: h.id ? String(h.id) : null,
              date,
              name,
              is_company_closure: !!(h.is_company_closure ?? h.company_closure),
              raw: h,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "date,name" },
          );
        if (error) summary.holidays.errors.push(error.message);
        else summary.holidays.upserted++;
      }
    } catch (e) {
      summary.holidays.errors.push(String((e as Error).message));
    }

    // === 4. RICHIESTE PENDING ===
    try {
      const pending: any[] = await jethrFetchAll(JETHR_PATHS.absences, token, {
        status: "pending",
      });
      for (const a of pending) {
        const empId = String(
          a.employee_id ?? a.employee?.id ?? a.user_id ?? "",
        );
        const mapped = jethrToUser.get(empId);
        if (!mapped) continue;
        const type = String(a.type ?? a.absence_type ?? a.category ?? "");
        if (isSmartWorking(type)) continue;

        const startDate = asDate(a.start_date ?? a.from);
        const endDate = asDate(a.end_date ?? a.to) ?? startDate;
        if (!startDate) continue;

        const { error } = await supabase
          .from("jethr_pending_requests")
          .upsert(
            {
              jethr_id: String(a.id),
              user_id: mapped.id,
              type,
              start_date: startDate,
              end_date: endDate!,
              hours: num(a.hours ?? a.duration_hours),
              status: "pending",
              submitted_at: a.created_at ?? a.submitted_at ?? null,
              notes: a.notes ?? a.reason ?? null,
              raw: a,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "jethr_id" },
          );
        if (error) summary.pending.errors.push(error.message);
        else summary.pending.upserted++;
      }

      // Pulisci richieste pending non più presenti (approvate/rifiutate)
      const stillPendingIds = new Set(pending.map((a) => String(a.id)));
      const { data: existing } = await supabase
        .from("jethr_pending_requests")
        .select("jethr_id");
      const toDelete = (existing ?? [])
        .map((r: any) => r.jethr_id)
        .filter((id: string) => !stillPendingIds.has(id));
      if (toDelete.length) {
        await supabase
          .from("jethr_pending_requests")
          .delete()
          .in("jethr_id", toDelete);
      }
    } catch (e) {
      summary.pending.errors.push(String((e as Error).message));
    }

    summary.finished_at = new Date().toISOString();
    summary.duration_ms = Date.now() - startedAt.getTime();

    // Salva stato in app_settings
    await supabase
      .from("app_settings")
      .upsert(
        {
          setting_key: "jethr_sync_status",
          setting_value: summary as any,
          description: "Stato ultima sync Jethr",
        },
        { onConflict: "setting_key" },
      );

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    summary.finished_at = new Date().toISOString();
    summary.duration_ms = Date.now() - startedAt.getTime();
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message, summary }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

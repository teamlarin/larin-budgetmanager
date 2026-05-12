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
  planning: {
    tracking_upserted: number;
    tracking_deleted: number;
    unmapped_types: string[];
    errors: string[];
  };
  unmatched_users: { id: string; name: string }[];
  started_at: string;
  finished_at: string;
  duration_ms: number;
}

// Calcola Pasqua per un anno (Gauss)
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function isWorkingDay(dateStr: string, closures: Set<string>): boolean {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !closures.has(dateStr);
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function expandDays(start: string, end: string): string[] {
  const days: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(fmt(d));
  }
  return days;
}

function buildClosureSet(years: number[], closureDays: any[]): Set<string> {
  const set = new Set<string>();
  // Italian fixed holidays (lun-ven check già escluse domeniche/sabati)
  const fixed = ["01-01", "01-06", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"];
  for (const y of years) {
    for (const md of fixed) set.add(`${y}-${md}`);
    const e = easter(y);
    set.add(fmt(e));
    const em = new Date(e);
    em.setUTCDate(em.getUTCDate() + 1);
    set.add(fmt(em));
  }
  // App-defined closure days
  for (const cd of closureDays ?? []) {
    if (cd?.isRecurring && typeof cd?.date === "string" && /^\d{2}-\d{2}$/.test(cd.date)) {
      for (const y of years) set.add(`${y}-${cd.date}`);
    } else if (typeof cd?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cd.date)) {
      set.add(cd.date);
    }
  }
  return set;
}

// Recupera weekly hours dal contratto (contract_hours / contract_hours_period)
function weeklyHoursFromContract(c: { contract_hours: number | null; contract_hours_period: string | null }): number {
  const h = Number(c?.contract_hours ?? 0);
  if (!h) return 40;
  const period = (c?.contract_hours_period ?? "weekly").toLowerCase();
  if (period.startsWith("month")) return h / 4.33;
  if (period.startsWith("day") || period.startsWith("daily")) return h * 5;
  return h; // weekly
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function timeFromHours(hours: number): { start: string; end: string } {
  // Centrato su 09:00, durata = hours (giornata intera)
  const startH = 9;
  const totalMinutes = Math.round(hours * 60);
  const endTotal = startH * 60 + totalMinutes;
  const eh = Math.floor(endTotal / 60);
  const em = endTotal % 60;
  return { start: "09:00:00", end: `${pad2(Math.min(eh, 23))}:${pad2(em)}:00` };
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
    planning: { tracking_upserted: 0, tracking_deleted: 0, unmapped_types: [], errors: [] },
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
                contract_hours: weeklyHours ?? undefined,
                contract_hours_period: weeklyHours ? "weekly" : undefined,
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
    const approvedAbsences: Array<{
      jethr_id: string;
      user_id: string;
      type: string;
      start_date: string;
      end_date: string;
      start_time: string | null;
      end_time: string | null;
      hours: number | null;
    }> = [];
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
        if (error) {
          summary.absences.errors.push(error.message);
        } else {
          summary.absences.upserted++;
          approvedAbsences.push({
            jethr_id: String(a.id),
            user_id: mapped.id,
            type,
            start_date: startDate,
            end_date: endDate!,
            start_time: a.start_time ?? null,
            end_time: a.end_time ?? null,
            hours: num(a.hours ?? a.duration_hours),
          });
        }
      }

      // Cleanup: rimuovi assenze non più approvate (cascata su jethr_absence_tracking → activity_time_tracking)
      const stillApprovedIds = new Set(approvedAbsences.map((a) => a.jethr_id));
      const { data: existingAbs } = await supabase
        .from("jethr_absences")
        .select("jethr_id");
      const absToDelete = (existingAbs ?? [])
        .map((r: any) => r.jethr_id as string)
        .filter((id) => !stillApprovedIds.has(id));
      if (absToDelete.length) {
        // Prima recupera tracking ID da eliminare per contare il cleanup
        const { data: trackings } = await supabase
          .from("jethr_absence_tracking")
          .select("tracking_id")
          .in("jethr_id", absToDelete);
        const trackingIds = (trackings ?? []).map((t: any) => t.tracking_id);
        if (trackingIds.length) {
          await supabase.from("activity_time_tracking").delete().in("id", trackingIds);
          summary.planning.tracking_deleted += trackingIds.length;
        }
        await supabase.from("jethr_absences").delete().in("jethr_id", absToDelete);
      }
    } catch (e) {
      summary.absences.errors.push(String((e as Error).message));
    }

    // === 3. FESTIVITA' === (non disponibile via API Jethr — skipped)
    if (JETHR_PATHS.holidays) {
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

    // === 5. PIANIFICAZIONE AUTOMATICA SU PROGETTO OFF ===
    try {
      // Carica mappature tipo → budget_item
      const { data: mappings } = await supabase
        .from("jethr_activity_mappings")
        .select("jethr_type, budget_item_id, enabled");
      const typeToBudgetItem = new Map<string, string>();
      for (const m of mappings ?? []) {
        if (m.enabled) typeToBudgetItem.set(String(m.jethr_type).toLowerCase(), m.budget_item_id);
      }

      // Carica giorni di chiusura aziendali da app_settings
      const { data: closureSetting } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "closure_days")
        .maybeSingle();
      const closureDaysRaw =
        ((closureSetting?.setting_value as any)?.closureDays as any[]) ?? [];

      // Carica contratti dei soli utenti coinvolti
      const userIds = Array.from(new Set(approvedAbsences.map((a) => a.user_id)));
      const { data: contractRows } = userIds.length
        ? await supabase
            .from("user_contract_periods")
            .select("user_id, contract_hours, contract_hours_period, start_date, end_date")
            .in("user_id", userIds)
        : { data: [] as any[] };

      function weeklyHoursFor(userId: string, date: string): number {
        const candidates = (contractRows ?? []).filter(
          (c: any) =>
            c.user_id === userId &&
            c.start_date <= date &&
            (c.end_date === null || c.end_date >= date),
        );
        if (!candidates.length) return 40;
        candidates.sort((a: any, b: any) => (a.start_date < b.start_date ? 1 : -1));
        return weeklyHoursFromContract(candidates[0]);
      }

      const unmappedTypesSet = new Set<string>();

      for (const abs of approvedAbsences) {
        const biId = typeToBudgetItem.get(abs.type.toLowerCase());
        if (!biId) {
          unmappedTypesSet.add(abs.type);
          continue;
        }

        const allDays = expandDays(abs.start_date, abs.end_date);
        const years = Array.from(new Set(allDays.map((d) => parseInt(d.slice(0, 4), 10))));
        const closures = buildClosureSet(years, closureDaysRaw);
        const workingDays = allDays.filter((d) => isWorkingDay(d, closures));

        // Determina orari
        let startTime: string;
        let endTime: string;
        const isHourly =
          (abs.start_time && abs.end_time) ||
          (abs.hours !== null && abs.hours > 0 && abs.hours < 6);
        if (isHourly && abs.start_time && abs.end_time) {
          startTime = String(abs.start_time).length === 5 ? `${abs.start_time}:00` : abs.start_time;
          endTime = String(abs.end_time).length === 5 ? `${abs.end_time}:00` : abs.end_time;
        } else if (isHourly && abs.hours) {
          const t = timeFromHours(abs.hours);
          startTime = t.start;
          endTime = t.end;
        } else {
          const wh = weeklyHoursFor(abs.user_id, abs.start_date);
          const t = timeFromHours(wh / 5);
          startTime = t.start;
          endTime = t.end;
        }

        // Carica tracking esistenti per questa assenza per riutilizzare gli ID
        const { data: existingLinks } = await supabase
          .from("jethr_absence_tracking")
          .select("scheduled_date, tracking_id")
          .eq("jethr_id", abs.jethr_id);
        const existingByDate = new Map<string, string>();
        for (const r of existingLinks ?? []) existingByDate.set(r.scheduled_date, r.tracking_id);

        // Cancella tracking di giorni non più coperti (es. range modificato)
        const wantedDates = new Set(workingDays);
        const toRemoveTrackingIds: string[] = [];
        const toRemoveDates: string[] = [];
        for (const [d, tid] of existingByDate.entries()) {
          if (!wantedDates.has(d)) {
            toRemoveTrackingIds.push(tid);
            toRemoveDates.push(d);
          }
        }
        if (toRemoveTrackingIds.length) {
          await supabase.from("activity_time_tracking").delete().in("id", toRemoveTrackingIds);
          summary.planning.tracking_deleted += toRemoveTrackingIds.length;
        }

        // Crea / aggiorna tracking per ogni giorno lavorativo
        for (const day of workingDays) {
          const startTs = new Date(`${day}T${startTime}`).toISOString();
          const endTs = new Date(`${day}T${endTime}`).toISOString();
          const note = `Sincronizzato da Jethr (${abs.type}, id ${abs.jethr_id})`;
          const existingId = existingByDate.get(day);
          if (existingId) {
            const { error: uErr } = await supabase
              .from("activity_time_tracking")
              .update({
                budget_item_id: biId,
                user_id: abs.user_id,
                scheduled_date: day,
                scheduled_start_time: startTime,
                scheduled_end_time: endTime,
                actual_start_time: startTs,
                actual_end_time: endTs,
                notes: note,
              })
              .eq("id", existingId);
            if (uErr) summary.planning.errors.push(uErr.message);
            else summary.planning.tracking_upserted++;
          } else {
            const { data: ins, error: iErr } = await supabase
              .from("activity_time_tracking")
              .insert({
                budget_item_id: biId,
                user_id: abs.user_id,
                scheduled_date: day,
                scheduled_start_time: startTime,
                scheduled_end_time: endTime,
                actual_start_time: startTs,
                actual_end_time: endTs,
                notes: note,
              })
              .select("id")
              .single();
            if (iErr) {
              summary.planning.errors.push(iErr.message);
              continue;
            }
            const { error: lErr } = await supabase
              .from("jethr_absence_tracking")
              .insert({
                jethr_id: abs.jethr_id,
                scheduled_date: day,
                tracking_id: ins!.id,
              });
            if (lErr) summary.planning.errors.push(lErr.message);
            else summary.planning.tracking_upserted++;
          }
        }
      }
      summary.planning.unmapped_types = Array.from(unmappedTypesSet);
    } catch (e) {
      summary.planning.errors.push(String((e as Error).message));
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

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface JethrEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  fiscal_code: string | null;
  role: string | null;
}

interface SyncStatus {
  contracts: { upserted: number; errors: string[] };
  absences: { upserted: number; skipped_smart_working: number; errors: string[] };
  holidays: { upserted: number; errors: string[] };
  pending: { upserted: number; errors: string[] };
  planning?: {
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

const NONE = "__none__";

export const JethrIntegration = () => {
  const qc = useQueryClient();
  const [mappingOpen, setMappingOpen] = useState(false);
  const [activityMapOpen, setActivityMapOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Stato ultima sync
  const { data: statusRow } = useQuery({
    queryKey: ["app-settings", "jethr_sync_status"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "jethr_sync_status")
        .maybeSingle();
      return (data?.setting_value as unknown as SyncStatus) ?? null;
    },
  });

  // Profili con/senza binding
  const { data: profiles } = useQuery({
    queryKey: ["profiles", "jethr-binding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, jethr_employee_id")
        .is("deleted_at", null)
        .eq("approved", true)
        .order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const unmappedCount = (profiles ?? []).filter((p) => !p.jethr_employee_id).length;

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("jethr-test-connection");
      if (error) throw error;
      if (data?.ok) toast.success(`Connessione Jethr OK (${data.sample_count ?? 0} dipendenti)`);
      else toast.error(`Connessione fallita: ${data?.error ?? "errore sconosciuto"}`);
    } catch (e: any) {
      toast.error(`Errore: ${e.message ?? e}`);
    } finally {
      setTesting(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("jethr-manual-sync");
      if (error) throw error;
      if (data?.ok) {
        toast.success("Sincronizzazione completata");
        qc.invalidateQueries({ queryKey: ["app-settings", "jethr_sync_status"] });
      } else {
        toast.error(`Sync fallita: ${data?.error ?? "errore sconosciuto"}`);
      }
    } catch (e: any) {
      toast.error(`Errore: ${e.message ?? e}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          Jethr (HRIS)
        </CardTitle>
        <CardDescription>
          Sincronizzazione read-only da Jethr: contratti, ferie/permessi/malattia approvati,
          festività e richieste pending. Smart working escluso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Le email TimeTrap (aziendali) non coincidono con quelle Jethr (personali):
            ogni utente va mappato manualmente al dipendente Jethr corrispondente.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Test connessione
          </Button>
          <Button variant="outline" onClick={() => setMappingOpen(true)}>
            <Users className="h-4 w-4 mr-2" />
            Mappa utenti{" "}
            {unmappedCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unmappedCount} non mappati
              </Badge>
            )}
          </Button>
          <Button variant="outline" onClick={() => setActivityMapOpen(true)}>
            <Briefcase className="h-4 w-4 mr-2" />
            Mappa attività OFF
            {(statusRow?.planning?.unmapped_types?.length ?? 0) > 0 && (
              <Badge variant="destructive" className="ml-2">
                {statusRow!.planning!.unmapped_types.length} non mappati
              </Badge>
            )}
          </Button>
          <Button onClick={handleManualSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sincronizza ora
          </Button>
        </div>

        {statusRow?.unmatched_users?.some((u) => u.id === "*") && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>
                Nessun utente TimeTrap è ancora mappato a un dipendente Jethr: la sync scarica i dati ma non ha dove scriverli.
                Apri <strong>Mappa utenti</strong> per associarli, poi rilancia <strong>Sincronizza ora</strong>.
              </span>
              <Button size="sm" variant="outline" onClick={() => setMappingOpen(true)}>
                <Users className="h-4 w-4 mr-2" />
                Mappa utenti
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {statusRow && (
          <div className="rounded-md border p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {(statusRow.contracts?.errors?.length ?? 0) +
                (statusRow.absences?.errors?.length ?? 0) +
                (statusRow.holidays?.errors?.length ?? 0) +
                (statusRow.pending?.errors?.length ?? 0) ===
              0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="font-medium">
                Ultima sync:{" "}
                {statusRow.finished_at
                  ? format(new Date(statusRow.finished_at), "PPpp", { locale: it })
                  : "—"}{" "}
                ({Math.round((statusRow.duration_ms ?? 0) / 100) / 10}s)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
              <div>Contratti: {statusRow.contracts?.upserted ?? 0}</div>
              <div>
                Assenze: {statusRow.absences?.upserted ?? 0}{" "}
                {statusRow.absences?.skipped_smart_working
                  ? `(SW saltati: ${statusRow.absences.skipped_smart_working})`
                  : ""}
              </div>
              <div>Festività: {statusRow.holidays?.upserted ?? 0}</div>
              <div>Pending: {statusRow.pending?.upserted ?? 0}</div>
              {statusRow.planning && (
                <div className="col-span-2 sm:col-span-4">
                  Pianificazione OFF: +{statusRow.planning.tracking_upserted}
                  {statusRow.planning.tracking_deleted
                    ? ` (−${statusRow.planning.tracking_deleted})`
                    : ""}
                  {statusRow.planning.unmapped_types.length > 0 && (
                    <span className="text-destructive ml-2">
                      tipi non mappati: {statusRow.planning.unmapped_types.join(", ")}
                    </span>
                  )}
                </div>
              )}
            </div>
            {[
              ...(statusRow.contracts?.errors ?? []),
              ...(statusRow.absences?.errors ?? []),
              ...(statusRow.holidays?.errors ?? []),
              ...(statusRow.pending?.errors ?? []),
            ].length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-destructive">Errori</summary>
                <ul className="mt-1 list-disc pl-5 space-y-0.5">
                  {[
                    ...(statusRow.contracts?.errors ?? []).map((e) => `Contratti: ${e}`),
                    ...(statusRow.absences?.errors ?? []).map((e) => `Assenze: ${e}`),
                    ...(statusRow.holidays?.errors ?? []).map((e) => `Festività: ${e}`),
                    ...(statusRow.pending?.errors ?? []).map((e) => `Pending: ${e}`),
                  ].map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <JethrUserMappingDialog
          open={mappingOpen}
          onOpenChange={setMappingOpen}
          profiles={profiles ?? []}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["profiles", "jethr-binding"] });
          }}
        />

        <JethrActivityMappingDialog
          open={activityMapOpen}
          onOpenChange={setActivityMapOpen}
          knownUnmappedTypes={statusRow?.planning?.unmapped_types ?? []}
        />
      </CardContent>
    </Card>
  );
};

interface MappingProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profiles: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    jethr_employee_id: string | null;
  }>;
  onSaved: () => void;
}

const JethrUserMappingDialog = ({ open, onOpenChange, profiles, onSaved }: MappingProps) => {
  const [employees, setEmployees] = useState<JethrEmployee[]>([]);
  const [rawCount, setRawCount] = useState<number | null>(null);
  const [sample, setSample] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [fallbackInfo, setFallbackInfo] = useState<{ source: string | null; count: number; sample: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string | null>>({});

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("jethr-list-employees");
      if (error) throw error;
      setEmployees(data?.employees ?? []);
      setRawCount(typeof data?.raw_count === "number" ? data.raw_count : null);
      setSample(data?.sample ?? null);
      setDebugInfo(data?.debug ?? null);
      setFallbackInfo({
        source: data?.fallback_source ?? null,
        count: typeof data?.fallback_raw_count === "number" ? data.fallback_raw_count : 0,
        sample: data?.fallback_sample ?? null,
      });
      const initial: Record<string, string | null> = {};
      profiles.forEach((p) => {
        initial[p.id] = p.jethr_employee_id;
      });
      setDrafts(initial);
    } catch (e: any) {
      toast.error(`Caricamento dipendenti Jethr fallito: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = profiles
        .filter((p) => (drafts[p.id] ?? null) !== (p.jethr_employee_id ?? null))
        .map((p) => ({ id: p.id, jethr_employee_id: drafts[p.id] }));
      for (const u of updates) {
        const { error } = await supabase
          .from("profiles")
          .update({ jethr_employee_id: u.jethr_employee_id })
          .eq("id", u.id);
        if (error) throw error;
      }
      return updates.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} mappature salvate`);
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(`Errore: ${e.message ?? e}`),
  });

  // Dipendenti già usati (per nasconderli dal dropdown degli altri utenti)
  const usedIds = new Set(
    Object.entries(drafts)
      .filter(([_, v]) => v)
      .map(([_, v]) => v as string),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) loadEmployees();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mappatura utenti TimeTrap ↔ Dipendenti Jethr</DialogTitle>
          <DialogDescription>
            Associa ogni utente TimeTrap al dipendente Jethr corrispondente. Solo gli utenti
            mappati verranno sincronizzati.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : employees.length === 0 ? (
          <div className="space-y-3 py-4">
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="font-medium text-destructive">Nessun dipendente Jethr ricevuto</div>
              <div className="text-muted-foreground mt-1">
                L'API Jethr <code>/employees/</code> ha restituito {rawCount ?? 0} record grezzi.
                {fallbackInfo && (
                  <> Fallback da <code>/presence-absence-requests/</code>: {fallbackInfo.count} richieste
                  lette, ma non è stato possibile estrarre nessun dipendente identificabile.</>
                )}
                {" "}Verifica che il token <code className="mx-1">JETHR_API_TOKEN</code> abbia i permessi di lettura sui dipendenti, oppure controlla qui sotto la struttura della risposta per capire dove si trova l'ID dipendente.
              </div>
              {debugInfo && (
                <details className="mt-2" open>
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Risposta diretta API Jethr (debug)
                  </summary>
                  <div className="mt-2 text-xs space-y-1">
                    <div>HTTP status: <code>{debugInfo.status}</code></div>
                    <div>Array root: <code>{String(debugInfo.is_array)}</code> {debugInfo.array_length != null && `(len=${debugInfo.array_length})`}</div>
                    {debugInfo.json_keys && <div>Chiavi JSON: <code>{debugInfo.json_keys.join(", ") || "(nessuna)"}</code></div>}
                    <pre className="bg-muted/50 p-2 rounded overflow-auto max-h-64">
                      {debugInfo.body_preview || "(vuoto)"}
                    </pre>
                  </div>
                </details>
              )}
              {sample && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Mostra primo record grezzo
                  </summary>
                  <pre className="mt-2 text-xs bg-muted/50 p-2 rounded overflow-auto max-h-48">
                    {JSON.stringify(sample, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map((p) => {
              const current = drafts[p.id] ?? null;
              const available = employees.filter(
                (e) => e.id === current || !usedIds.has(e.id),
              );
              return (
                <div
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 border rounded-md"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {p.first_name} {p.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                  </div>
                  <Select
                    value={current ?? NONE}
                    onValueChange={(v) =>
                      setDrafts((d) => ({ ...d, [p.id]: v === NONE ? null : v }))
                    }
                  >
                    <SelectTrigger className="w-full sm:w-72">
                      <SelectValue placeholder="Non mappato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Non mappato —</SelectItem>
                      {available.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.first_name} {e.last_name}
                          {e.email ? ` (${e.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || loading}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Salva mappature
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface OffActivity {
  id: string;
  activity_name: string;
  category: string | null;
}

interface ActivityMapDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  knownUnmappedTypes?: string[];
}

const JethrActivityMappingDialog = ({ open, onOpenChange, knownUnmappedTypes = [] }: ActivityMapDialogProps) => {
  const qc = useQueryClient();

  // Attività del progetto OFF
  const { data: offActivities } = useQuery({
    queryKey: ["off-budget-items"],
    enabled: open,
    queryFn: async () => {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .ilike("name", "%OFF%");
      const projectIds = (projects ?? []).map((p) => p.id);
      if (!projectIds.length) return [] as OffActivity[];
      const { data } = await supabase
        .from("budget_items")
        .select("id, activity_name, category, project_id")
        .in("project_id", projectIds)
        .order("activity_name");
      return (data ?? []) as OffActivity[];
    },
  });

  // Tipi noti (da assenze + pending) + mapping esistenti
  const { data: types } = useQuery({
    queryKey: ["jethr-known-types", knownUnmappedTypes.join(",")],
    enabled: open,
    queryFn: async () => {
      const [{ data: a }, { data: p }, { data: m }] = await Promise.all([
        supabase.from("jethr_absences").select("type"),
        supabase.from("jethr_pending_requests").select("type"),
        supabase.from("jethr_activity_mappings").select("jethr_type, budget_item_id, enabled"),
      ]);
      const set = new Set<string>();
      for (const r of a ?? []) if (r.type) set.add(r.type);
      for (const r of p ?? []) if (r.type) set.add(r.type);
      for (const r of m ?? []) if (r.jethr_type) set.add(r.jethr_type);
      for (const t of knownUnmappedTypes) if (t) set.add(t);
      return {
        types: Array.from(set).sort(),
        mappings: (m ?? []) as Array<{ jethr_type: string; budget_item_id: string; enabled: boolean }>,
      };
    },
  });

  const [drafts, setDrafts] = useState<Record<string, string | null>>({});
  const [newType, setNewType] = useState("");

  // Sync drafts da query
  useEffect(() => {
    if (open && types) {
      const init: Record<string, string | null> = {};
      for (const t of types.types) {
        const found = types.mappings.find((m) => m.jethr_type === t);
        init[t] = found?.budget_item_id ?? null;
      }
      setDrafts(init);
    }
  }, [open, types]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const upserts = Object.entries(drafts)
        .filter(([_, v]) => v)
        .map(([jethr_type, budget_item_id]) => ({
          jethr_type,
          budget_item_id: budget_item_id!,
          enabled: true,
        }));
      const removeTypes = Object.entries(drafts)
        .filter(([_, v]) => !v)
        .map(([t]) => t);

      if (upserts.length) {
        const { error } = await supabase
          .from("jethr_activity_mappings")
          .upsert(upserts, { onConflict: "jethr_type" });
        if (error) throw error;
      }
      if (removeTypes.length) {
        const { error } = await supabase
          .from("jethr_activity_mappings")
          .delete()
          .in("jethr_type", removeTypes);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Mappature salvate");
      qc.invalidateQueries({ queryKey: ["jethr-known-types"] });
      setDrafts({});
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(`Errore: ${e.message ?? e}`),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setDrafts({});
      }}
    >
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mappa tipi Jethr → Attività progetto OFF</DialogTitle>
          <DialogDescription>
            Le assenze approvate vengono pianificate automaticamente sul progetto OFF
            usando questo mapping. Tipi non mappati vengono ignorati dalla pianificazione.
          </DialogDescription>
        </DialogHeader>

        {(() => {
          const allTypes = types?.types ?? [];
          const unmapped = allTypes.filter((t) => !drafts[t]);
          const mapped = allTypes.filter((t) => !!drafts[t]);

          // Suggerimento per similarità: prima match esatto/parziale per nome/categoria
          const suggestFor = (t: string): string | null => {
            const norm = (s: string) =>
              s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const tn = norm(t);
            const map: Record<string, string[]> = {
              vacation: ["ferie"],
              ferie: ["ferie"],
              permission: ["permesso"],
              permesso: ["permesso"],
              sick_leave: ["malattia"],
              sick: ["malattia"],
              malattia: ["malattia"],
              medical_visit: ["visita"],
              visita: ["visita"],
              blood_donation: ["donazione", "sangue"],
              donazione: ["donazione", "sangue"],
            };
            const needles = map[tn] ?? [tn];
            const acts = offActivities ?? [];
            for (const a of acts) {
              const an = norm(a.activity_name);
              if (needles.every((n) => an.includes(n))) return a.id;
            }
            for (const a of acts) {
              const an = norm(a.activity_name);
              if (needles.some((n) => an.includes(n))) return a.id;
            }
            return null;
          };

          const renderRow = (t: string, highlighted: boolean) => (
            <div
              key={t}
              className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2 border rounded-md ${
                highlighted ? "border-destructive/40 bg-destructive/5" : ""
              }`}
            >
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {highlighted && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                <div className="font-medium truncate">{t}</div>
              </div>
              {highlighted && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const sug = suggestFor(t);
                    if (sug) {
                      setDrafts((d) => ({ ...d, [t]: sug }));
                      toast.success(`Suggerito: ${(offActivities ?? []).find((a) => a.id === sug)?.activity_name}`);
                    } else {
                      toast.message("Nessuna corrispondenza automatica trovata");
                    }
                  }}
                >
                  Auto-suggerisci
                </Button>
              )}
              <Select
                value={drafts[t] ?? NONE}
                onValueChange={(v) =>
                  setDrafts((d) => ({ ...d, [t]: v === NONE ? null : v }))
                }
              >
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Non mappato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Non mappato —</SelectItem>
                  {(offActivities ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.activity_name}
                      {a.category ? ` (${a.category})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );

          return (
            <div className="space-y-4">
              {unmapped.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <h3 className="text-sm font-semibold">
                        Tipi Jethr non mappati
                      </h3>
                      <Badge variant="destructive">{unmapped.length}</Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = { ...drafts };
                        let n = 0;
                        for (const t of unmapped) {
                          const sug = suggestFor(t);
                          if (sug) {
                            next[t] = sug;
                            n++;
                          }
                        }
                        setDrafts(next);
                        toast.success(`${n} suggerimenti applicati`);
                      }}
                    >
                      Auto-suggerisci tutti
                    </Button>
                  </div>
                  {unmapped.map((t) => renderRow(t, true))}
                </div>
              )}

              {mapped.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Mappature attive
                  </h3>
                  {mapped.map((t) => renderRow(t, false))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 border border-dashed rounded-md">
                <input
                  type="text"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  placeholder="Aggiungi tipo Jethr (es. vacation)"
                  className="flex-1 min-w-0 bg-transparent border rounded px-2 py-1 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const t = newType.trim().toLowerCase();
                    if (!t) return;
                    setDrafts((d) => ({ ...d, [t]: d[t] ?? null }));
                    setNewType("");
                  }}
                >
                  Aggiungi
                </Button>
              </div>
            </div>
          );
        })()}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Salva mappature
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

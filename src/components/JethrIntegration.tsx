import { useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string | null>>({});

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("jethr-list-employees");
      if (error) throw error;
      setEmployees(data?.employees ?? []);
      // Pre-popola drafts dai binding esistenti
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

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Play, KeyRound, FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import cronstrue from 'cronstrue/i18n';
import { toast } from 'sonner';

interface CronJobStatus {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command: string | null;
  last_run_status: string | null;
  last_run_at: string | null;
  last_run_message: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  failures_24h: number;
  total_runs_24h: number;
}

interface CronRun {
  jobid: number;
  runid: number;
  jobname: string | null;
  schedule: string | null;
  status: string;
  return_message: string | null;
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
}

interface ManualInvocation {
  id: string;
  jobid: number;
  jobname: string;
  invoked_by: string | null;
  invoked_by_name: string | null;
  invoked_at: string;
  request_id: number | null;
  status: string;
  error_message: string | null;
  http_status_code: number | null;
  http_response_preview: string | null;
  http_responded_at: string | null;
}

interface DraftStatusRow {
  project_id: string;
  project_name: string;
  client_name: string | null;
  project_leader_id: string | null;
  project_leader_name: string | null;
  has_slack: boolean;
  has_drive_project: boolean;
  has_drive_client: boolean;
  has_client: boolean;
  status: 'pending' | 'generated' | 'approved' | 'discarded' | 'published' | 'skipped_no_sources';
  reason: string;
  draft_id: string | null;
  draft_created_at: string | null;
  slack_messages_count: number;
  drive_docs_count: number;
  gmail_messages_count: number;
  sources_used: string[] | null;
  published_update_id: string | null;
  week_start: string;
}

const DraftStatusBadge = ({ status }: { status: DraftStatusRow['status'] }) => {
  switch (status) {
    case 'published':
      return <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/20 border-blue-500/30">Pubblicato</Badge>;
    case 'generated':
      return <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/20 border-green-500/30">Generato</Badge>;
    case 'approved':
      return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/30">Approvato</Badge>;
    case 'discarded':
      return <Badge variant="outline">Scartato</Badge>;
    case 'skipped_no_sources':
      return <Badge variant="destructive">Saltato</Badge>;
    case 'pending':
    default:
      return <Badge variant="secondary">In attesa</Badge>;
  }
};

const fmt = (iso: string | null) =>
  iso ? format(new Date(iso), 'd MMM HH:mm:ss', { locale: it }) : '—';

const fmtRelative = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: it });
  } catch {
    return '—';
  }
};

const describeSchedule = (schedule: string): string => {
  try {
    return cronstrue.toString(schedule, { locale: 'it', use24HourTimeFormat: true });
  } catch {
    return schedule;
  }
};

const isHttpJob = (command: string | null) => !!command && /net\.http_post/i.test(command);

const StatusBadge = ({ status }: { status: string | null }) => {
  if (!status) return <Badge variant="outline">—</Badge>;
  if (status === 'succeeded' || status === 'sent')
    return <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/20 border-green-500/30">OK</Badge>;
  if (status === 'failed' || status === 'error')
    return <Badge variant="destructive">FAILED</Badge>;
  if (status === 'queued')
    return <Badge variant="secondary">In coda</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
};

const HttpStatusBadge = ({ code }: { code: number | null }) => {
  if (code == null) return <Badge variant="outline">—</Badge>;
  if (code >= 200 && code < 300)
    return <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/20 border-green-500/30">{code}</Badge>;
  if (code >= 400)
    return <Badge variant="destructive">{code}</Badge>;
  return <Badge variant="secondary">{code}</Badge>;
};

export const CronJobsMonitor = () => {
  const [jobToRun, setJobToRun] = useState<CronJobStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [syncingVault, setSyncingVault] = useState(false);
  const [draftFilter, setDraftFilter] = useState('');
  const [draftStatusFilter, setDraftStatusFilter] = useState<'all' | DraftStatusRow['status']>('all');

  const { data: jobs, refetch: refetchJobs, isLoading: loadingJobs } = useQuery({
    queryKey: ['admin-cron-jobs-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_cron_jobs_status');
      if (error) throw error;
      return (data || []) as CronJobStatus[];
    },
    refetchInterval: 60_000,
  });

  const { data: runs, refetch: refetchRuns, isLoading: loadingRuns } = useQuery({
    queryKey: ['admin-cron-runs'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_cron_runs', { p_limit: 100 });
      if (error) throw error;
      return (data || []) as CronRun[];
    },
    refetchInterval: 60_000,
  });

  const { data: manualInvocations, refetch: refetchManual, isLoading: loadingManual } = useQuery({
    queryKey: ['admin-manual-invocations'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_manual_invocations', { p_limit: 50 });
      if (error) throw error;
      return (data || []) as ManualInvocation[];
    },
    refetchInterval: 30_000,
  });

  const { data: draftStatuses, refetch: refetchDrafts, isLoading: loadingDrafts } = useQuery({
    queryKey: ['admin-progress-drafts-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_progress_drafts_status', { p_week_start: undefined as unknown as string });
      if (error) throw error;
      return (data || []) as unknown as DraftStatusRow[];
    },
    refetchInterval: 60_000,
  });

  const failingJobs = (jobs || []).filter(j => j.failures_24h > 0 || j.last_run_status === 'failed');
  const totalFailures24h = (jobs || []).reduce((s, j) => s + (j.failures_24h || 0), 0);

  const draftCounts = (draftStatuses || []).reduce(
    (acc, r) => {
      acc.total += 1;
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    { total: 0 } as Record<string, number>,
  );

  const filteredDrafts = (draftStatuses || []).filter(r => {
    if (draftStatusFilter !== 'all' && r.status !== draftStatusFilter) return false;
    if (draftFilter.trim()) {
      const q = draftFilter.trim().toLowerCase();
      return (
        r.project_name.toLowerCase().includes(q) ||
        (r.client_name || '').toLowerCase().includes(q) ||
        (r.project_leader_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const refetchAll = () => {
    refetchJobs();
    refetchRuns();
    refetchManual();
    refetchDrafts();
  };

  const handleRunNow = async () => {
    if (!jobToRun) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.rpc('admin_run_cron_job_now', { p_jobid: jobToRun.jobid });
      if (error) throw error;
      const result = data as { ok?: boolean; message?: string; error?: string; invocation_id?: string; request_id?: number };

      if (result?.ok === false) {
        toast.error(`Job non inviato: ${jobToRun.jobname}`, {
          description: result.error || 'Errore sconosciuto',
        });
      } else {
        toast.success(`Job "${jobToRun.jobname}" inviato`, {
          description: result?.message || 'Esecuzione asincrona avviata. Esito reale tra qualche secondo.',
        });
      }
      setJobToRun(null);

      // Poll the manual invocation to surface the real HTTP response code
      if (result?.invocation_id) {
        const invId = result.invocation_id;
        let attempts = 0;
        const poll = async () => {
          attempts += 1;
          await refetchManual();
          const { data: latest } = await supabase.rpc('admin_get_manual_invocations', { p_limit: 25 });
          const found = (latest as ManualInvocation[] | null)?.find(m => m.id === invId);
          if (found?.http_status_code != null) {
            const ok = found.http_status_code >= 200 && found.http_status_code < 300;
            const desc = found.http_response_preview
              ? found.http_response_preview.slice(0, 200)
              : '';
            (ok ? toast.success : toast.error)(
              `Risposta HTTP ${found.http_status_code} · ${jobToRun.jobname}`,
              { description: desc || undefined },
            );
            refetchAll();
            return;
          }
          if (attempts < 6) setTimeout(poll, 2500);
          else refetchAll();
        };
        setTimeout(poll, 3000);
      } else {
        setTimeout(refetchAll, 4000);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Esecuzione fallita', { description: msg });
    } finally {
      setRunning(false);
    }
  };

  const handleSyncVault = async () => {
    setSyncingVault(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-sync-cron-secret-to-vault', {
        body: {},
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; message?: string; error?: string; length?: number };
      if (payload?.ok) {
        toast.success('CRON_SECRET caricato nel vault', {
          description: payload.message || `Lunghezza: ${payload.length} caratteri. Riprova ora i job.`,
        });
      } else {
        toast.error('Sync fallita', { description: payload?.error || 'Errore sconosciuto' });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Sync fallita', { description: msg });
    } finally {
      setSyncingVault(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Summary alert */}
        {failingJobs.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {failingJobs.length} cron job in errore · {totalFailures24h} fallimenti nelle ultime 24h
            </AlertTitle>
            <AlertDescription>
              Se vedi tante risposte 401 nelle esecuzioni, il vault potrebbe non avere CRON_SECRET. Usa{' '}
              <strong>"Sincronizza CRON_SECRET nel vault"</strong> qui sotto.
            </AlertDescription>
          </Alert>
        )}

        {failingJobs.length === 0 && jobs && jobs.length > 0 && (
          <Alert className="border-green-500/40 bg-green-500/5">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle>Tutti i cron job sono in salute</AlertTitle>
            <AlertDescription>
              {jobs.length} job schedulati, nessun fallimento nelle ultime 24h.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleSyncVault} disabled={syncingVault}>
                <KeyRound className={`h-4 w-4 mr-2 ${syncingVault ? 'animate-pulse' : ''}`} />
                Sincronizza CRON_SECRET nel vault
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Copia il CRON_SECRET dalle Edge Function al vault Postgres.
              <br />Necessario se i cron rispondono 401.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={refetchAll} disabled={loadingJobs || loadingRuns || loadingManual || loadingDrafts}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingJobs || loadingRuns || loadingManual || loadingDrafts ? 'animate-spin' : ''}`} />
                Aggiorna ora
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Ricarica i dati visualizzati.
              <br />Non avvia alcun cron job.
            </TooltipContent>
          </Tooltip>
        </div>

        <Tabs defaultValue="jobs" className="w-full">
          <TabsList>
            <TabsTrigger value="jobs">Job ({jobs?.length || 0})</TabsTrigger>
            <TabsTrigger value="runs">
              Storico run ({runs?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="manual">
              Esecuzioni manuali ({manualInvocations?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="drafts">
              Stato Draft Progetti ({draftStatuses?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Cron job schedulati
                </CardTitle>
                <CardDescription>
                  Stato e prossima esecuzione di ogni job. I fallimenti vengono notificati su Slack ogni 30 minuti.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Ultimo run</TableHead>
                        <TableHead>Esito</TableHead>
                        <TableHead>Ultimo successo</TableHead>
                        <TableHead className="text-right">24h</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(jobs || []).map(job => {
                        const failed = job.last_run_status === 'failed';
                        const canRun = isHttpJob(job.command) && job.active;
                        return (
                          <TableRow key={job.jobid} className={failed ? 'bg-destructive/5' : ''}>
                            <TableCell className="font-mono text-xs">
                              <div className="font-medium">{job.jobname}</div>
                              {!job.active && <Badge variant="outline" className="mt-1">disattivato</Badge>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <div className="font-mono">{job.schedule}</div>
                              <div>{describeSchedule(job.schedule)}</div>
                            </TableCell>
                            <TableCell className="text-xs">{fmt(job.last_run_at)}</TableCell>
                            <TableCell>
                              <StatusBadge status={job.last_run_status} />
                              {failed && job.last_run_message && (
                                <div className="text-xs text-destructive mt-1 max-w-xs truncate" title={job.last_run_message}>
                                  {job.last_run_message.split('\n')[0]}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {job.last_success_at ? (
                                <div>
                                  <div>{fmt(job.last_success_at)}</div>
                                  <div className={`text-muted-foreground ${failed ? 'text-destructive font-medium' : ''}`}>
                                    {fmtRelative(job.last_success_at)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">mai</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              <span className={job.failures_24h > 0 ? 'text-destructive font-semibold' : ''}>
                                {job.failures_24h}
                              </span>
                              {' / '}
                              <span className="text-muted-foreground">{job.total_runs_24h}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!canRun}
                                title={
                                  !job.active
                                    ? 'Job disattivato'
                                    : !isHttpJob(job.command)
                                    ? 'Solo i job HTTP (net.http_post) possono essere eseguiti manualmente'
                                    : 'Esegui ora'
                                }
                                onClick={() => setJobToRun(job)}
                              >
                                <Play className="h-3.5 w-3.5 mr-1" />
                                Esegui
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(!jobs || jobs.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                            Nessun cron job trovato
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs">
            <Card>
              <CardHeader>
                <CardTitle>Ultimi 100 run</CardTitle>
                <CardDescription>Storico run schedulati ordinato dal più recente.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Inizio</TableHead>
                        <TableHead>Job</TableHead>
                        <TableHead>Esito</TableHead>
                        <TableHead className="text-right">Durata</TableHead>
                        <TableHead>Messaggio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(runs || []).map(run => (
                        <TableRow key={`${run.jobid}-${run.runid}`} className={run.status === 'failed' ? 'bg-destructive/5' : ''}>
                          <TableCell className="text-xs whitespace-nowrap">{fmt(run.start_time)}</TableCell>
                          <TableCell className="text-xs font-mono">{run.jobname || `#${run.jobid}`}</TableCell>
                          <TableCell><StatusBadge status={run.status} /></TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {run.duration_ms != null ? `${Math.round(run.duration_ms)}ms` : '—'}
                          </TableCell>
                          <TableCell className="text-xs max-w-md truncate" title={run.return_message || ''}>
                            {run.return_message?.split('\n')[0] || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!runs || runs.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                            Nessun run registrato
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual">
            <Card>
              <CardHeader>
                <CardTitle>Esecuzioni manuali dei cron</CardTitle>
                <CardDescription>
                  Job lanciati a mano dal pulsante "Esegui". Mostra anche la risposta HTTP reale ricevuta dalla edge function.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quando</TableHead>
                        <TableHead>Job</TableHead>
                        <TableHead>Da</TableHead>
                        <TableHead>Invio</TableHead>
                        <TableHead>HTTP</TableHead>
                        <TableHead>Risposta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(manualInvocations || []).map(inv => {
                        const httpFailed = inv.http_status_code != null && inv.http_status_code >= 400;
                        return (
                          <TableRow
                            key={inv.id}
                            className={inv.status === 'error' || httpFailed ? 'bg-destructive/5' : ''}
                          >
                            <TableCell className="text-xs whitespace-nowrap">
                              <div>{fmt(inv.invoked_at)}</div>
                              <div className="text-muted-foreground">{fmtRelative(inv.invoked_at)}</div>
                            </TableCell>
                            <TableCell className="text-xs font-mono">{inv.jobname}</TableCell>
                            <TableCell className="text-xs">{inv.invoked_by_name || '—'}</TableCell>
                            <TableCell><StatusBadge status={inv.status} /></TableCell>
                            <TableCell><HttpStatusBadge code={inv.http_status_code} /></TableCell>
                            <TableCell
                              className="text-xs max-w-md truncate"
                              title={inv.error_message || inv.http_response_preview || ''}
                            >
                              {inv.error_message
                                ? <span className="text-destructive">{inv.error_message}</span>
                                : inv.http_response_preview || (inv.status === 'sent' ? 'In attesa di risposta…' : '—')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(!manualInvocations || manualInvocations.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                            Nessuna esecuzione manuale registrata
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drafts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Stato Draft Progress · Settimana corrente
                </CardTitle>
                <CardDescription>
                  Per ogni progetto approvato non completato, lo stato del draft generato dal cron{' '}
                  <span className="font-mono">generate-slack-progress-drafts-thursday</span>.
                  Settimana di riferimento: lunedì{' '}
                  {draftStatuses?.[0]?.week_start
                    ? format(new Date(draftStatuses[0].week_start), 'd MMM yyyy', { locale: it })
                    : '—'}
                  .
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">Totale: {draftCounts.total || 0}</Badge>
                  <Badge className="bg-green-500/15 text-green-700 border-green-500/30">
                    Generati: {draftCounts.generated || 0}
                  </Badge>
                  <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                    Approvati: {draftCounts.approved || 0}
                  </Badge>
                  <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30">
                    Pubblicati: {draftCounts.published || 0}
                  </Badge>
                  <Badge variant="secondary">In attesa: {draftCounts.pending || 0}</Badge>
                  <Badge variant="destructive">Saltati (no fonti): {draftCounts.skipped_no_sources || 0}</Badge>
                  <Badge variant="outline">Scartati: {draftCounts.discarded || 0}</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca progetto, cliente o leader…"
                      value={draftFilter}
                      onChange={e => setDraftFilter(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(['all', 'pending', 'generated', 'published', 'skipped_no_sources', 'discarded'] as const).map(s => (
                      <Button
                        key={s}
                        size="sm"
                        variant={draftStatusFilter === s ? 'default' : 'outline'}
                        onClick={() => setDraftStatusFilter(s)}
                        className="h-8 text-xs"
                      >
                        {s === 'all' && 'Tutti'}
                        {s === 'pending' && 'In attesa'}
                        {s === 'generated' && 'Generati'}
                        {s === 'published' && 'Pubblicati'}
                        {s === 'skipped_no_sources' && 'Saltati'}
                        {s === 'discarded' && 'Scartati'}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Progetto</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Leader</TableHead>
                        <TableHead>Fonti</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Motivo / Dettaglio</TableHead>
                        <TableHead className="text-right">Generato</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDrafts.map(row => {
                        const sourcesAvail: string[] = [];
                        if (row.has_slack) sourcesAvail.push('Slack');
                        if (row.has_drive_project) sourcesAvail.push('Drive prog.');
                        if (row.has_drive_client) sourcesAvail.push('Drive cliente');
                        if (row.has_client) sourcesAvail.push('Gmail');
                        const sourcesUsedLabel = (row.sources_used || []).join(', ');
                        return (
                          <TableRow
                            key={row.project_id}
                            className={row.status === 'skipped_no_sources' ? 'bg-destructive/5' : ''}
                          >
                            <TableCell className="text-sm font-medium max-w-[220px] truncate" title={row.project_name}>
                              {row.project_name}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate" title={row.client_name || ''}>
                              {row.client_name || '—'}
                            </TableCell>
                            <TableCell className="text-xs">{row.project_leader_name || <span className="text-muted-foreground">non assegnato</span>}</TableCell>
                            <TableCell className="text-xs">
                              <div className="flex flex-wrap gap-1">
                                {sourcesAvail.length === 0 && <span className="text-destructive">nessuna</span>}
                                {sourcesAvail.map(s => (
                                  <Badge key={s} variant="outline" className="text-[10px] px-1 py-0">{s}</Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell><DraftStatusBadge status={row.status} /></TableCell>
                            <TableCell className="text-xs max-w-[340px]">
                              <div className="text-muted-foreground" title={row.reason}>{row.reason}</div>
                              {row.draft_id && (row.slack_messages_count + row.drive_docs_count + row.gmail_messages_count) > 0 && (
                                <div className="text-[11px] mt-1">
                                  {row.slack_messages_count > 0 && <span className="mr-2">💬 {row.slack_messages_count}</span>}
                                  {row.drive_docs_count > 0 && <span className="mr-2">📄 {row.drive_docs_count}</span>}
                                  {row.gmail_messages_count > 0 && <span className="mr-2">✉️ {row.gmail_messages_count}</span>}
                                  {sourcesUsedLabel && <span className="text-muted-foreground">({sourcesUsedLabel})</span>}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs whitespace-nowrap">
                              {row.draft_created_at ? (
                                <div>
                                  <div>{fmt(row.draft_created_at)}</div>
                                  <div className="text-muted-foreground">{fmtRelative(row.draft_created_at)}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredDrafts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                            {loadingDrafts ? 'Caricamento…' : 'Nessun progetto corrisponde ai filtri'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <AlertDialog open={!!jobToRun} onOpenChange={(open) => !open && setJobToRun(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eseguire ora questo cron job?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <div>
                    Verrà invocato manualmente il job{' '}
                    <span className="font-mono font-medium">{jobToRun?.jobname}</span>.
                  </div>
                  <div className="text-xs text-muted-foreground">
                    L'esecuzione è asincrona (pg_net): l'esito reale apparirà nel tab "Esecuzioni manuali" dopo qualche secondo.
                    L'azione viene tracciata nel registro audit.
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={running}>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleRunNow} disabled={running}>
                {running ? 'Esecuzione…' : 'Esegui ora'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
};

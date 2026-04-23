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
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Play } from 'lucide-react';
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
  if (status === 'succeeded')
    return <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/20 border-green-500/30">OK</Badge>;
  if (status === 'failed')
    return <Badge variant="destructive">FAILED</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
};

export const CronJobsMonitor = () => {
  const [jobToRun, setJobToRun] = useState<CronJobStatus | null>(null);
  const [running, setRunning] = useState(false);

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

  const failingJobs = (jobs || []).filter(j => j.failures_24h > 0 || j.last_run_status === 'failed');
  const totalFailures24h = (jobs || []).reduce((s, j) => s + (j.failures_24h || 0), 0);

  const handleRefresh = () => {
    refetchJobs();
    refetchRuns();
  };

  const handleRunNow = async () => {
    if (!jobToRun) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.rpc('admin_run_cron_job_now', { p_jobid: jobToRun.jobid });
      if (error) throw error;
      toast.success(`Job "${jobToRun.jobname}" accodato`, {
        description:
          (data as any)?.message ||
          'Esecuzione asincrona avviata. Controlla i log della edge function tra qualche secondo.',
      });
      setJobToRun(null);
      // Refetch dopo 4s per dare tempo al job di registrarsi
      setTimeout(() => {
        refetchJobs();
        refetchRuns();
      }, 4000);
    } catch (e: any) {
      toast.error('Esecuzione fallita', { description: e?.message || String(e) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary alert */}
      {failingJobs.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {failingJobs.length} cron job in errore · {totalFailures24h} fallimenti nelle ultime 24h
          </AlertTitle>
          <AlertDescription>
            Controlla i job nella lista qui sotto. Le notifiche Slack vengono inviate automaticamente ogni 30 minuti.
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

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loadingJobs || loadingRuns}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingJobs || loadingRuns ? 'animate-spin' : ''}`} />
          Aggiorna
        </Button>
      </div>

      <Tabs defaultValue="jobs" className="w-full">
        <TabsList>
          <TabsTrigger value="jobs">Job ({jobs?.length || 0})</TabsTrigger>
          <TabsTrigger value="runs">
            Storico run ({runs?.length || 0})
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
              <CardDescription>Storico run ordinato dal più recente.</CardDescription>
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
                  L'esecuzione è asincrona (pg_net): l'esito reale apparirà nei log della edge function dopo qualche secondo.
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
  );
};

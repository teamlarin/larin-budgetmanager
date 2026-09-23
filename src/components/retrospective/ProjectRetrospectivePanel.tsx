import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Send, Users, Download, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useProjectTeam } from '@/hooks/useProjectTasks';
import { getProfileDisplayName } from '@/types/workflow';
import {
  useProjectRetrospective,
  RETRO_STATUS_LABELS,
  SURVEY_QUESTIONS,
  DELIVERABLE_OWNER_LABELS,
  DELIVERABLE_STATUS_LABELS,
  type RetrospectiveMetrics,
  type RetrospectiveStatus,
} from '@/hooks/useProjectRetrospective';
import { RetrospectiveSurveyCard } from './RetrospectiveSurveyCard';
import { ProjectDeliverablesCard } from './ProjectDeliverablesCard';
import { RetrospectiveActionsCard } from './RetrospectiveActionsCard';
import { useProjectDeliverables } from '@/hooks/useProjectRetrospective';
import { useProjectCsat } from '@/hooks/useProjectCsat';

interface Props {
  projectId: string;
  projectName: string;
  clientName?: string | null;
  currentUserId?: string | null;
  canManage: boolean;
  metrics: RetrospectiveMetrics;
}

const fmtHours = (v?: number | null) =>
  v == null ? '—' : `${Math.round(v * 10) / 10} h`;
const fmtPct = (v?: number | null) =>
  v == null ? '—' : `${Math.round(v * 10) / 10}%`;

export const ProjectRetrospectivePanel = ({
  projectId, projectName, clientName, currentUserId, canManage, metrics,
}: Props) => {
  const {
    retrospective, surveys, actions, isLoading,
    startRetrospective, updateRetrospective, saveMySurvey,
    createAction, updateAction, deleteAction,
  } = useProjectRetrospective(projectId);
  const { profiles } = useProjectTeam(projectId);
  const { deliverables } = useProjectDeliverables(projectId);

  const [summary, setSummary] = useState<string | null>(null);
  const [keyPoints, setKeyPoints] = useState<string | null>(null);
  const [meetingAt, setMeetingAt] = useState<string | null>(null);
  const [meetingLink, setMeetingLink] = useState<string | null>(null);

  const mySurvey = useMemo(
    () => surveys.find((s) => s.user_id === currentUserId) ?? null,
    [surveys, currentUserId],
  );

  const otd = useMemo(() => {
    const closed = deliverables.filter((d) => d.planned_date && d.actual_date);
    if (closed.length === 0) return { onTime: null as number | null, total: 0 };
    const onTime = closed.filter((d) => new Date(d.actual_date!) <= new Date(d.planned_date!)).length;
    return { onTime, total: closed.length };
  }, [deliverables]);

  const { data: csat, isLoading: csatLoading, isError: csatError } = useProjectCsat(projectName, clientName);

  const liveMetrics: RetrospectiveMetrics = {
    ...metrics,
    deliverablesOnTime: otd.onTime,
    deliverablesTotal: otd.total,
    customerSatisfaction: csat?.averageNps ?? null,
  };

  const nameOf = (userId: string) => {
    const p = profiles.find((x) => x.id === userId);
    return p ? getProfileDisplayName(p) : 'Membro del team';
  };

  const exportReport = () => {
    const lines: string[] = [];
    lines.push(`RETROSPETTIVA DI FINE PROGETTO`);
    lines.push(`Progetto: ${projectName}${clientName ? ` — ${clientName}` : ''}`);
    if (retrospective?.meeting_at) {
      lines.push(`Incontro: ${format(new Date(retrospective.meeting_at), 'd MMMM yyyy HH:mm', { locale: it })}`);
    }
    lines.push('');
    lines.push('DATI OGGETTIVI');
    lines.push(`- Marginalità residua: ${fmtPct(liveMetrics.residualMarginPct)} (target ${fmtPct(liveMetrics.targetMarginPct)})`);
    lines.push(`- Ore previste a budget: ${fmtHours(liveMetrics.plannedHours)}`);
    lines.push(`- Ore effettive confermate: ${fmtHours(liveMetrics.actualHours)}`);
    lines.push(`- Consegne puntuali: ${liveMetrics.deliverablesTotal ? `${liveMetrics.deliverablesOnTime}/${liveMetrics.deliverablesTotal}` : '—'}`);
    deliverables.forEach((d) => {
      const planned = d.planned_date ? format(new Date(d.planned_date), 'dd/MM/yyyy') : 's.d.';
      const actual = d.actual_date ? format(new Date(d.actual_date), 'dd/MM/yyyy') : '—';
      const applied = (d.gantt_impact_applied_days ?? 0) > 0 ? `, slittamento applicato ${d.gantt_impact_applied_days} g` : '';
      lines.push(`  · ${d.name} (${DELIVERABLE_OWNER_LABELS[d.owner_side] ?? d.owner_side}) — prevista ${planned}, consegnata ${actual}, stato ${DELIVERABLE_STATUS_LABELS[d.status] ?? d.status}${applied}`);
    });
    lines.push(
      `- Soddisfazione cliente: ${
        liveMetrics.customerSatisfaction != null
          ? `${liveMetrics.customerSatisfaction}/10 (${csat?.responses.length ?? 0} rispost${(csat?.responses.length ?? 0) === 1 ? 'a' : 'e'})`
          : '—'
      }`,
    );
    (csat?.responses ?? []).forEach((r) => {
      const when = r.filledAt ? format(new Date(r.filledAt), 'dd/MM/yyyy') : 's.d.';
      lines.push(`  · ${when} — ${r.contactName || 'referente'}: ${r.nps ?? '—'}/10`);
      if (r.appreciated) lines.push(`    apprezzato: ${r.appreciated}`);
      if (r.improvements) lines.push(`    da migliorare: ${r.improvements}`);
    });
    lines.push('');
    lines.push('SINTESI');
    lines.push(retrospective?.summary || '—');
    lines.push('');
    lines.push('PUNTI CHIAVE (Start / Stop / Continue)');
    lines.push(retrospective?.key_points || '—');
    lines.push('');
    lines.push('RISPOSTE DEL TEAM');
    surveys.forEach((s) => {
      lines.push(`\n${nameOf(s.user_id)}`);
      SURVEY_QUESTIONS.forEach((q) => {
        const v = (s as any)[q.field];
        if (v) lines.push(`- ${q.label}: ${v}`);
      });
    });
    lines.push('');
    lines.push('AZIONI E PROCESSI DA AGGIORNARE');
    actions.forEach((a) => {
      const owner = a.owner_id ? nameOf(a.owner_id) : 'da assegnare';
      const due = a.due_date ? format(new Date(a.due_date), 'dd/MM/yyyy') : 'da definire';
      lines.push(`- ${a.title} (owner: ${owner}, scadenza: ${due}${a.updates_playbook ? ', aggiorna playbook' : ''})`);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Retrospettiva - ${projectName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Caricamento...</p>;
  }

  if (!retrospective) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retrospettiva di fine progetto</CardTitle>
          <CardDescription>
            Raccogli l&apos;esperienza del team finché i ricordi sono freschi: dati oggettivi,
            questionario individuale, incontro e azioni di miglioramento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <Button
              onClick={() => startRetrospective.mutate(liveMetrics)}
              disabled={startRetrospective.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Avvia retrospettiva
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              La retrospettiva non è ancora stata avviata dal responsabile del progetto.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const status = retrospective.status as RetrospectiveStatus;
  const submitted = surveys.filter((s) => s.submitted_at).length;

  return (
    <div className="space-y-6">
      {/* Stato e incontro */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">Retrospettiva di fine progetto</CardTitle>
            <CardDescription>
              {submitted} question{submitted === 1 ? 'ario' : 'ari'} compilat{submitted === 1 ? 'o' : 'i'}
              {profiles.length > 0 ? ` su ${profiles.length} persone del team` : ''}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={status === 'completata' ? 'default' : 'secondary'}>
              {RETRO_STATUS_LABELS[status]}
            </Badge>
            <Button variant="outline" size="sm" onClick={exportReport}>
              <Download className="h-4 w-4 mr-1" />
              Verbale
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Marginalità residua" value={fmtPct(liveMetrics.residualMarginPct)} hint={`target ${fmtPct(liveMetrics.targetMarginPct)}`} />
            <Metric label="Ore a budget" value={fmtHours(liveMetrics.plannedHours)} />
            <Metric
              label="Ore effettive"
              value={fmtHours(liveMetrics.actualHours)}
              hint={
                liveMetrics.plannedHours && liveMetrics.actualHours != null
                  ? `${liveMetrics.actualHours > liveMetrics.plannedHours ? '+' : ''}${Math.round((liveMetrics.actualHours - liveMetrics.plannedHours) * 10) / 10} h`
                  : undefined
              }
            />
            <Metric
              label="Consegne puntuali"
              value={otd.total ? `${otd.onTime}/${otd.total}` : '—'}
            />
            <Metric
              label="Soddisfazione cliente"
              value={
                csatLoading
                  ? '…'
                  : liveMetrics.customerSatisfaction != null
                    ? `${liveMetrics.customerSatisfaction}/10`
                    : '—'
              }
              hint={
                csatError
                  ? 'foglio CSAT non raggiungibile'
                  : csat && csat.responses.length > 0
                    ? `${csat.responses.length} rispost${csat.responses.length === 1 ? 'a' : 'e'} dal foglio CSAT`
                    : 'nessuna risposta nel foglio CSAT'
              }
            />
          </div>

          {canManage && (
            <>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm">Data e ora incontro</Label>
                  <Input
                    type="datetime-local"
                    value={(meetingAt ?? retrospective.meeting_at?.slice(0, 16)) || ''}
                    onChange={(e) => setMeetingAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Link riunione</Label>
                  <Input
                    placeholder="https://meet.google.com/..."
                    value={meetingLink ?? retrospective.meeting_link ?? ''}
                    onChange={(e) => setMeetingLink(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    updateRetrospective.mutate({
                      meeting_at: meetingAt ? new Date(meetingAt).toISOString() : retrospective.meeting_at,
                      meeting_link: meetingLink ?? retrospective.meeting_link,
                      status: status === 'bozza' ? 'questionario_inviato' : 'incontro_fissato',
                    })
                  }
                >
                  Salva incontro
                </Button>
                {status === 'bozza' && (
                  <Button onClick={() => updateRetrospective.mutate({ status: 'questionario_inviato' })}>
                    <Send className="h-4 w-4 mr-2" />
                    Invia questionario al team
                  </Button>
                )}
                {status !== 'completata' && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      updateRetrospective.mutate({ status: 'completata', metrics: liveMetrics })
                    }
                  >
                    Chiudi retrospettiva
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Questionario personale */}
      <RetrospectiveSurveyCard
        mySurvey={mySurvey}
        disabled={status === 'completata'}
        saving={saveMySurvey.isPending}
        onSave={(answers) => saveMySurvey.mutate(answers)}
      />

      {/* Risposte aggregate (solo facilitatore) */}
      {canManage && surveys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Risposte del team
            </CardTitle>
            <CardDescription>Temi raggruppati per domanda, da presentare in riunione.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {SURVEY_QUESTIONS.map((q) => {
              const answers = surveys
                .map((s) => ({ user: s.user_id, text: (s as any)[q.field] as string | null }))
                .filter((a) => a.text && a.text.trim());
              return (
                <Collapsible key={q.field}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-3 text-left">
                    <span className="text-sm font-medium">{q.label}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {answers.length} rispost{answers.length === 1 ? 'a' : 'e'}
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 p-3">
                    {answers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nessuna risposta.</p>
                    ) : (
                      answers.map((a) => (
                        <div key={`${q.field}-${a.user}`} className="rounded-md bg-muted/50 p-3">
                          <p className="text-xs font-medium mb-1">{nameOf(a.user)}</p>
                          <p className="text-sm whitespace-pre-wrap break-words">{a.text}</p>
                        </div>
                      ))
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Soddisfazione cliente dal foglio CSAT */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Soddisfazione cliente</CardTitle>
          <CardDescription>
            Risposte lette in diretta dal foglio Customer Satisfaction, abbinate a questo progetto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {csatLoading ? (
            <p className="text-sm text-muted-foreground">Caricamento risposte…</p>
          ) : csatError ? (
            <p className="text-sm text-muted-foreground">
              Non riesco a leggere il foglio Customer Satisfaction in questo momento.
            </p>
          ) : (csat?.responses.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna risposta collegata a questo progetto nel foglio.
            </p>
          ) : (
            csat!.responses.map((r, i) => (
              <div key={`${r.filledAt ?? 'nd'}-${i}`} className="rounded-md border p-3 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium break-words">
                    {r.contactName || 'Referente'}
                    {r.filledAt ? ` — ${format(new Date(r.filledAt), 'd MMMM yyyy', { locale: it })}` : ''}
                  </p>
                  <Badge variant={r.nps != null && r.nps >= 9 ? 'default' : 'secondary'}>
                    {r.nps != null ? `${r.nps}/10` : 'senza voto'}
                  </Badge>
                </div>
                {r.appreciated && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    <span className="text-muted-foreground">Apprezzato: </span>
                    {r.appreciated}
                  </p>
                )}
                {r.improvements && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    <span className="text-muted-foreground">Da migliorare: </span>
                    {r.improvements}
                  </p>
                )}
                {r.notes && (
                  <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground">{r.notes}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ProjectDeliverablesCard projectId={projectId} canManage={canManage} />

      {/* Output documentale */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sintesi e punti chiave</CardTitle>
            <CardDescription>
              Start / Stop / Continue: cosa iniziare, cosa smettere, cosa mantenere.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Sintesi del progetto</Label>
              <Textarea
                rows={3}
                value={summary ?? retrospective.summary ?? ''}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Breve sintesi: obiettivi, andamento, esito."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Punti chiave discussi</Label>
              <Textarea
                rows={6}
                value={keyPoints ?? retrospective.key_points ?? ''}
                onChange={(e) => setKeyPoints(e.target.value)}
                placeholder={'START:\n- ...\n\nSTOP:\n- ...\n\nCONTINUE:\n- ...'}
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() =>
                  updateRetrospective.mutate({
                    summary: summary ?? retrospective.summary,
                    key_points: keyPoints ?? retrospective.key_points,
                  })
                }
              >
                Salva sintesi
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <RetrospectiveActionsCard
        actions={actions}
        profiles={profiles}
        canManage={canManage}
        onCreate={(input) => createAction.mutate(input)}
        onUpdate={(input) => updateAction.mutate(input)}
        onDelete={(id) => deleteAction.mutate(id)}
      />
    </div>
  );
};

const Metric = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-md border p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-lg font-semibold">{value}</p>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

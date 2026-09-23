import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, ListPlus, CalendarClock } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import {
  useProjectDeliverables,
  DELIVERABLE_OWNER_LABELS,
  DELIVERABLE_STATUS_LABELS,
  type DeliverableOwnerSide,
  type DeliverableStatus,
  type ProjectDeliverable,
} from '@/hooks/useProjectRetrospective';
import { GenerateDeliverablesDialog } from './GenerateDeliverablesDialog';

interface Props {
  projectId: string;
  canManage: boolean;
}

/** Registro consegne: date previste/effettive, stato e slittamento sulla timeline. */
export const ProjectDeliverablesCard = ({ projectId, canManage }: Props) => {
  const {
    deliverables,
    activities,
    createDeliverable,
    createDeliverablesFromActivities,
    updateDeliverable,
    applyGanttImpact,
    deleteDeliverable,
  } = useProjectDeliverables(projectId);

  const [newName, setNewName] = useState('');
  const [newPlanned, setNewPlanned] = useState('');
  const [newOwner, setNewOwner] = useState<DeliverableOwnerSide>('larin');
  const [generateOpen, setGenerateOpen] = useState(false);

  const availableActivities = useMemo(() => {
    const used = new Set(deliverables.map(d => d.budget_item_id).filter(Boolean) as string[]);
    return activities.filter(a => !used.has(a.id));
  }, [activities, deliverables]);

  const delay = (d: ProjectDeliverable) =>
    d.planned_date && d.actual_date
      ? differenceInCalendarDays(new Date(d.actual_date), new Date(d.planned_date))
      : null;

  const handleActualDate = (d: ProjectDeliverable, value: string) => {
    const actual_date = value || null;
    const patch: Partial<ProjectDeliverable> & { id: string } = { id: d.id, actual_date };
    if (actual_date) {
      if (d.status === 'da_fare' || d.status === 'in_corso') patch.status = 'completato';
      if (d.planned_date && d.gantt_impact_days === null) {
        const diff = differenceInCalendarDays(new Date(actual_date), new Date(d.planned_date));
        if (diff > 0) patch.gantt_impact_days = diff;
      }
    }
    updateDeliverable.mutate(patch);
  };

  const handleApplyImpact = (d: ProjectDeliverable) => {
    const delta = (d.gantt_impact_days ?? 0) - (d.gantt_impact_applied_days ?? 0);
    const confirmed = window.confirm(
      `Sposto l\u2019attività collegata e quelle successive di ${delta > 0 ? '+' : ''}${delta} giorni nella timeline del progetto?`,
    );
    if (confirmed) applyGanttImpact.mutate(d);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Consegne / Milestone</CardTitle>
          <CardDescription>
            Assegnazione, date previste ed effettive, stato e slittamento: alimenta la puntualità nei
            dati oggettivi della retrospettiva e può aggiornare la timeline.
          </CardDescription>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => setGenerateOpen(true)}>
            <ListPlus className="mr-1 h-4 w-4" />
            Genera da attività
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {deliverables.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna consegna registrata.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Assegnazione</TableHead>
                  <TableHead className="min-w-[200px]">Consegna</TableHead>
                  <TableHead className="w-[150px]">Prevista</TableHead>
                  <TableHead className="w-[150px]">Consegna Larin</TableHead>
                  <TableHead className="w-[150px]">Conferma cliente</TableHead>
                  <TableHead className="w-[140px]">Stato</TableHead>
                  <TableHead className="w-[110px]">Scostamento</TableHead>
                  <TableHead className="w-[200px]">Slittamento timeline</TableHead>
                  {canManage && <TableHead className="w-[60px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliverables.map((d) => {
                  const diff = delay(d);
                  const pending = (d.gantt_impact_days ?? 0) - (d.gantt_impact_applied_days ?? 0);
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Select
                          value={d.owner_side || 'larin'}
                          disabled={!canManage}
                          onValueChange={(v) =>
                            updateDeliverable.mutate({ id: d.id, owner_side: v as DeliverableOwnerSide })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(DELIVERABLE_OWNER_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="break-words font-medium">
                        {d.name}
                        {d.budget_item_id && (
                          <span className="mt-1 block text-xs font-normal text-muted-foreground">
                            Attività prevista collegata
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={d.planned_date || ''}
                          disabled={!canManage}
                          onChange={(e) =>
                            updateDeliverable.mutate({ id: d.id, planned_date: e.target.value || null })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={d.actual_date || ''}
                          disabled={!canManage}
                          onChange={(e) => handleActualDate(d, e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={d.client_confirmed_date || ''}
                          disabled={!canManage}
                          onChange={(e) =>
                            updateDeliverable.mutate({
                              id: d.id,
                              client_confirmed_date: e.target.value || null,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={d.status || 'da_fare'}
                          disabled={!canManage}
                          onValueChange={(v) =>
                            updateDeliverable.mutate({ id: d.id, status: v as DeliverableStatus })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(DELIVERABLE_STATUS_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {diff === null ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : diff <= 0 ? (
                          <Badge variant="outline" className="border-green-600/40 text-green-600">
                            In tempo
                          </Badge>
                        ) : (
                          <Badge variant="destructive">+{diff} g</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Input
                            type="number"
                            className="w-[90px]"
                            placeholder="giorni"
                            value={d.gantt_impact_days ?? ''}
                            disabled={!canManage}
                            onChange={(e) =>
                              updateDeliverable.mutate({
                                id: d.id,
                                gantt_impact_days: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                          />
                          {canManage && d.budget_item_id && pending !== 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              disabled={applyGanttImpact.isPending}
                              onClick={() => handleApplyImpact(d)}
                            >
                              <CalendarClock className="mr-1 h-3.5 w-3.5" />
                              Applica alla timeline
                            </Button>
                          )}
                          {d.gantt_impact_applied_days > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {d.gantt_impact_applied_days} g già applicati
                            </p>
                          )}
                          {!d.budget_item_id && (d.gantt_impact_days ?? 0) !== 0 && (
                            <p className="text-xs text-muted-foreground">
                              Solo annotazione (nessuna attività collegata)
                            </p>
                          )}
                        </div>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteDeliverable.mutate(d.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {canManage && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Nome consegna (es. Consegna sito)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Select value={newOwner} onValueChange={(v) => setNewOwner(v as DeliverableOwnerSide)}>
              <SelectTrigger className="sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DELIVERABLE_OWNER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="sm:w-[180px]"
              value={newPlanned}
              onChange={(e) => setNewPlanned(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={!newName.trim()}
              onClick={() => {
                createDeliverable.mutate(
                  {
                    name: newName.trim(),
                    planned_date: newPlanned || null,
                    owner_side: newOwner,
                  },
                  {
                    onSuccess: () => {
                      setNewName('');
                      setNewPlanned('');
                    },
                  },
                );
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Aggiungi
            </Button>
          </div>
        )}

        <GenerateDeliverablesDialog
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          activities={availableActivities}
          isSaving={createDeliverablesFromActivities.isPending}
          onConfirm={(input) =>
            createDeliverablesFromActivities.mutate(input, {
              onSuccess: () => setGenerateOpen(false),
            })
          }
        />
      </CardContent>
    </Card>
  );
};

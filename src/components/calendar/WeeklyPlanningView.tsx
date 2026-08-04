import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, CheckCircle, CalendarRange, ChevronDown, ChevronRight, Lock, Check, X } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { formatHours } from '@/lib/utils';
import { getDynamicCategorySolidColor } from '@/lib/categoryColors';
import { Activity, TimeTracking } from './calendarTypes';
import { minutesFromTimes } from './planningUtils';

export interface PlanningRow {
  budget_item_id: string;
  activity_name: string;
  project_id: string;
  project_name: string;
  category: string;
  plannedMinutes: number;
  confirmedMinutes: number;
  slots: TimeTracking[];
}

export interface SlotUpdatePayload {
  tracking: TimeTracking;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
}

interface WeeklyPlanningViewProps {
  weekStart: Date;
  numberOfDays: number;
  weekDays: Date[];
  trackings: TimeTracking[];
  activities: Activity[];
  weeklyContractHours: number;
  isReadOnly: boolean;
  onAdd: () => void;
  onEditRow: (row: PlanningRow) => void;
  onRemoveRow: (row: PlanningRow) => void;
  onUpdateSlot: (payload: SlotUpdatePayload) => void;
  onDeleteSlot: (tracking: TimeTracking) => void;
}

const isSlotConfirmed = (t: TimeTracking) => !!(t.actual_start_time && t.actual_end_time);

export function WeeklyPlanningView({
  weekStart,
  numberOfDays,
  weekDays,
  trackings,
  activities,
  weeklyContractHours,
  isReadOnly,
  onAdd,
  onEditRow,
  onRemoveRow,
  onUpdateSlot,
  onDeleteSlot,
}: WeeklyPlanningViewProps) {
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotDraft, setSlotDraft] = useState<{ date: string; start: string; end: string }>({ date: '', start: '', end: '' });

  const rows = useMemo<PlanningRow[]>(() => {
    const map = new Map<string, PlanningRow>();
    trackings.forEach(t => {
      if (!t.activity) return;
      const minutes = minutesFromTimes(t.scheduled_start_time, t.scheduled_end_time);
      const existing = map.get(t.budget_item_id);
      const confirmed = isSlotConfirmed(t);
      if (existing) {
        existing.plannedMinutes += minutes;
        if (confirmed) existing.confirmedMinutes += minutes;
        existing.slots.push(t);
      } else {
        map.set(t.budget_item_id, {
          budget_item_id: t.budget_item_id,
          activity_name: t.activity.activity_name,
          project_id: t.activity.project_id,
          project_name: t.activity.project_name,
          category: t.activity.category,
          plannedMinutes: minutes,
          confirmedMinutes: confirmed ? minutes : 0,
          slots: [t],
        });
      }
    });
    const result = Array.from(map.values());
    result.forEach(r =>
      r.slots.sort((a, b) =>
        (a.scheduled_date || '').localeCompare(b.scheduled_date || '') ||
        (a.scheduled_start_time || '').localeCompare(b.scheduled_start_time || '')
      )
    );
    return result.sort(
      (a, b) => a.project_name.localeCompare(b.project_name) || a.activity_name.localeCompare(b.activity_name)
    );
  }, [trackings]);

  const groupedByProject = useMemo(() => {
    const groups = new Map<string, PlanningRow[]>();
    rows.forEach(row => {
      const list = groups.get(row.project_name) || [];
      list.push(row);
      groups.set(row.project_name, list);
    });
    return Array.from(groups.entries());
  }, [rows]);

  /** Per-project comparison: activity budget hours vs already allocated vs planned this week */
  const projectSummary = useMemo(() => {
    const map = new Map<string, {
      project_id: string;
      project_name: string;
      budgetHours: number;
      allocatedHours: number;
      weekHours: number;
    }>();

    const weekByProject = new Map<string, number>();
    rows.forEach(r => {
      weekByProject.set(r.project_id, (weekByProject.get(r.project_id) || 0) + r.plannedMinutes / 60);
    });

    const relevantProjects = new Set<string>([...weekByProject.keys()]);

    activities.forEach(a => {
      if (!relevantProjects.has(a.project_id)) return;
      const entry = map.get(a.project_id) || {
        project_id: a.project_id,
        project_name: a.project_name,
        budgetHours: 0,
        allocatedHours: 0,
        weekHours: weekByProject.get(a.project_id) || 0,
      };
      entry.budgetHours += a.hours_worked || 0;
      entry.allocatedHours += a.planned_hours || 0;
      map.set(a.project_id, entry);
    });

    // Projects with week plans but no matching activity in the list (e.g. completed activities)
    weekByProject.forEach((weekHours, projectId) => {
      if (map.has(projectId)) return;
      const row = rows.find(r => r.project_id === projectId);
      map.set(projectId, {
        project_id: projectId,
        project_name: row?.project_name || '-',
        budgetHours: 0,
        allocatedHours: 0,
        weekHours,
      });
    });

    return Array.from(map.values()).sort((a, b) => a.project_name.localeCompare(b.project_name));
  }, [rows, activities]);

  const totalPlannedMinutes = rows.reduce((sum, r) => sum + r.plannedMinutes, 0);
  const plannedHours = totalPlannedMinutes / 60;
  const remainingHours = weeklyContractHours - plannedHours;

  const toggleRow = (id: string) =>
    setExpandedRows(prev => (prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]));

  const startEditSlot = (slot: TimeTracking) => {
    setEditingSlotId(slot.id);
    setSlotDraft({
      date: slot.scheduled_date || format(weekStart, 'yyyy-MM-dd'),
      start: (slot.scheduled_start_time || '09:00').substring(0, 5),
      end: (slot.scheduled_end_time || '10:00').substring(0, 5),
    });
  };

  const saveSlot = (slot: TimeTracking) => {
    if (!slotDraft.date || !slotDraft.start || !slotDraft.end) return;
    if (slotDraft.end <= slotDraft.start) return;
    onUpdateSlot({
      tracking: slot,
      scheduled_date: slotDraft.date,
      scheduled_start_time: slotDraft.start,
      scheduled_end_time: slotDraft.end,
    });
    setEditingSlotId(null);
  };

  const dayOptions = weekDays.length > 0 ? weekDays : Array.from({ length: numberOfDays }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Week summary */}
        <Card className="p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                Settimana {format(weekStart, 'd MMM', { locale: it })} - {format(addDays(weekStart, numberOfDays - 1), 'd MMM yyyy', { locale: it })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Pianifica le ore previste per settimana: gli orari vengono creati automaticamente nei giorni disponibili e puoi riassegnarli slot per slot.
              </div>
            </div>
            {!isReadOnly && (
              <Button size="sm" onClick={onAdd} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Aggiungi attività
              </Button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <div className="text-[11px] text-muted-foreground">Ore pianificate</div>
              <div className="text-lg font-bold">{formatHours(plannedHours)}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Ore contratto</div>
              <div className="text-lg font-bold">{weeklyContractHours > 0 ? formatHours(weeklyContractHours) : '-'}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Residuo</div>
              <div className={`text-lg font-bold ${remainingHours < 0 ? 'text-destructive' : ''}`}>
                {weeklyContractHours > 0 ? formatHours(Math.abs(remainingHours)) : '-'}
                {weeklyContractHours > 0 && remainingHours < 0 && ' in eccesso'}
              </div>
            </div>
          </div>
          {weeklyContractHours > 0 && (
            <Progress value={Math.min((plannedHours / weeklyContractHours) * 100, 100)} className="h-1.5 mt-3" />
          )}
        </Card>

        {/* Per-project summary */}
        {projectSummary.length > 0 && (
          <Card className="p-4">
            <div className="text-sm font-semibold mb-3">Riepilogo per progetto</div>
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[11px] text-muted-foreground">
                <div>Progetto</div>
                <div className="text-right w-20">Previste</div>
                <div className="text-right w-20">Allocate</div>
                <div className="text-right w-24">Settimana</div>
              </div>
              {projectSummary.map(p => {
                const coverage = p.budgetHours > 0 ? (p.allocatedHours / p.budgetHours) * 100 : 0;
                const overAllocated = p.budgetHours > 0 && p.allocatedHours > p.budgetHours;
                return (
                  <div key={p.project_id} className="space-y-1">
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center text-sm">
                      <div className="truncate font-medium">{p.project_name}</div>
                      <div className="text-right w-20 tabular-nums">{p.budgetHours > 0 ? formatHours(p.budgetHours) : '-'}</div>
                      <div className={`text-right w-20 tabular-nums ${overAllocated ? 'text-destructive font-semibold' : ''}`}>
                        {formatHours(p.allocatedHours)}
                      </div>
                      <div className="text-right w-24 tabular-nums font-semibold">{formatHours(p.weekHours)}</div>
                    </div>
                    {p.budgetHours > 0 && (
                      <Progress
                        value={Math.min(coverage, 100)}
                        className={`h-1 ${overAllocated ? '[&>div]:bg-destructive' : ''}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-[11px] text-muted-foreground mt-3">
              "Previste" = ore da budget delle attività del progetto assegnate a te. "Allocate" = ore già pianificate in totale (tutte le settimane). "Settimana" = ore pianificate in questa settimana.
            </div>
          </Card>
        )}

        {/* Activities grouped by project */}
        {groupedByProject.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nessuna attività pianificata in questa settimana.
          </Card>
        )}

        {groupedByProject.map(([projectName, projectRows]) => (
          <Card key={projectName} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">{projectName}</div>
              <div className="text-xs text-muted-foreground">
                {formatHours(projectRows.reduce((s, r) => s + r.plannedMinutes, 0) / 60)}
              </div>
            </div>
            <div className="space-y-2">
              {projectRows.map(row => {
                const isExpanded = expandedRows.includes(row.budget_item_id);
                return (
                  <div key={row.budget_item_id} className="rounded-md border">
                    <div className="flex items-center gap-3 p-2.5">
                      <button
                        type="button"
                        onClick={() => toggleRow(row.budget_item_id)}
                        className="text-muted-foreground hover:text-foreground"
                        title={isExpanded ? 'Nascondi slot' : 'Mostra slot'}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <div className={`w-2.5 h-8 rounded ${getDynamicCategorySolidColor(row.category)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{row.activity_name}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">{row.category}</Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {row.slots.length} slot in settimana
                          </span>
                          {row.confirmedMinutes > 0 && (
                            <span className="text-[11px] text-green-600 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {formatHours(row.confirmedMinutes / 60)} confermate
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm font-bold whitespace-nowrap">{formatHours(row.plannedMinutes / 60)}</div>
                      {!isReadOnly && (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditRow(row)} title="Modifica ore previste (ridistribuisce gli slot)">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemoveRow(row)} title="Rimuovi dalla settimana">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-muted/30 p-2.5 space-y-2">
                        {row.slots.map(slot => {
                          const confirmed = isSlotConfirmed(slot);
                          const editing = editingSlotId === slot.id;
                          const slotMinutes = minutesFromTimes(slot.scheduled_start_time, slot.scheduled_end_time);
                          if (editing) {
                            return (
                              <div key={slot.id} className="flex items-center gap-2 flex-wrap rounded-md bg-background border p-2">
                                <Select value={slotDraft.date} onValueChange={v => setSlotDraft(d => ({ ...d, date: v }))}>
                                  <SelectTrigger className="h-8 w-[150px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {dayOptions.map(d => {
                                      const value = format(d, 'yyyy-MM-dd');
                                      return (
                                        <SelectItem key={value} value={value}>
                                          {format(d, 'EEE d MMM', { locale: it })}
                                        </SelectItem>
                                      );
                                    })}
                                    {!dayOptions.some(d => format(d, 'yyyy-MM-dd') === slotDraft.date) && (
                                      <SelectItem value={slotDraft.date}>{slotDraft.date}</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="time"
                                  step={900}
                                  value={slotDraft.start}
                                  onChange={e => setSlotDraft(d => ({ ...d, start: e.target.value }))}
                                  className="h-8 w-[110px]"
                                />
                                <Input
                                  type="time"
                                  step={900}
                                  value={slotDraft.end}
                                  onChange={e => setSlotDraft(d => ({ ...d, end: e.target.value }))}
                                  className="h-8 w-[110px]"
                                />
                                <div className="flex items-center gap-1 ml-auto">
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => saveSlot(slot)} title="Salva">
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingSlotId(null)} title="Annulla">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={slot.id} className="flex items-center gap-3 rounded-md bg-background border p-2">
                              <div className="text-xs font-medium w-[110px] shrink-0">
                                {slot.scheduled_date ? format(new Date(`${slot.scheduled_date}T00:00:00`), 'EEE d MMM', { locale: it }) : '-'}
                              </div>
                              <div className="text-xs text-muted-foreground tabular-nums">
                                {(slot.scheduled_start_time || '').substring(0, 5)} - {(slot.scheduled_end_time || '').substring(0, 5)}
                              </div>
                              <div className="text-xs font-semibold tabular-nums">{formatHours(slotMinutes / 60)}</div>
                              {confirmed && (
                                <Badge variant="outline" className="text-[10px] text-green-600 border-green-600/40 gap-1">
                                  <Lock className="h-3 w-3" />
                                  confermato
                                </Badge>
                              )}
                              {!isReadOnly && (
                                <div className="flex items-center gap-1 ml-auto">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditSlot(slot)} title="Riassegna giorno / orario">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => onDeleteSlot(slot)}
                                    title="Elimina slot"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {row.slots.length === 0 && (
                          <div className="text-xs text-muted-foreground text-center py-2">Nessuno slot</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

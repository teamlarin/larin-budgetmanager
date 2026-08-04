import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Plus, Pencil, Trash2, CheckCircle, CalendarRange } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { formatHours } from '@/lib/utils';
import { getDynamicCategorySolidColor } from '@/lib/categoryColors';
import { TimeTracking } from './calendarTypes';
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

interface WeeklyPlanningViewProps {
  weekStart: Date;
  numberOfDays: number;
  trackings: TimeTracking[];
  weeklyContractHours: number;
  isReadOnly: boolean;
  onAdd: () => void;
  onEditRow: (row: PlanningRow) => void;
  onRemoveRow: (row: PlanningRow) => void;
}

export function WeeklyPlanningView({
  weekStart,
  numberOfDays,
  trackings,
  weeklyContractHours,
  isReadOnly,
  onAdd,
  onEditRow,
  onRemoveRow,
}: WeeklyPlanningViewProps) {
  const rows = useMemo<PlanningRow[]>(() => {
    const map = new Map<string, PlanningRow>();
    trackings.forEach(t => {
      if (!t.activity) return;
      const minutes = minutesFromTimes(t.scheduled_start_time, t.scheduled_end_time);
      const existing = map.get(t.budget_item_id);
      const isConfirmed = !!(t.actual_start_time && t.actual_end_time);
      if (existing) {
        existing.plannedMinutes += minutes;
        if (isConfirmed) existing.confirmedMinutes += minutes;
        existing.slots.push(t);
      } else {
        map.set(t.budget_item_id, {
          budget_item_id: t.budget_item_id,
          activity_name: t.activity.activity_name,
          project_id: t.activity.project_id,
          project_name: t.activity.project_name,
          category: t.activity.category,
          plannedMinutes: minutes,
          confirmedMinutes: isConfirmed ? minutes : 0,
          slots: [t],
        });
      }
    });
    return Array.from(map.values()).sort(
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

  const totalPlannedMinutes = rows.reduce((sum, r) => sum + r.plannedMinutes, 0);
  const plannedHours = totalPlannedMinutes / 60;
  const remainingHours = weeklyContractHours - plannedHours;

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
                Pianifica le ore previste per settimana: gli orari vengono creati automaticamente nei giorni disponibili.
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
              {projectRows.map(row => (
                <div key={row.budget_item_id} className="flex items-center gap-3 rounded-md border p-2.5">
                  <div className={`w-2.5 h-8 rounded ${getDynamicCategorySolidColor(row.category)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{row.activity_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px]">{row.category}</Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {row.slots.length} {row.slots.length === 1 ? 'slot' : 'slot'} in settimana
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditRow(row)} title="Modifica ore previste">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemoveRow(row)} title="Rimuovi dalla settimana">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

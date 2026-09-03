import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Palmtree, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatHours } from '@/lib/utils';
import type { TeamWeekMember } from '@/hooks/useTeamWeek';

/**
 * Calendario interno del team: righe = persone, colonne = lun–ven.
 * Ogni cella mostra gli slot della giornata: pianificati (contorno) e confermati (pieno).
 */
export const TeamWeekCalendar = ({
  members,
  onPlan,
}: {
  members: TeamWeekMember[];
  onPlan?: (userId: string, userName: string, date: string) => void;
}) => {
  const days = members[0]?.byDay || [];
  if (days.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Nessun dato di settimana</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-[minmax(160px,1fr)_repeat(5,minmax(0,1fr))] gap-2 pb-2 border-b">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Persona
          </div>
          {days.map(d => (
            <div
              key={d.date}
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground capitalize"
            >
              {format(new Date(`${d.date}T00:00:00`), 'EEE d', { locale: it })}
            </div>
          ))}
        </div>

        {members.map(m => (
          <div
            key={m.userId}
            className="grid grid-cols-[minmax(160px,1fr)_repeat(5,minmax(0,1fr))] gap-2 py-2 border-b last:border-b-0"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{m.fullName}</div>
              <div className="text-[11px] text-muted-foreground">
                {formatHours(m.plannedHours)} pian. · {formatHours(m.confirmedHours)} conf. ·{' '}
                {formatHours(m.capacityNet)} cap.
              </div>
            </div>

            {m.byDay.map(day => (
              <div key={day.date} className="space-y-1">
                {day.slots.map(slot => (
                  <div
                    key={slot.id}
                    title={`${slot.projectName} · ${slot.startTime || ''}–${slot.endTime || ''}`}
                    className={`rounded px-1.5 py-1 text-[11px] leading-tight truncate border ${
                      slot.absence
                        ? 'bg-muted text-muted-foreground border-transparent'
                        : slot.confirmed
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-primary/10 text-foreground border-primary/40 border-dashed'
                    }`}
                  >
                    {slot.absence && <Palmtree className="inline h-3 w-3 mr-1" />}
                    <span className="font-medium">{slot.startTime || '--:--'}</span>{' '}
                    {slot.projectName}
                  </div>
                ))}
                {onPlan && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-full text-[11px] text-muted-foreground"
                    onClick={() => onPlan(m.userId, m.fullName, day.date)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Pianifica
                  </Button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 pt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-4 rounded border border-dashed border-primary/40 bg-primary/10" />
          Pianificato
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-4 rounded bg-primary" />
          Confermato
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-4 rounded bg-muted" />
          Assenza
        </span>
      </div>
    </div>
  );
};

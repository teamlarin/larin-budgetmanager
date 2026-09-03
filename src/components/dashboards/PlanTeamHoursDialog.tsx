import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { buildBusyMap, distributeMinutesAcrossDays } from '@/components/calendar/planningUtils';

export interface PlanTeamHoursTarget {
  userId: string;
  userName: string;
  /** yyyy-MM-dd */
  date: string;
}

const WORK_DAY_START = '09:00';
const WORK_DAY_END = '18:00';

export function PlanTeamHoursDialog({
  target,
  onOpenChange,
}: {
  target: PlanTeamHoursTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = !!target;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [activityId, setActivityId] = useState('');
  const [hours, setHours] = useState('2');
  const [minutes, setMinutes] = useState('0');
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProjectId('');
    setProjectSearch('');
    setActivityId('');
    setHours('2');
    setMinutes('0');
    setConfirmStep(false);
  }, [open, target?.userId, target?.date]);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['team-week-plan-projects', target?.userId],
    queryFn: async () => {
      if (!target) return [] as { id: string; name: string }[];
      const [leaderRes, memberRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name')
          .eq('project_status', 'aperto')
          .eq('project_leader_id', target.userId),
        supabase
          .from('projects')
          .select('id, name, project_members!inner(user_id)')
          .eq('project_status', 'aperto')
          .eq('project_members.user_id', target.userId),
      ]);
      const unique = new Map<string, { id: string; name: string }>();
      [...(leaderRes.data || []), ...(memberRes.data || [])].forEach((p: any) => {
        if (!unique.has(p.id)) unique.set(p.id, { id: p.id, name: p.name });
      });
      return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: open,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['team-week-plan-activities', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('budget_items')
        .select('id, activity_name, category')
        .eq('project_id', projectId)
        .eq('is_product', false)
        .neq('activity_name', 'Ore importate')
        .order('category')
        .order('activity_name');
      return (data || []).filter(a => (a.category || '').toLowerCase() !== 'import');
    },
    enabled: open && !!projectId,
  });

  const filteredProjects = useMemo(
    () =>
      projects.filter(
        p => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase())
      ),
    [projects, projectSearch]
  );

  const totalMinutes = (parseInt(hours || '0', 10) || 0) * 60 + (parseInt(minutes || '0', 10) || 0);
  const isValid = !!activityId && totalMinutes > 0;

  const planMutation = useMutation({
    mutationFn: async () => {
      if (!target) return;
      const { data: existing } = await supabase
        .from('activity_time_tracking')
        .select('scheduled_date, scheduled_start_time, scheduled_end_time')
        .eq('user_id', target.userId)
        .eq('scheduled_date', target.date);

      const busyByDate = buildBusyMap(existing || []);
      const { slots, unallocatedMinutes } = distributeMinutesAcrossDays({
        totalMinutes,
        days: [new Date(`${target.date}T00:00:00`)],
        workDayStart: WORK_DAY_START,
        workDayEnd: WORK_DAY_END,
        busyByDate,
      });

      if (slots.length === 0) {
        throw new Error('Nessuno spazio libero in giornata per queste ore.');
      }

      const { error } = await supabase.from('activity_time_tracking').insert(
        slots.map(slot => ({
          budget_item_id: activityId,
          user_id: target.userId,
          scheduled_date: slot.scheduled_date,
          scheduled_start_time: slot.scheduled_start_time,
          scheduled_end_time: slot.scheduled_end_time,
        })) as never
      );
      if (error) throw error;
      return { unallocatedMinutes };
    },
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: ['team-week'] });
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['workload-weekly'] });
      toast({
        title: 'Ore pianificate',
        description:
          result?.unallocatedMinutes && result.unallocatedMinutes > 0
            ? `${Math.round(result.unallocatedMinutes / 60 * 10) / 10}h non allocate: giornata piena.`
            : 'Slot creato nella giornata selezionata.',
      });
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({
        title: 'Pianificazione non riuscita',
        description: e?.message || 'Errore inatteso',
        variant: 'destructive',
      });
    },
  });

  const dayLabel = target
    ? format(new Date(`${target.date}T00:00:00`), 'EEEE d MMMM', { locale: it })
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pianifica ore</DialogTitle>
          <DialogDescription>
            {target?.userName} · <span className="capitalize">{dayLabel}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Progetto</Label>
            <Select
              value={projectId}
              onValueChange={v => {
                setProjectId(v);
                setActivityId('');
                setProjectSearch('');
                setConfirmStep(false);
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleziona un progetto" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 pb-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca progetto..."
                      value={projectSearch}
                      onChange={e => setProjectSearch(e.target.value)}
                      className="pl-8 h-8"
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => e.stopPropagation()}
                    />
                  </div>
                </div>
                {filteredProjects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
                {filteredProjects.length === 0 && (
                  <div className="py-2 px-2 text-sm text-muted-foreground text-center">
                    {projectsLoading
                      ? 'Caricamento progetti...'
                      : 'Nessun progetto aperto per questa persona'}
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {projectId && (
            <div>
              <Label>Attività prevista</Label>
              <Select
                value={activityId}
                onValueChange={v => {
                  setActivityId(v);
                  setConfirmStep(false);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleziona un'attività" />
                </SelectTrigger>
                <SelectContent>
                  {activities.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <span>{a.activity_name}</span>
                        {a.category && (
                          <Badge variant="secondary" className="text-xs">
                            {a.category}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  {activities.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      {activitiesLoading ? 'Caricamento…' : 'Nessuna attività disponibile'}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="team-plan-hours">Ore</Label>
              <Input
                id="team-plan-hours"
                type="number"
                min={0}
                max={12}
                value={hours}
                onChange={e => {
                  setHours(e.target.value);
                  setConfirmStep(false);
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="team-plan-minutes">Minuti</Label>
              <Select
                value={minutes}
                onValueChange={v => {
                  setMinutes(v);
                  setConfirmStep(false);
                }}
              >
                <SelectTrigger id="team-plan-minutes" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['0', '15', '30', '45'].map(m => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {confirmStep && (
            <p className="text-sm text-muted-foreground rounded-md border p-3">
              Confermi la pianificazione di {Math.round((totalMinutes / 60) * 10) / 10}h per{' '}
              {target?.userName} in data <span className="capitalize">{dayLabel}</span>? Lo slot
              viene inserito dopo gli impegni già presenti.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          {confirmStep ? (
            <Button disabled={planMutation.isPending} onClick={() => planMutation.mutate()}>
              {planMutation.isPending ? 'Pianificazione…' : 'Conferma'}
            </Button>
          ) : (
            <Button disabled={!isValid} onClick={() => setConfirmStep(true)}>
              Pianifica
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

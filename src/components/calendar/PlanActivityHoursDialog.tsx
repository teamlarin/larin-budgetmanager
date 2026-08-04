import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { Activity } from './calendarTypes';

interface PlanActivityHoursDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activities: Activity[];
  /** When set, the activity is fixed (edit mode) */
  fixedActivity?: Activity | null;
  initialMinutes?: number;
  isPending?: boolean;
  onSubmit: (data: { budget_item_id: string; minutes: number }) => void;
}

export function PlanActivityHoursDialog({
  open,
  onOpenChange,
  activities,
  fixedActivity = null,
  initialMinutes = 0,
  isPending = false,
  onSubmit,
}: PlanActivityHoursDialogProps) {
  const [projectId, setProjectId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('0');

  useEffect(() => {
    if (!open) return;
    setProjectSearch('');
    if (fixedActivity) {
      setProjectId(fixedActivity.project_id);
      setActivityId(fixedActivity.id);
    } else {
      setProjectId('');
      setActivityId('');
    }
    setHours(String(Math.floor(initialMinutes / 60)));
    setMinutes(String(initialMinutes % 60));
  }, [open, fixedActivity, initialMinutes]);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    activities.forEach(a => map.set(a.project_id, a.project_name));
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activities]);

  const projectActivities = useMemo(
    () => activities.filter(a => a.project_id === projectId),
    [activities, projectId]
  );

  const totalMinutes = (parseInt(hours || '0', 10) || 0) * 60 + (parseInt(minutes || '0', 10) || 0);
  const isValid = !!activityId && totalMinutes > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{fixedActivity ? 'Modifica ore previste' : 'Pianifica ore settimanali'}</DialogTitle>
          <DialogDescription>
            Le ore indicate vengono distribuite automaticamente sui giorni lavorativi disponibili della settimana.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {fixedActivity ? (
            <div className="rounded-md border p-3">
              <div className="text-sm font-medium">{fixedActivity.activity_name}</div>
              <div className="text-xs text-muted-foreground">{fixedActivity.project_name}</div>
            </div>
          ) : (
            <>
              <div>
                <Label>Progetto</Label>
                <Select
                  value={projectId}
                  onValueChange={v => {
                    setProjectId(v);
                    setActivityId('');
                    setProjectSearch('');
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
                    {projects
                      .filter(p => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                      .map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    {projects.filter(p => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
                      <div className="py-2 px-2 text-sm text-muted-foreground text-center">Nessun progetto trovato</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {projectId && (
                <div>
                  <Label>Attività</Label>
                  <Select value={activityId} onValueChange={setActivityId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleziona un'attività" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectActivities.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          <div className="flex items-center gap-2">
                            <span>{a.activity_name}</span>
                            <Badge variant="secondary" className="text-xs">{a.category}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                      {projectActivities.length === 0 && (
                        <div className="p-2 text-sm text-muted-foreground text-center">Nessuna attività disponibile</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="plan-hours">Ore previste</Label>
              <Input
                id="plan-hours"
                type="number"
                min={0}
                max={80}
                value={hours}
                onChange={e => setHours(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="plan-minutes">Minuti</Label>
              <Select value={minutes} onValueChange={setMinutes}>
                <SelectTrigger id="plan-minutes" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['0', '15', '30', '45'].map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button
            disabled={!isValid || isPending}
            onClick={() => onSubmit({ budget_item_id: activityId, minutes: totalMinutes })}
          >
            {fixedActivity ? 'Aggiorna' : 'Pianifica'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCategoryBadgeColor } from '@/lib/categoryColors';
import { FileDown, Loader2, ChevronsUpDown, Check, FolderOpen, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ProjectActivity {
  id: string;
  activity_name: string;
  category: string;
  hours_worked: number;
  duration_days: number | null;
  created_from?: string | null;
}

interface ProjectOption {
  id: string;
  name: string;
  client_name?: string;
  status?: string;
}

export interface StagedImportedActivity {
  activity_name: string;
  category: string;
  hours_worked: number;
  duration_days: number | null;
  source_project_name: string;
}

const STATUS_LABEL: Record<string, string> = {
  aperto: 'Aperto',
  in_partenza: 'In partenza',
  completato: 'Completato',
};

interface ImportActivitiesFromProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Progetto destinazione. Se assente (es. creazione budget), le attività vengono restituite via onSelectActivities. */
  projectId?: string;
  onImportComplete?: () => void;
  onSelectActivities?: (activities: StagedImportedActivity[]) => void;
}

export const ImportActivitiesFromProjectDialog = ({
  open,
  onOpenChange,
  projectId,
  onImportComplete,
  onSelectActivities
}: ImportActivitiesFromProjectDialogProps) => {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [resetHours, setResetHours] = useState(false);

  // Fetch open projects (exclude current)
  const { data: projects = [], isLoading: projectsLoading } = useQuery<ProjectOption[]>({
    queryKey: ['projects-for-activity-import', projectId ?? null],
    queryFn: async () => {
      let q = supabase
        .from('projects')
        .select('id, name, project_status, clients(name)')
        .in('project_status', ['aperto', 'in_partenza', 'completato'])
        .order('name');
      if (projectId) q = q.neq('id', projectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        client_name: p.clients?.name,
        status: p.project_status,
      }));
    },
    enabled: open
  });

  // Fetch activities of selected project (only non-product, non-calendar)
  const { data: projectActivities = [], isLoading: activitiesLoading } = useQuery<ProjectActivity[]>({
    queryKey: ['project-activities-for-import', selectedProjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('id, activity_name, category, hours_worked, duration_days, created_from')
        .eq('project_id', selectedProjectId)
        .eq('is_product', false)
        .order('display_order', { ascending: true });
      if (error) throw error;
      // Filter out calendar-created items
      return (data || []).filter((item) => item.created_from !== 'calendar');
    },
    enabled: !!selectedProjectId
  });

  // Figure precedenti: persone che hanno registrato ore confermate sulle attività (solo indicazione testuale)
  const { data: previousPeople = {} } = useQuery<Record<string, string[]>>({
    queryKey: ['project-activities-previous-people', selectedProjectId, projectActivities.map(a => a.id).join(',')],
    queryFn: async () => {
      const ids = projectActivities.map(a => a.id);
      const rows: { budget_item_id: string; user_id: string }[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('activity_time_tracking')
            .select('budget_item_id, user_id')
            .in('budget_item_id', chunk)
            .not('actual_start_time', 'is', null)
            .range(from, from + 999);
          if (error) throw error;
          rows.push(...((data || []) as any));
          if (!data || data.length < 1000) break;
          from += 1000;
        }
      }
      const userIds = [...new Set(rows.map(r => r.user_id))];
      const names: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);
        (profs || []).forEach((p: any) => {
          names[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Utente';
        });
      }
      const map: Record<string, Set<string>> = {};
      rows.forEach(r => {
        (map[r.budget_item_id] ||= new Set()).add(names[r.user_id] || 'Utente');
      });
      return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v].sort((a, b) => a.localeCompare(b, 'it'))]));
    },
    enabled: projectActivities.length > 0
  });


  const handleActivityToggle = (activityId: string) => {
    setSelectedActivityIds(prev =>
      prev.includes(activityId)
        ? prev.filter(id => id !== activityId)
        : [...prev, activityId]
    );
  };

  const handleSelectAll = () => {
    if (selectedActivityIds.length === projectActivities.length) {
      setSelectedActivityIds([]);
    } else {
      setSelectedActivityIds(projectActivities.map(a => a.id));
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (selectedActivityIds.length === 0) {
        throw new Error('Seleziona almeno un\'attività');
      }

      const selected = projectActivities.filter(a => selectedActivityIds.includes(a.id));
      if (!projectId) {
        const sourceName = projects.find(p => p.id === selectedProjectId)?.name || '';
        onSelectActivities?.(selected.map(a => ({
          activity_name: a.activity_name,
          category: a.category,
          hours_worked: resetHours ? 0 : (a.hours_worked || 0),
          duration_days: a.duration_days,
          source_project_name: sourceName,
        })));
        return selected.length;
      }

      const { data: maxOrderData } = await supabase
        .from('budget_items')
        .select('display_order')
        .eq('project_id', projectId)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextOrder = (maxOrderData?.display_order || 0) + 1;

      const selectedActivities = projectActivities.filter(a => selectedActivityIds.includes(a.id));
      const inserts = selectedActivities.map((activity) => ({
        project_id: projectId,
        activity_name: activity.activity_name,
        category: activity.category,
        hours_worked: resetHours ? 0 : activity.hours_worked,
        hourly_rate: 0,
        total_cost: 0,
        display_order: nextOrder++,
        is_custom_activity: true,
        is_product: false,
        duration_days: activity.duration_days,
        created_from: 'project',
      }));
      const { error } = await supabase.from('budget_items').insert(inserts);
      if (error) throw error;
      return inserts.length;
    },
    onSuccess: (count) => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['budget-items', projectId] });
        toast.success(`${count} attività importate con successo`);
      } else {
        toast.success(`${count} attività aggiunte al budget`);
      }
      handleClose();
      onImportComplete?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore durante l\'importazione');
    }
  });

  const handleClose = () => {
    setSelectedProjectId('');
    setSelectedActivityIds([]);
    setComboboxOpen(false);
    setResetHours(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Importa attività da progetto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Project selector */}
          <div className="space-y-2">
            <Label>Seleziona progetto</Label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full justify-between"
                >
                  {selectedProjectId
                    ? (() => {
                        const p = projects.find(p => p.id === selectedProjectId);
                        return p ? `${p.name}${p.client_name ? ` — ${p.client_name}` : ''}` : 'Seleziona...';
                      })()
                    : "Seleziona un progetto..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover" align="start">
                <Command>
                  <CommandInput placeholder="Cerca progetto..." />
                  <CommandList className="max-h-[200px] overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                    <CommandEmpty>
                      {projectsLoading ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        "Nessun progetto trovato"
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {projects.map(project => (
                        <CommandItem
                          key={project.id}
                          value={`${project.name} ${project.client_name || ''}`}
                          onSelect={() => {
                            setSelectedProjectId(project.id);
                            setSelectedActivityIds([]);
                            setComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProjectId === project.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="flex items-center gap-2">
                              {project.name}
                              {project.status && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {STATUS_LABEL[project.status] || project.status}
                                </Badge>
                              )}
                            </span>
                            {project.client_name && (
                              <span className="text-xs text-muted-foreground">{project.client_name}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Activities list */}
          {selectedProjectId && !activitiesLoading && projectActivities.length > 0 && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <Label>Seleziona attività da importare</Label>
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selectedActivityIds.length === projectActivities.length
                    ? 'Deseleziona tutto'
                    : 'Seleziona tutto'}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Switch id="reset-hours" checked={resetHours} onCheckedChange={setResetHours} />
                <Label htmlFor="reset-hours" className="text-sm font-normal cursor-pointer">Azzera ore stimate</Label>
              </div>

              <TooltipProvider delayDuration={150}>
              <div className="flex-1 overflow-y-auto border rounded-lg divide-y">
                {projectActivities.map(activity => {
                  const isSelected = selectedActivityIds.includes(activity.id);
                  const categoryColor = getCategoryBadgeColor(activity.category);

                  return (
                    <div key={activity.id}>
                      <div
                        className={`flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => handleActivityToggle(activity.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleActivityToggle(activity.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{activity.activity_name}</span>
                            <Badge className={categoryColor}>{activity.category}</Badge>
                            {previousPeople[activity.id]?.length ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-muted-foreground/70 hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                                    <Users className="h-3.5 w-3.5" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  Svolta in precedenza da: {previousPeople[activity.id].join(', ')}
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {resetHours ? <><s className="opacity-60">{activity.hours_worked}h</s> 0h</> : `${activity.hours_worked}h`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              </TooltipProvider>

              <p className="text-sm text-muted-foreground">
                {selectedActivityIds.length} di {projectActivities.length} attività selezionate · assegnatari, tariffe e costi non vengono copiati
              </p>
            </div>
          )}

          {selectedProjectId && activitiesLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {selectedProjectId && !activitiesLoading && projectActivities.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Questo progetto non contiene attività
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>Annulla</Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={selectedActivityIds.length === 0 || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importazione...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                {projectId ? 'Importa' : 'Aggiungi'} ({selectedActivityIds.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

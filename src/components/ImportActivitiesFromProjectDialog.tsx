import { useState, useMemo } from 'react';
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
import { FileDown, Loader2, ChevronsUpDown, Check, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectActivity {
  id: string;
  activity_name: string;
  category: string;
  hours_worked: number;
  duration_days: number | null;
  parent_id: string | null;
}

interface ProjectOption {
  id: string;
  name: string;
  client_name?: string;
}

interface ImportActivitiesFromProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onImportComplete: () => void;
}

export const ImportActivitiesFromProjectDialog = ({
  open,
  onOpenChange,
  projectId,
  onImportComplete
}: ImportActivitiesFromProjectDialogProps) => {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  // Fetch open projects (exclude current)
  const { data: projects = [], isLoading: projectsLoading } = useQuery<ProjectOption[]>({
    queryKey: ['projects-for-activity-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, clients(name)')
        .neq('id', projectId)
        .in('project_status', ['aperto', 'in_partenza'])
        .order('name');
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        client_name: p.clients?.name
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
        .select('id, activity_name, category, hours_worked, duration_days, parent_id')
        .eq('project_id', selectedProjectId)
        .eq('is_product', false)
        .order('display_order', { ascending: true });
      if (error) throw error;
      // Filter out calendar-created items
      return (data || []).filter((item: any) => item.created_from !== 'calendar');
    },
    enabled: !!selectedProjectId
  });

  // Only top-level activities (no sub-activities) for selection
  const topLevelActivities = useMemo(() => {
    return projectActivities.filter(a => !a.parent_id);
  }, [projectActivities]);

  const getSubActivities = (parentId: string) => {
    return projectActivities.filter(a => a.parent_id === parentId);
  };

  const handleActivityToggle = (activityId: string) => {
    setSelectedActivityIds(prev =>
      prev.includes(activityId)
        ? prev.filter(id => id !== activityId)
        : [...prev, activityId]
    );
  };

  const handleSelectAll = () => {
    if (selectedActivityIds.length === topLevelActivities.length) {
      setSelectedActivityIds([]);
    } else {
      setSelectedActivityIds(topLevelActivities.map(a => a.id));
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (selectedActivityIds.length === 0) {
        throw new Error('Seleziona almeno un\'attività');
      }

      const { data: maxOrderData } = await supabase
        .from('budget_items')
        .select('display_order')
        .eq('project_id', projectId)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextOrder = (maxOrderData?.display_order || 0) + 1;

      // Get selected top-level activities + their sub-activities
      const selectedTopLevel = topLevelActivities.filter(a => selectedActivityIds.includes(a.id));
      
      let importedCount = 0;

      for (const activity of selectedTopLevel) {
        // Insert parent activity (without assignee)
        const { data: insertedParent, error: parentError } = await supabase
          .from('budget_items')
          .insert({
            project_id: projectId,
            activity_name: activity.activity_name,
            category: activity.category,
            hours_worked: activity.hours_worked,
            hourly_rate: 0,
            total_cost: 0,
            display_order: nextOrder++,
            is_custom_activity: true,
            is_product: false,
            duration_days: activity.duration_days,
            created_from: 'project'
          })
          .select('id')
          .single();

        if (parentError) throw parentError;
        importedCount++;

        // Import sub-activities
        const subs = getSubActivities(activity.id);
        if (subs.length > 0) {
          const subInserts = subs.map((sub, idx) => ({
            project_id: projectId,
            activity_name: sub.activity_name,
            category: sub.category,
            hours_worked: sub.hours_worked,
            hourly_rate: 0,
            total_cost: 0,
            display_order: nextOrder++,
            is_custom_activity: true,
            is_product: false,
            duration_days: sub.duration_days,
            parent_id: insertedParent.id,
            created_from: 'project'
          }));

          const { error: subError } = await supabase
            .from('budget_items')
            .insert(subInserts);

          if (subError) throw subError;
          importedCount += subs.length;
        }
      }

      return importedCount;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['budget-items', projectId] });
      toast.success(`${count} attività importate con successo`);
      handleClose();
      onImportComplete();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore durante l\'importazione');
    }
  });

  const handleClose = () => {
    setSelectedProjectId('');
    setSelectedActivityIds([]);
    setComboboxOpen(false);
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
                            <span>{project.name}</span>
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
          {selectedProjectId && !activitiesLoading && topLevelActivities.length > 0 && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <Label>Seleziona attività da importare</Label>
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selectedActivityIds.length === topLevelActivities.length
                    ? 'Deseleziona tutto'
                    : 'Seleziona tutto'}
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto border rounded-lg divide-y">
                {topLevelActivities.map(activity => {
                  const isSelected = selectedActivityIds.includes(activity.id);
                  const categoryColor = getCategoryBadgeColor(activity.category);
                  const subs = getSubActivities(activity.id);

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
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {activity.hours_worked}h
                        </span>
                      </div>
                      {/* Show sub-activities */}
                      {subs.length > 0 && (
                        <div className="pl-10 bg-muted/20">
                          {subs.map(sub => (
                            <div key={sub.id} className="flex items-center gap-3 p-2 text-sm text-muted-foreground">
                              <span className="truncate">{sub.activity_name}</span>
                              <Badge variant="outline" className="text-xs">{sub.category}</Badge>
                              <span className="ml-auto whitespace-nowrap">{sub.hours_worked}h</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-sm text-muted-foreground">
                {selectedActivityIds.length} di {topLevelActivities.length} attività selezionate
                {' '}(le sotto-attività verranno importate automaticamente)
              </p>
            </div>
          )}

          {selectedProjectId && activitiesLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {selectedProjectId && !activitiesLoading && topLevelActivities.length === 0 && (
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
                Importa ({selectedActivityIds.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

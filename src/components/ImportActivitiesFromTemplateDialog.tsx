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
import { FileDown, Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BudgetTemplate {
  id: string;
  name: string;
  discipline: string;
  template_data: {
    activities?: Array<{
      id: string;
      name: string;
      category: string;
      estimatedHours: number;
      description?: string;
    }>;
  };
}

interface ImportActivitiesFromTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onImportComplete: () => void;
}

export const ImportActivitiesFromTemplateDialog = ({
  open,
  onOpenChange,
  projectId,
  onImportComplete
}: ImportActivitiesFromTemplateDialogProps) => {
  const queryClient = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  // Fetch budget templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<BudgetTemplate[]>({
    queryKey: ['budget-templates-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_templates')
        .select('id, name, discipline, template_data')
        .order('name');
      if (error) throw error;
      return (data || []) as BudgetTemplate[];
    },
    enabled: open
  });

  // Get activities from selected template
  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId);
  }, [templates, selectedTemplateId]);

  const templateActivities = useMemo(() => {
    if (!selectedTemplate?.template_data?.activities) return [];
    return selectedTemplate.template_data.activities;
  }, [selectedTemplate]);

  // Toggle activity selection
  const handleActivityToggle = (activityId: string) => {
    setSelectedActivityIds(prev => 
      prev.includes(activityId)
        ? prev.filter(id => id !== activityId)
        : [...prev, activityId]
    );
  };

  // Select/deselect all activities
  const handleSelectAll = () => {
    if (selectedActivityIds.length === templateActivities.length) {
      setSelectedActivityIds([]);
    } else {
      setSelectedActivityIds(templateActivities.map(a => a.id));
    }
  };

  // Import activities mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      if (selectedActivityIds.length === 0) {
        throw new Error('Seleziona almeno un\'attività');
      }

      // Get max display_order for existing activities
      const { data: maxOrderData } = await supabase
        .from('budget_items')
        .select('display_order')
        .eq('project_id', projectId)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let nextOrder = (maxOrderData?.display_order || 0) + 1;

      // Get selected activities from template
      const activitiesToImport = templateActivities.filter(a => 
        selectedActivityIds.includes(a.id)
      );

      // Insert activities
      const inserts = activitiesToImport.map((activity, index) => ({
        project_id: projectId,
        activity_name: activity.name,
        category: activity.category,
        hours_worked: activity.estimatedHours || 0,
        hourly_rate: 0,
        total_cost: 0,
        display_order: nextOrder + index,
        is_custom_activity: true,
        is_product: false,
        created_from: 'project'
      }));

      const { error } = await supabase
        .from('budget_items')
        .insert(inserts);
      
      if (error) throw error;
      
      return activitiesToImport.length;
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
    setSelectedTemplateId('');
    setSelectedActivityIds([]);
    setComboboxOpen(false);
    onOpenChange(false);
  };

  const handleImport = () => {
    importMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Importa attività da modello
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Template selector with search */}
          <div className="space-y-2">
            <Label>Seleziona modello di budget</Label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full justify-between"
                >
                  {selectedTemplateId
                    ? templates.find(t => t.id === selectedTemplateId)?.name
                    : "Seleziona un modello..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover" align="start">
                <Command>
                  <CommandInput placeholder="Cerca modello..." />
                  <CommandList 
                    className="max-h-[200px] overflow-y-auto"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <CommandEmpty>
                      {templatesLoading ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        "Nessun modello trovato"
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {templates.map(template => (
                        <CommandItem
                          key={template.id}
                          value={template.name}
                          onSelect={() => {
                            setSelectedTemplateId(template.id);
                            setSelectedActivityIds([]);
                            setComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedTemplateId === template.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {template.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Activities list */}
          {selectedTemplateId && templateActivities.length > 0 && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <Label>Seleziona attività da importare</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedActivityIds.length === templateActivities.length
                    ? 'Deseleziona tutto'
                    : 'Seleziona tutto'}
                </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto border rounded-lg divide-y">
                {templateActivities.map(activity => {
                  const isSelected = selectedActivityIds.includes(activity.id);
                  const categoryColor = getCategoryBadgeColor(activity.category);
                  
                  return (
                    <div
                      key={activity.id}
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
                          <span className="font-medium truncate">{activity.name}</span>
                          <Badge className={categoryColor}>{activity.category}</Badge>
                        </div>
                        {activity.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {activity.description}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {activity.estimatedHours}h
                      </span>
                    </div>
                  );
                })}
              </div>
              
              <p className="text-sm text-muted-foreground">
                {selectedActivityIds.length} di {templateActivities.length} attività selezionate
              </p>
            </div>
          )}

          {selectedTemplateId && templateActivities.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Questo modello non contiene attività
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Annulla
          </Button>
          <Button
            onClick={handleImport}
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

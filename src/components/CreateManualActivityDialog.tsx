import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { TimeSlotSelect } from '@/components/ui/time-slot-select';
import { Repeat, Plus, AlertTriangle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { getCategoryBadgeColor } from '@/lib/categoryColors';

export interface RecurrenceData {
  is_recurring: boolean;
  recurrence_type: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrence_end_date?: string;
  recurrence_count?: number;
}

interface CreateManualActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate: string;
  initialStartTime: string;
  initialEndTime: string;
  onSubmit: (data: {
    budget_item_id: string;
    scheduled_date: string;
    scheduled_start_time: string;
    scheduled_end_time: string;
    notes: string;
    recurrence?: RecurrenceData;
  }) => void;
}

interface Project {
  id: string;
  name: string;
}

interface BudgetItem {
  id: string;
  activity_name: string;
  category: string;
  hours_worked: number;
  scheduled_hours?: number;
  parent_id: string | null;
}

interface ActivityCategory {
  id: string;
  name: string;
}

export function CreateManualActivityDialog({
  open,
  onOpenChange,
  initialDate,
  initialStartTime,
  initialEndTime,
  onSubmit,
}: CreateManualActivityDialogProps) {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedParentActivityId, setSelectedParentActivityId] = useState<string>('');
  const [selectedBudgetItemId, setSelectedBudgetItemId] = useState<string>('');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [notes, setNotes] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  
  // New sub-activity creation state
  const [isCreatingSubActivity, setIsCreatingSubActivity] = useState(false);
  const [newSubActivityName, setNewSubActivityName] = useState('');
  const [newSubActivityHours, setNewSubActivityHours] = useState(1);
  
  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recurrenceEndMode, setRecurrenceEndMode] = useState<'date' | 'count'>('date');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState(4);

  // Reset form when dialog opens with new values
  useEffect(() => {
    if (open) {
      setDate(initialDate);
      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
      setSelectedProjectId('');
      setSelectedParentActivityId('');
      setSelectedBudgetItemId('');
      setNotes('');
      setProjectSearch('');
      setIsRecurring(false);
      setRecurrenceType('weekly');
      setRecurrenceEndMode('date');
      setRecurrenceEndDate('');
      setRecurrenceCount(4);
      setIsCreatingSubActivity(false);
      setNewSubActivityName('');
      setNewSubActivityHours(1);
    }
  }, [open, initialDate, initialStartTime, initialEndTime]);

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-for-manual-activity'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    enabled: open,
  });

  // Fetch activity categories from database
  const { data: activityCategories = [] } = useQuery<ActivityCategory[]>({
    queryKey: ['activity-categories-for-manual-activity', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const { data, error } = await supabase
        .from('activity_categories')
        .select('id, name')
        .eq('user_id', currentUser.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!currentUser?.id,
  });

  // Fetch projects where user is a member and project_status is 'aperto'
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['user-member-projects-for-manual-activity'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get project IDs where user is a member
      const { data: memberProjects, error: memberError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;
      
      const projectIds = memberProjects?.map(pm => pm.project_id) || [];
      if (projectIds.length === 0) return [];

      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('project_status', 'aperto')
        .in('id', projectIds)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Fetch budget items for selected project (only main activities - no parent)
  const { data: mainActivities = [] } = useQuery<BudgetItem[]>({
    queryKey: ['project-main-activities', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];

      const { data: items, error } = await supabase
        .from('budget_items')
        .select('id, activity_name, category, hours_worked, parent_id')
        .eq('project_id', selectedProjectId)
        .eq('is_product', false)
        .is('parent_id', null) // Only main activities (no parent)
        .order('category')
        .order('activity_name');

      if (error) throw error;
      return items || [];
    },
    enabled: !!selectedProjectId && open,
  });

  // Fetch sub-activities for selected parent with scheduled hours
  const { data: subActivities = [] } = useQuery<BudgetItem[]>({
    queryKey: ['parent-sub-activities', selectedParentActivityId],
    queryFn: async () => {
      if (!selectedParentActivityId) return [];

      // Fetch sub-activities for this parent
      const { data: items, error } = await supabase
        .from('budget_items')
        .select('id, activity_name, category, hours_worked, parent_id')
        .eq('parent_id', selectedParentActivityId)
        .eq('is_product', false)
        .order('activity_name');

      if (error) throw error;
      if (!items || items.length === 0) return [];

      // Fetch scheduled hours for each sub-activity
      const { data: timeTracking } = await supabase
        .from('activity_time_tracking')
        .select('budget_item_id, scheduled_start_time, scheduled_end_time')
        .in('budget_item_id', items.map(i => i.id));

      // Calculate scheduled hours per budget item
      const scheduledHoursMap: Record<string, number> = {};
      timeTracking?.forEach(tt => {
        if (tt.scheduled_start_time && tt.scheduled_end_time) {
          const [startH, startM] = tt.scheduled_start_time.split(':').map(Number);
          const [endH, endM] = tt.scheduled_end_time.split(':').map(Number);
          const hours = (endH + endM / 60) - (startH + startM / 60);
          scheduledHoursMap[tt.budget_item_id] = (scheduledHoursMap[tt.budget_item_id] || 0) + hours;
        }
      });

      return items.map(item => ({
        ...item,
        scheduled_hours: scheduledHoursMap[item.id] || 0,
      }));
    },
    enabled: !!selectedParentActivityId && open,
  });

  // Get parent activity info for category
  const parentActivity = mainActivities.find(a => a.id === selectedParentActivityId);

  // Mutation to create a new sub-activity
  const createSubActivityMutation = useMutation({
    mutationFn: async (data: { projectId: string; parentId: string; name: string; category: string; hours: number }) => {
      // Get max display_order
      const { data: maxOrderData } = await supabase
        .from('budget_items')
        .select('display_order')
        .eq('project_id', data.projectId)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = (maxOrderData?.display_order || 0) + 1;

      const { data: newItem, error } = await supabase
        .from('budget_items')
        .insert({
          project_id: data.projectId,
          parent_id: data.parentId,
          activity_name: data.name,
          category: data.category,
          hours_worked: data.hours,
          hourly_rate: 0,
          total_cost: 0,
          display_order: nextOrder,
          is_custom_activity: true,
          is_product: false,
        })
        .select('id')
        .single();

      if (error) throw error;
      return newItem;
    },
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: ['parent-sub-activities', selectedParentActivityId] });
      queryClient.invalidateQueries({ queryKey: ['budget-items', selectedProjectId] });
      setSelectedBudgetItemId(newItem.id);
      setIsCreatingSubActivity(false);
      toast.success('Sotto-attività creata con successo');
    },
    onError: () => {
      toast.error('Errore nella creazione della sotto-attività');
    },
  });

  // Reset parent activity when project changes
  useEffect(() => {
    setSelectedParentActivityId('');
    setSelectedBudgetItemId('');
    setIsCreatingSubActivity(false);
  }, [selectedProjectId]);

  // Reset sub-activity when parent changes
  useEffect(() => {
    setSelectedBudgetItemId('');
    setIsCreatingSubActivity(false);
  }, [selectedParentActivityId]);

  const handleCreateSubActivity = () => {
    if (!selectedProjectId || !selectedParentActivityId || !newSubActivityName.trim() || !parentActivity) return;
    
    createSubActivityMutation.mutate({
      projectId: selectedProjectId,
      parentId: selectedParentActivityId,
      name: newSubActivityName.trim(),
      category: parentActivity.category, // Inherit category from parent
      hours: newSubActivityHours,
    });
  };

  const handleSubmit = () => {
    if (!selectedBudgetItemId || !date || !startTime || !endTime) return;

    // Calculate scheduled duration
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const scheduledDuration = (endH + endM / 60) - (startH + startM / 60);
    
    // Check if scheduling would exceed budget
    const selectedItem = subActivities.find(b => b.id === selectedBudgetItemId);
    if (selectedItem) {
      const totalScheduledHours = (selectedItem.scheduled_hours || 0) + scheduledDuration;
      if (totalScheduledHours > selectedItem.hours_worked) {
        const overage = (totalScheduledHours - selectedItem.hours_worked).toFixed(1);
        toast.warning(`Attenzione: questa pianificazione supererà il budget di ${overage}h`, {
          description: `Budget: ${selectedItem.hours_worked}h | Totale dopo pianificazione: ${totalScheduledHours.toFixed(1)}h`
        });
      }
    }

    const recurrence: RecurrenceData | undefined = isRecurring 
      ? {
          is_recurring: true,
          recurrence_type: recurrenceType,
          ...(recurrenceEndMode === 'date' && recurrenceEndDate ? { recurrence_end_date: recurrenceEndDate } : {}),
          ...(recurrenceEndMode === 'count' ? { recurrence_count: recurrenceCount } : {}),
        }
      : undefined;

    onSubmit({
      budget_item_id: selectedBudgetItemId,
      scheduled_date: date,
      scheduled_start_time: startTime,
      scheduled_end_time: endTime,
      notes,
      recurrence,
    });

    onOpenChange(false);
  };

  const isValid = selectedBudgetItemId && date && startTime && endTime && 
    (!isRecurring || (recurrenceEndMode === 'date' ? recurrenceEndDate : recurrenceCount > 0));

  const isNewSubActivityValid = newSubActivityName.trim() && newSubActivityHours > 0;

  const hasSubActivities = subActivities.length > 0;

  const getRecurrenceLabel = () => {
    switch (recurrenceType) {
      case 'daily': return 'Ogni giorno';
      case 'weekly': return 'Ogni settimana';
      case 'monthly': return 'Ogni mese';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuova attività manuale</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date and Time */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Inizio</Label>
                <TimeSlotSelect
                  value={startTime}
                  onChange={setStartTime}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Fine</Label>
                <TimeSlotSelect
                  value={endTime}
                  onChange={setEndTime}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Project Selection */}
          <div>
            <Label className="text-sm">Progetto *</Label>
            <Select value={selectedProjectId} onValueChange={(value) => {
              setSelectedProjectId(value);
              setProjectSearch('');
            }}>
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
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="pl-8 h-8"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                {projects
                  .filter((project) => 
                    project.name.toLowerCase().includes(projectSearch.toLowerCase())
                  )
                  .map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                {projects.filter((project) => 
                  project.name.toLowerCase().includes(projectSearch.toLowerCase())
                ).length === 0 && (
                  <div className="py-2 px-2 text-sm text-muted-foreground text-center">
                    Nessun progetto trovato
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Parent Activity Selection */}
          {selectedProjectId && (
            <div>
              <Label className="text-sm">Attività principale *</Label>
              {mainActivities.length > 0 ? (
                <Select value={selectedParentActivityId} onValueChange={setSelectedParentActivityId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleziona l'attività principale" />
                  </SelectTrigger>
                  <SelectContent>
                    {mainActivities.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        <div className="flex items-center gap-2">
                          <Badge className={getCategoryBadgeColor(item.category) + " text-xs"}>
                            {item.category}
                          </Badge>
                          <span>{item.activity_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 text-center mt-1">
                  <p className="text-sm text-muted-foreground">
                    Questo progetto non ha attività principali.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Sub-Activity Selection or Creation */}
          {selectedParentActivityId && (
            <>
              {!isCreatingSubActivity ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-sm">Sotto-attività *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCreatingSubActivity(true)}
                      className="h-6 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Nuova
                    </Button>
                  </div>
                  {hasSubActivities ? (
                    <Select 
                      value={selectedBudgetItemId} 
                      onValueChange={setSelectedBudgetItemId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona una sotto-attività" />
                      </SelectTrigger>
                      <SelectContent>
                        {subActivities.map((item) => {
                          const isOverBudget = (item.scheduled_hours || 0) > item.hours_worked;
                          return (
                            <SelectItem key={item.id} value={item.id}>
                              <div className="flex items-center gap-2">
                                <span className={isOverBudget ? 'text-destructive' : ''}>
                                  {item.activity_name}
                                </span>
                                <span className={`text-xs ${isOverBudget ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                  ({item.scheduled_hours?.toFixed(1) || 0}/{item.hours_worked} h)
                                </span>
                                {isOverBudget && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 text-center">
                      <p className="text-sm text-muted-foreground">
                        Nessuna sotto-attività presente.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setIsCreatingSubActivity(true)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Crea sotto-attività
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Nuova sotto-attività</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCreatingSubActivity(false)}
                      className="h-6 text-xs"
                    >
                      Annulla
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Nome sotto-attività *</Label>
                    <Input
                      value={newSubActivityName}
                      onChange={(e) => setNewSubActivityName(e.target.value)}
                      placeholder="Es. Revisione documento"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Categoria</Label>
                      <div className="mt-1">
                        <Badge className={getCategoryBadgeColor(parentActivity?.category || '')}>
                          {parentActivity?.category}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">Ereditata dal parent</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Ore previste</Label>
                      <Input
                        type="number"
                        value={newSubActivityHours}
                        onChange={(e) => setNewSubActivityHours(parseFloat(e.target.value) || 0)}
                        min={0.5}
                        step={0.5}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleCreateSubActivity}
                    disabled={!isNewSubActivityValid || createSubActivityMutation.isPending}
                    size="sm"
                    className="w-full"
                  >
                    {createSubActivityMutation.isPending ? 'Creazione...' : 'Crea Sotto-Attività'}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Recurrence Toggle */}
          {selectedBudgetItemId && (
            <>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Attività ricorrente</Label>
                </div>
                <Switch
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                />
              </div>

              {/* Recurrence Options */}
              {isRecurring && (
                <div className="space-y-3 p-3 border rounded-lg bg-background">
                  {/* Recurrence Type */}
                  <div>
                    <Label className="text-sm">Frequenza</Label>
                    <Select value={recurrenceType} onValueChange={(v) => setRecurrenceType(v as 'daily' | 'weekly' | 'monthly')}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Giornaliera</SelectItem>
                        <SelectItem value="weekly">Settimanale</SelectItem>
                        <SelectItem value="monthly">Mensile</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">{getRecurrenceLabel()}</p>
                  </div>

                  {/* Recurrence End Mode */}
                  <div>
                    <Label className="text-sm">Termina</Label>
                    <Select value={recurrenceEndMode} onValueChange={(v) => setRecurrenceEndMode(v as 'date' | 'count')}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">In data specifica</SelectItem>
                        <SelectItem value="count">Dopo N ripetizioni</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* End Date or Count */}
                  {recurrenceEndMode === 'date' ? (
                    <div>
                      <Label className="text-sm">Data di fine</Label>
                      <Input
                        type="date"
                        value={recurrenceEndDate}
                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                        min={date}
                        className="mt-1"
                      />
                    </div>
                  ) : (
                    <div>
                      <Label className="text-sm">Numero di ripetizioni</Label>
                      <Input
                        type="number"
                        value={recurrenceCount}
                        onChange={(e) => setRecurrenceCount(parseInt(e.target.value) || 1)}
                        min={1}
                        max={52}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Verranno create {recurrenceCount} occorrenze
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <Label className="text-sm">Descrizione</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Descrizione opzionale..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            {isRecurring ? 'Crea Attività Ricorrenti' : 'Crea Attività'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

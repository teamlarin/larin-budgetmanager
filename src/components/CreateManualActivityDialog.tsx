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
import { Repeat, Plus } from 'lucide-react';
import { toast } from 'sonner';

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
}

const ACTIVITY_CATEGORIES = ['Management', 'Design', 'Dev', 'Content', 'Support', 'Altro'];

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
  const [selectedBudgetItemId, setSelectedBudgetItemId] = useState<string>('');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [notes, setNotes] = useState('');
  
  // New activity creation state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityCategory, setNewActivityCategory] = useState('Management');
  const [newActivityHours, setNewActivityHours] = useState(1);
  
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
      setSelectedBudgetItemId('');
      setNotes('');
      setIsRecurring(false);
      setRecurrenceType('weekly');
      setRecurrenceEndMode('date');
      setRecurrenceEndDate('');
      setRecurrenceCount(4);
      setIsCreatingNew(false);
      setNewActivityName('');
      setNewActivityCategory('Management');
      setNewActivityHours(1);
    }
  }, [open, initialDate, initialStartTime, initialEndTime]);

  // Fetch projects where user is a member
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
        .eq('status', 'approvato')
        .in('id', projectIds)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Fetch budget items for selected project
  const { data: budgetItems = [] } = useQuery<BudgetItem[]>({
    queryKey: ['project-budget-items', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];

      const { data, error } = await supabase
        .from('budget_items')
        .select('id, activity_name, category, hours_worked')
        .eq('project_id', selectedProjectId)
        .eq('is_product', false)
        .order('category')
        .order('activity_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProjectId && open,
  });

  // Mutation to create a new budget item (manual activity)
  const createBudgetItemMutation = useMutation({
    mutationFn: async (data: { projectId: string; name: string; category: string; hours: number }) => {
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
      queryClient.invalidateQueries({ queryKey: ['project-budget-items', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['budget-items', selectedProjectId] });
      setSelectedBudgetItemId(newItem.id);
      setIsCreatingNew(false);
      toast.success('Attività creata con successo');
    },
    onError: () => {
      toast.error('Errore nella creazione dell\'attività');
    },
  });

  // Reset budget item when project changes
  useEffect(() => {
    setSelectedBudgetItemId('');
    setIsCreatingNew(false);
  }, [selectedProjectId]);

  // Auto-switch to create mode if project has no budget items
  useEffect(() => {
    if (selectedProjectId && budgetItems.length === 0) {
      setIsCreatingNew(true);
    }
  }, [selectedProjectId, budgetItems.length]);

  const handleCreateNewActivity = () => {
    if (!selectedProjectId || !newActivityName.trim()) return;
    
    createBudgetItemMutation.mutate({
      projectId: selectedProjectId,
      name: newActivityName.trim(),
      category: newActivityCategory,
      hours: newActivityHours,
    });
  };

  const handleSubmit = () => {
    if (!selectedBudgetItemId || !date || !startTime || !endTime) return;

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

  const isNewActivityValid = newActivityName.trim() && newActivityCategory && newActivityHours > 0;

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
          <DialogTitle>Nuova Attività Manuale</DialogTitle>
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
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Fine</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Project Selection */}
          <div>
            <Label className="text-sm">Progetto *</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleziona un progetto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Activity Selection or Creation */}
          {selectedProjectId && (
            <>
              {!isCreatingNew ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-sm">Attività *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setIsCreatingNew(true)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Crea nuova
                    </Button>
                  </div>
                  <Select 
                    value={selectedBudgetItemId} 
                    onValueChange={setSelectedBudgetItemId}
                    disabled={budgetItems.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        budgetItems.length === 0 
                          ? "Nessuna attività - creane una nuova"
                          : "Seleziona un'attività"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {budgetItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {item.category}
                            </Badge>
                            <span>{item.activity_name}</span>
                            <span className="text-muted-foreground text-xs">({item.hours_worked}h)</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Nuova Attività</Label>
                    {budgetItems.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setIsCreatingNew(false)}
                      >
                        Seleziona esistente
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Nome attività *</Label>
                    <Input
                      value={newActivityName}
                      onChange={(e) => setNewActivityName(e.target.value)}
                      placeholder="Es. Riunione settimanale"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Categoria</Label>
                      <Select value={newActivityCategory} onValueChange={setNewActivityCategory}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTIVITY_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Ore previste</Label>
                      <Input
                        type="number"
                        value={newActivityHours}
                        onChange={(e) => setNewActivityHours(parseFloat(e.target.value) || 0)}
                        min={0.5}
                        step={0.5}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleCreateNewActivity}
                    disabled={!isNewActivityValid || createBudgetItemMutation.isPending}
                    size="sm"
                    className="w-full"
                  >
                    {createBudgetItemMutation.isPending ? 'Creazione...' : 'Crea Attività'}
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
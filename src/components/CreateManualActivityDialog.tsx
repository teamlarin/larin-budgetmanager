import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TimeSlotSelect } from '@/components/ui/time-slot-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Repeat, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { getCategoryBadgeColor } from '@/lib/categoryColors';
import { cn } from '@/lib/utils';

export interface RecurrenceData {
  is_recurring: boolean;
  recurrence_type: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrence_end_date?: string;
  recurrence_count?: number;
  recurrence_interval?: number; // For daily: every N days
  recurrence_days_of_week?: number[]; // For weekly: 0=Sunday, 1=Monday, etc.
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
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedParentActivityId, setSelectedParentActivityId] = useState<string>('');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [notes, setNotes] = useState('');
  const [description, setDescription] = useState('');
  const [projectComboboxOpen, setProjectComboboxOpen] = useState(false);
  const [parentActivityComboboxOpen, setParentActivityComboboxOpen] = useState(false);
  
  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recurrenceEndMode, setRecurrenceEndMode] = useState<'date' | 'count'>('date');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState(4);
  const [recurrenceInterval, setRecurrenceInterval] = useState(1); // Every N days
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<string[]>([]); // Selected days for weekly

  const DAYS_OF_WEEK = [
    { value: '1', label: 'L', fullLabel: 'Lunedì' },
    { value: '2', label: 'M', fullLabel: 'Martedì' },
    { value: '3', label: 'M', fullLabel: 'Mercoledì' },
    { value: '4', label: 'G', fullLabel: 'Giovedì' },
    { value: '5', label: 'V', fullLabel: 'Venerdì' },
    { value: '6', label: 'S', fullLabel: 'Sabato' },
    { value: '0', label: 'D', fullLabel: 'Domenica' },
  ];

  // Reset form when dialog opens with new values
  useEffect(() => {
    if (open) {
      setDate(initialDate);
      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
      setSelectedProjectId('');
      setSelectedParentActivityId('');
      setNotes('');
      setDescription('');
      setProjectComboboxOpen(false);
      setIsRecurring(false);
      setRecurrenceType('weekly');
      setRecurrenceEndMode('date');
      setRecurrenceEndDate('');
      setRecurrenceCount(4);
      setRecurrenceInterval(1);
      // Set initial day based on selected date
      const dayOfWeek = new Date(initialDate).getDay().toString();
      setRecurrenceDaysOfWeek([dayOfWeek]);
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

  // Fetch projects where user is a member OR project leader and project_status is 'aperto'
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['user-member-projects-for-manual-activity', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];

      // Two parallel queries (PostgREST doesn't support .or() across joined tables)
      const [leaderRes, memberRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name')
          .eq('project_status', 'aperto')
          .eq('project_leader_id', currentUser.id),
        supabase
          .from('projects')
          .select('id, name, project_members!inner(user_id)')
          .eq('project_status', 'aperto')
          .eq('project_members.user_id', currentUser.id),
      ]);

      if (leaderRes.error) throw leaderRes.error;
      if (memberRes.error) throw memberRes.error;

      const unique = new Map<string, Project>();
      [...(leaderRes.data || []), ...(memberRes.data || [])].forEach((p: any) => {
        if (!unique.has(p.id)) unique.set(p.id, { id: p.id, name: p.name });
      });
      return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: open && !!currentUser?.id,
  });

  // Fetch ALL budget items for selected project (main activities + sub-activities)
  const { data: allActivities = [] } = useQuery<BudgetItem[]>({
    queryKey: ['project-all-activities', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];

      const { data: items, error } = await supabase
        .from('budget_items')
        .select('id, activity_name, category, hours_worked, parent_id')
        .eq('project_id', selectedProjectId)
        .eq('is_product', false)
        .neq('category', 'Import') // Exclude imported hours category
        .neq('activity_name', 'Ore importate') // Exclude imported hours activity
        .order('category')
        .order('activity_name');

      if (error) throw error;
      return items || [];
    },
    enabled: !!selectedProjectId && open,
  });

  // For backward compatibility, keep mainActivities reference (used in sub-activity creation)
  const mainActivities = allActivities.filter(a => a.parent_id === null);

  // Reset activity selection when project changes
  useEffect(() => {
    setSelectedParentActivityId('');
  }, [selectedProjectId]);

  // Validate that end time is after start time
  const isTimeRangeValid = (() => {
    if (!startTime || !endTime) return true;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return endMinutes > startMinutes;
  })();

  const handleSubmit = () => {
    // Use selected activity directly
    const budgetItemToUse = selectedParentActivityId;
    if (!budgetItemToUse || !date || !startTime || !endTime) return;

    if (!isTimeRangeValid) {
      toast.error("L'ora di fine deve essere successiva all'ora di inizio");
      return;
    }

    const recurrence: RecurrenceData | undefined = isRecurring 
      ? {
          is_recurring: true,
          recurrence_type: recurrenceType,
          ...(recurrenceEndMode === 'date' && recurrenceEndDate ? { recurrence_end_date: recurrenceEndDate } : {}),
          ...(recurrenceEndMode === 'count' ? { recurrence_count: recurrenceCount } : {}),
          ...(recurrenceType === 'daily' ? { recurrence_interval: recurrenceInterval } : {}),
          ...(recurrenceType === 'weekly' && recurrenceDaysOfWeek.length > 0 ? { recurrence_days_of_week: recurrenceDaysOfWeek.map(d => parseInt(d)) } : {}),
        }
      : undefined;

    // Combine description and notes
    const fullNotes = description ? (notes ? `${description}\n\n${notes}` : description) : notes;

    onSubmit({
      budget_item_id: budgetItemToUse,
      scheduled_date: date,
      scheduled_start_time: startTime,
      scheduled_end_time: endTime,
      notes: fullNotes,
      recurrence,
    });

    onOpenChange(false);
  };

  // Activity selection is required
  const isWeeklyWithDays = recurrenceType !== 'weekly' || recurrenceDaysOfWeek.length > 0;
  const isValid = selectedParentActivityId && date && startTime && endTime && isTimeRangeValid &&
    (!isRecurring || ((recurrenceEndMode === 'date' ? recurrenceEndDate : recurrenceCount > 0) && isWeeklyWithDays));


  const getRecurrenceLabel = () => {
    switch (recurrenceType) {
      case 'daily': 
        return recurrenceInterval === 1 ? 'Ogni giorno' : `Ogni ${recurrenceInterval} giorni`;
      case 'weekly': 
        if (recurrenceDaysOfWeek.length === 0) return 'Seleziona i giorni';
        const dayLabels = recurrenceDaysOfWeek
          .map(d => DAYS_OF_WEEK.find(day => day.value === d)?.fullLabel)
          .filter(Boolean)
          .join(', ');
        return `Ogni settimana: ${dayLabels}`;
      case 'monthly': 
        return 'Ogni mese';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Nuova attività manuale</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 w-full min-w-0">
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
            {!isTimeRangeValid && startTime && endTime && (
              <p className="text-sm text-destructive">
                L'ora di fine deve essere successiva all'ora di inizio
              </p>
            )}
          </div>

          {/* Project Selection */}
          <div className="min-w-0 overflow-hidden">
            <Label className="text-sm">Progetto *</Label>
            <Popover open={projectComboboxOpen} onOpenChange={setProjectComboboxOpen}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={projectComboboxOpen}
                        className="w-full justify-between mt-1 font-normal min-w-0"
                      >
                        <span className="truncate">
                          {selectedProjectId
                            ? projects.find((p) => p.id === selectedProjectId)?.name
                            : "Seleziona un progetto"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  {selectedProjectId && (
                    <TooltipContent side="top" className="max-w-xs">
                      <p>{projects.find((p) => p.id === selectedProjectId)?.name}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover z-50" align="start">
                <Command>
                  <CommandInput placeholder="Cerca progetto..." />
                  <CommandList>
                    <CommandEmpty>Nessun progetto trovato.</CommandEmpty>
                    <CommandGroup>
                      {projects.map((project) => (
                        <CommandItem
                          key={project.id}
                          value={project.name}
                          onSelect={() => {
                            setSelectedProjectId(project.id);
                            setProjectComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProjectId === project.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {project.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Activity Selection - Flat list of all activities */}
          {selectedProjectId && (
            <div className="min-w-0 overflow-hidden">
              <Label className="text-sm">Attività *</Label>
              {allActivities.length > 0 ? (
                <Popover open={parentActivityComboboxOpen} onOpenChange={setParentActivityComboboxOpen}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={parentActivityComboboxOpen}
                            className="w-full justify-between mt-1 font-normal min-w-0"
                          >
                            {selectedParentActivityId ? (
                              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                                <Badge className={getCategoryBadgeColor(allActivities.find(a => a.id === selectedParentActivityId)?.category || '') + " text-xs shrink-0"}>
                                  {allActivities.find(a => a.id === selectedParentActivityId)?.category}
                                </Badge>
                                <span className="truncate">{allActivities.find(a => a.id === selectedParentActivityId)?.activity_name}</span>
                              </div>
                            ) : (
                              <span className="truncate">Seleziona un'attività</span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      {selectedParentActivityId && (
                        <TooltipContent side="top" className="max-w-xs">
                          <p>{allActivities.find(a => a.id === selectedParentActivityId)?.activity_name}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover z-50" align="start">
                    <Command>
                      <CommandInput placeholder="Cerca attività..." />
                      <CommandList>
                        <CommandEmpty>Nessuna attività trovata.</CommandEmpty>
                        <CommandGroup>
                          {allActivities.map((item) => (
                            <CommandItem
                              key={item.id}
                              value={`${item.category} ${item.activity_name}`}
                              onSelect={() => {
                                setSelectedParentActivityId(item.id);
                                setParentActivityComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedParentActivityId === item.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex items-center gap-2">
                                <Badge className={getCategoryBadgeColor(item.category) + " text-xs"}>
                                  {item.category}
                                </Badge>
                                <span className={item.parent_id ? "pl-2" : ""}>{item.activity_name}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 text-center mt-1">
                  <p className="text-sm text-muted-foreground">
                    Questo progetto non ha attività.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Description Field */}
          {selectedParentActivityId && (
            <div>
              <Label className="text-sm">Descrizione</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Aggiungi una descrizione per questa attività..."
                className="mt-1 min-h-[80px]"
              />
            </div>
          )}


          {/* Recurrence Toggle */}
          {selectedParentActivityId && (
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
                    <Select value={recurrenceType} onValueChange={(v) => {
                      setRecurrenceType(v as 'daily' | 'weekly' | 'monthly');
                      // Reset weekly days when switching to weekly
                      if (v === 'weekly') {
                        const dayOfWeek = new Date(date).getDay().toString();
                        setRecurrenceDaysOfWeek([dayOfWeek]);
                      }
                    }}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Giornaliera</SelectItem>
                        <SelectItem value="weekly">Settimanale</SelectItem>
                        <SelectItem value="monthly">Mensile</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Daily interval option */}
                  {recurrenceType === 'daily' && (
                    <div>
                      <Label className="text-sm">Ripeti ogni</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          value={recurrenceInterval}
                          onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                          min={1}
                          max={30}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">
                          {recurrenceInterval === 1 ? 'giorno' : 'giorni'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Weekly days selection */}
                  {recurrenceType === 'weekly' && (
                    <div>
                      <Label className="text-sm">Ripeti nei giorni</Label>
                      <ToggleGroup 
                        type="multiple" 
                        value={recurrenceDaysOfWeek}
                        onValueChange={setRecurrenceDaysOfWeek}
                        className="justify-start gap-1 mt-1 flex-wrap"
                      >
                        {DAYS_OF_WEEK.map((day) => (
                          <ToggleGroupItem
                            key={day.value}
                            value={day.value}
                            aria-label={day.fullLabel}
                            className="w-9 h-9 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                          >
                            {day.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      {recurrenceDaysOfWeek.length === 0 && (
                        <p className="text-xs text-destructive mt-1">Seleziona almeno un giorno</p>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">{getRecurrenceLabel()}</p>

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

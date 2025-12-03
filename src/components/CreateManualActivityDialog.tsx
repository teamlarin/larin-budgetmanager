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

export function CreateManualActivityDialog({
  open,
  onOpenChange,
  initialDate,
  initialStartTime,
  initialEndTime,
  onSubmit,
}: CreateManualActivityDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedBudgetItemId, setSelectedBudgetItemId] = useState<string>('');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [notes, setNotes] = useState('');

  // Reset form when dialog opens with new values
  useEffect(() => {
    if (open) {
      setDate(initialDate);
      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
      setSelectedProjectId('');
      setSelectedBudgetItemId('');
      setNotes('');
    }
  }, [open, initialDate, initialStartTime, initialEndTime]);

  // Fetch all approved projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['all-projects-for-manual-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('status', 'approvato')
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

  // Reset budget item when project changes
  useEffect(() => {
    setSelectedBudgetItemId('');
  }, [selectedProjectId]);

  const handleSubmit = () => {
    if (!selectedBudgetItemId || !date || !startTime || !endTime) return;

    onSubmit({
      budget_item_id: selectedBudgetItemId,
      scheduled_date: date,
      scheduled_start_time: startTime,
      scheduled_end_time: endTime,
      notes,
    });

    onOpenChange(false);
  };

  const isValid = selectedBudgetItemId && date && startTime && endTime;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuova Attività Manuale</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date and Time */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-sm">Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>
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

          {/* Activity Selection */}
          <div>
            <Label className="text-sm">Attività *</Label>
            <Select 
              value={selectedBudgetItemId} 
              onValueChange={setSelectedBudgetItemId}
              disabled={!selectedProjectId || budgetItems.length === 0}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={
                  !selectedProjectId 
                    ? "Seleziona prima un progetto" 
                    : budgetItems.length === 0 
                      ? "Nessuna attività disponibile"
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

          {/* Notes */}
          <div>
            <Label className="text-sm">Note</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note opzionali..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            Crea Attività
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

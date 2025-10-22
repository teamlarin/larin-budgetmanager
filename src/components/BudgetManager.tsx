import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BudgetItem, Category, BudgetSummary } from '@/types/budget';
import { assignees } from '@/data/assignees';
import { BudgetItemForm } from '@/components/BudgetItemForm';
import { BudgetSummaryCard } from '@/components/BudgetSummaryCard';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, Edit, Trash2, GripVertical, ArrowUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const initialBudgetItems: BudgetItem[] = [
  {
    id: '1',
    category: 'Management',
    activityName: 'Project management',
    assigneeId: 'project-leader',
    assigneeName: 'Project Leader',
    hourlyRate: 80,
    hoursWorked: 16,
    totalCost: 1280,
  },
  {
    id: '2',
    category: 'Design',
    activityName: 'Analisi e struttura sito: UI Concept',
    assigneeId: 'junior-designer',
    assigneeName: 'Junior Designer',
    hourlyRate: 45,
    hoursWorked: 8,
    totalCost: 360,
  },
  {
    id: '3',
    category: 'Design',
    activityName: 'Realizzazione bozza grafica',
    assigneeId: 'senior-designer',
    assigneeName: 'Senior Designer',
    hourlyRate: 65,
    hoursWorked: 20,
    totalCost: 1300,
  },
  {
    id: '4',
    category: 'Dev',
    activityName: 'Sviluppo sito web',
    assigneeId: 'senior-dev',
    assigneeName: 'Senior Developer',
    hourlyRate: 70,
    hoursWorked: 60,
    totalCost: 4200,
  },
];

interface BudgetManagerProps {
  projectId?: string;
}

// Transform database row to BudgetItem
const transformDbToBudgetItem = (dbItem: any): BudgetItem => ({
  id: dbItem.id,
  category: dbItem.category,
  activityName: dbItem.activity_name,
  assigneeId: dbItem.assignee_id,
  assigneeName: dbItem.assignee_name,
  hourlyRate: dbItem.hourly_rate,
  hoursWorked: dbItem.hours_worked,
  totalCost: dbItem.total_cost,
  isCustomActivity: dbItem.is_custom_activity,
  displayOrder: dbItem.display_order,
});

export const BudgetManager = ({ projectId }: BudgetManagerProps) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [sortField, setSortField] = useState<'hours' | 'total' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [canEdit, setCanEdit] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    // Editor and admin can edit, subscriber cannot
    setCanEdit(roleData?.role === 'admin' || roleData?.role === 'editor');
  };

  const { data: rawBudgetItems = [], refetch } = useQuery({
    queryKey: ['budget-items', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', projectId)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data.map(transformDbToBudgetItem);
    },
    enabled: !!projectId,
  });

  // Apply sorting
  const budgetItems = useMemo(() => {
    if (!sortField) return rawBudgetItems;

    const sorted = [...rawBudgetItems].sort((a, b) => {
      let comparison = 0;
      
      if (sortField === 'hours') {
        comparison = a.hoursWorked - b.hoursWorked;
      } else if (sortField === 'total') {
        comparison = a.totalCost - b.totalCost;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [rawBudgetItems, sortField, sortDirection]);

  const handleSort = (field: 'hours' | 'total') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const budgetSummary: BudgetSummary = useMemo(() => {
    const summary: BudgetSummary = {
      totalCost: 0,
      totalHours: 0,
      categoryBreakdown: {},
    };

    budgetItems.forEach(item => {
      summary.totalCost += item.totalCost;
      summary.totalHours += item.hoursWorked;
      
      if (!summary.categoryBreakdown[item.category]) {
        summary.categoryBreakdown[item.category] = { cost: 0, hours: 0 };
      }
      summary.categoryBreakdown[item.category].cost += item.totalCost;
      summary.categoryBreakdown[item.category].hours += item.hoursWorked;
    });

    return summary;
  }, [budgetItems]);

  // Update project totals in database
  const updateProjectTotals = async () => {
    if (!projectId) return;
    
    try {
      // Fetch all budget items for this project to recalculate totals
      const { data: items, error: fetchError } = await supabase
        .from('budget_items')
        .select('total_cost, hours_worked')
        .eq('project_id', projectId);

      if (fetchError) throw fetchError;

      const totalBudget = items?.reduce((sum, item) => sum + item.total_cost, 0) || 0;
      const totalHours = items?.reduce((sum, item) => sum + item.hours_worked, 0) || 0;

      const { error } = await supabase
        .from('projects')
        .update({
          total_budget: totalBudget,
          total_hours: totalHours,
        })
        .eq('id', projectId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating project totals:', error);
    }
  };

  const handleAddItem = async (newItem: Omit<BudgetItem, 'id'>) => {
    if (!projectId) return;
    
    try {
      const totalCost = newItem.hourlyRate * newItem.hoursWorked;
      
      // Get the max display_order for this project
      const { data: maxOrderData } = await supabase
        .from('budget_items')
        .select('display_order')
        .eq('project_id', projectId)
        .order('display_order', { ascending: false })
        .limit(1);
      
      const nextOrder = maxOrderData && maxOrderData.length > 0 
        ? maxOrderData[0].display_order + 1 
        : 1;
      
      const { error } = await supabase
        .from('budget_items')
        .insert([
          {
            project_id: projectId,
            category: newItem.category,
            activity_name: newItem.activityName,
            assignee_id: newItem.assigneeId,
            assignee_name: newItem.assigneeName,
            hourly_rate: newItem.hourlyRate,
            hours_worked: newItem.hoursWorked,
            total_cost: totalCost,
            is_custom_activity: newItem.isCustomActivity || false,
            display_order: nextOrder,
          }
        ]);

      if (error) throw error;

      await refetch();
      await updateProjectTotals();
      setIsFormOpen(false);
      toast({
        title: "Attività aggiunta",
        description: "La nuova attività è stata aggiunta al budget.",
      });
    } catch (error) {
      console.error('Error adding budget item:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiunta dell'attività.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateItem = async (updatedItem: BudgetItem) => {
    try {
      const totalCost = updatedItem.hourlyRate * updatedItem.hoursWorked;
      
      const { error } = await supabase
        .from('budget_items')
        .update({
          category: updatedItem.category,
          activity_name: updatedItem.activityName,
          assignee_id: updatedItem.assigneeId,
          assignee_name: updatedItem.assigneeName,
          hourly_rate: updatedItem.hourlyRate,
          hours_worked: updatedItem.hoursWorked,
          total_cost: totalCost,
          is_custom_activity: updatedItem.isCustomActivity,
        })
        .eq('id', updatedItem.id);

      if (error) throw error;

      await refetch();
      await updateProjectTotals();
      setEditingItem(null);
      toast({
        title: "Attività aggiornata",
        description: "L'attività è stata aggiornata con successo.",
      });
    } catch (error) {
      console.error('Error updating budget item:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento dell'attività.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('budget_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await refetch();
      await updateProjectTotals();
      toast({
        title: "Attività eliminata",
        description: "L'attività è stata rimossa dal budget.",
      });
    } catch (error) {
      console.error('Error deleting budget item:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione dell'attività.",
        variant: "destructive",
      });
    }
  };

  const exportToCsv = () => {
    const csvContent = [
      ['Categoria', 'Attività', 'Assegnatario', 'Costo Orario (€)', 'Ore', 'Costo Totale (€)'],
      ...budgetItems.map(item => [
        item.category,
        item.activityName,
        item.assigneeName,
        item.hourlyRate.toString(),
        item.hoursWorked.toString(),
        item.totalCost.toString(),
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Esportazione completata",
      description: "Il budget è stato esportato in formato CSV.",
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = budgetItems.findIndex((item) => item.id === active.id);
    const newIndex = budgetItems.findIndex((item) => item.id === over.id);

    const reorderedItems = arrayMove(budgetItems, oldIndex, newIndex);

    // Update the display_order for all affected items
    try {
      const updates = reorderedItems.map((item, index) => ({
        id: item.id,
        display_order: index + 1,
      }));

      for (const update of updates) {
        await supabase
          .from('budget_items')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
      }

      await refetch();
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il riordino.",
        variant: "destructive",
      });
    }
  };

  const getCategoryVariant = (category: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (category) {
      case 'Management':
        return 'default';
      case 'Design':
        return 'secondary';
      case 'Dev':
        return 'outline';
      case 'Content':
        return 'default';
      case 'Support':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={exportToCsv}
                className="shadow-soft hover:shadow-medium transition-all"
              >
                <Download className="w-4 h-4 mr-2" />
                Esporta CSV
              </Button>
              {canEdit && (
                <Button
                  onClick={() => setIsFormOpen(true)}
                  className="bg-gradient-primary shadow-soft hover:shadow-medium transition-all"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Aggiungi Attività
                </Button>
              )}
            </div>
          </div>

          <BudgetSummaryCard summary={budgetSummary} />
        </div>

        {/* Budget Items Table */}
        {budgetItems.length > 0 ? (
          <div className="rounded-lg border bg-card">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    {canEdit && <TableHead className="w-12"></TableHead>}
                    <TableHead>Categoria</TableHead>
                    <TableHead>Attività</TableHead>
                    <TableHead>Assegnatario</TableHead>
                    <TableHead className="text-right">Costo Orario</TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('hours')}
                        className="h-8 px-2"
                      >
                        Ore
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('total')}
                        className="h-8 px-2"
                      >
                        Totale
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    {canEdit && <TableHead className="text-right">Azioni</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={budgetItems.map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {budgetItems.map((item) => (
                      <SortableRow
                        key={item.id}
                        item={item}
                        onEdit={setEditingItem}
                        onDelete={handleDeleteItem}
                        getCategoryVariant={getCategoryVariant}
                        canEdit={canEdit}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="bg-gradient-card rounded-lg p-8 shadow-soft">
              <h3 className="text-xl font-semibold mb-2">Nessuna attività presente</h3>
              <p className="text-muted-foreground mb-4">
                {canEdit 
                  ? 'Inizia aggiungendo la prima attività al tuo budget'
                  : 'Non ci sono attività in questo budget'
                }
              </p>
              {canEdit && (
                <Button
                  onClick={() => setIsFormOpen(true)}
                  className="bg-gradient-primary"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Aggiungi Prima Attività
                </Button>
              )}
            </div>
          </div>
        )}
        <BudgetItemForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleAddItem}
        />

        {editingItem && (
          <BudgetItemForm
            isOpen={!!editingItem}
            onClose={() => setEditingItem(null)}
            onSubmit={handleUpdateItem}
            initialData={editingItem}
            isEditing
          />
        )}
      </div>
    </div>
  );
};

// Sortable Row Component
interface SortableRowProps {
  item: BudgetItem;
  onEdit: (item: BudgetItem) => void;
  onDelete: (id: string) => void;
  getCategoryVariant: (category: string) => "default" | "destructive" | "outline" | "secondary";
  canEdit: boolean;
}

const SortableRow = ({ item, onEdit, onDelete, getCategoryVariant, canEdit }: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      {canEdit && (
        <TableCell>
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
        </TableCell>
      )}
      <TableCell>
        <Badge variant={getCategoryVariant(item.category)}>
          {item.category}
        </Badge>
      </TableCell>
      <TableCell className="font-medium">{item.activityName}</TableCell>
      <TableCell>{item.assigneeName}</TableCell>
      <TableCell className="text-right">{item.hourlyRate.toFixed(2)} €</TableCell>
      <TableCell className="text-right">{item.hoursWorked.toFixed(1)}h</TableCell>
      <TableCell className="text-right font-semibold">{item.totalCost.toFixed(2)} €</TableCell>
      {canEdit && (
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(item)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
};
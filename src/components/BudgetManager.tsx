import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BudgetItem, Category, BudgetSummary } from '@/types/budget';
import { assignees } from '@/data/assignees';
import { BudgetItemForm } from '@/components/BudgetItemForm';
import { BudgetSummaryCard } from '@/components/BudgetSummaryCard';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
});

export const BudgetManager = ({ projectId }: BudgetManagerProps) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const { toast } = useToast();

  const { data: budgetItems = [], refetch } = useQuery({
    queryKey: ['budget-items', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data.map(transformDbToBudgetItem);
    },
    enabled: !!projectId,
  });

  const budgetSummary: BudgetSummary = useMemo(() => {
    const summary: BudgetSummary = {
      totalCost: 0,
      totalHours: 0,
      categoryBreakdown: {
        Management: { cost: 0, hours: 0 },
        Design: { cost: 0, hours: 0 },
        Dev: { cost: 0, hours: 0 },
        Content: { cost: 0, hours: 0 },
        Support: { cost: 0, hours: 0 },
      },
    };

    budgetItems.forEach(item => {
      summary.totalCost += item.totalCost;
      summary.totalHours += item.hoursWorked;
      summary.categoryBreakdown[item.category].cost += item.totalCost;
      summary.categoryBreakdown[item.category].hours += item.hoursWorked;
    });

    return summary;
  }, [budgetItems]);

  const handleAddItem = async (newItem: Omit<BudgetItem, 'id'>) => {
    if (!projectId) return;
    
    try {
      const totalCost = newItem.hourlyRate * newItem.hoursWorked;
      
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
          }
        ]);

      if (error) throw error;

      await refetch();
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

  const getCategoryVariant = (category: Category) => {
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
            <div>
              <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
                Gestione Budget Progetti
              </h1>
              <p className="text-muted-foreground text-lg">
                Gestisci le attività e i costi del tuo progetto
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={exportToCsv}
                className="shadow-soft hover:shadow-medium transition-all"
              >
                <Download className="w-4 h-4 mr-2" />
                Esporta CSV
              </Button>
              <Button
                onClick={() => setIsFormOpen(true)}
                className="bg-gradient-primary shadow-soft hover:shadow-medium transition-all"
              >
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi Attività
              </Button>
            </div>
          </div>

          <BudgetSummaryCard summary={budgetSummary} />
        </div>

        {/* Budget Items Table */}
        {budgetItems.length > 0 ? (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Attività</TableHead>
                  <TableHead>Assegnatario</TableHead>
                  <TableHead className="text-right">Costo Orario</TableHead>
                  <TableHead className="text-right">Ore</TableHead>
                  <TableHead className="text-right">Totale</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgetItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant={getCategoryVariant(item.category)}>
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{item.activityName}</TableCell>
                    <TableCell>{item.assigneeName}</TableCell>
                    <TableCell className="text-right">€{item.hourlyRate.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{item.hoursWorked.toFixed(1)}h</TableCell>
                    <TableCell className="text-right font-semibold">€{item.totalCost.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingItem(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="bg-gradient-card rounded-lg p-8 shadow-soft">
              <h3 className="text-xl font-semibold mb-2">Nessuna attività presente</h3>
              <p className="text-muted-foreground mb-4">
                Inizia aggiungendo la prima attività al tuo budget
              </p>
              <Button
                onClick={() => setIsFormOpen(true)}
                className="bg-gradient-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi Prima Attività
              </Button>
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
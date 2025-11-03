import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BudgetItem, Category, BudgetSummary } from '@/types/budget';
import { assignees } from '@/data/assignees';
import { BudgetItemForm } from '@/components/BudgetItemForm';
import { BudgetSummaryCard } from '@/components/BudgetSummaryCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, Edit, Trash2, GripVertical, ArrowUpDown, FileText, Percent, Check, X } from 'lucide-react';
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
  assigneeId: dbItem.assignee_id || '',
  assigneeName: dbItem.assignee_name || '',
  hourlyRate: dbItem.hourly_rate,
  hoursWorked: dbItem.hours_worked,
  totalCost: dbItem.total_cost,
  isCustomActivity: dbItem.is_custom_activity,
  isProduct: dbItem.is_product || false,
  productId: dbItem.product_id || '',
  displayOrder: dbItem.display_order,
});

export const BudgetManager = ({ projectId }: BudgetManagerProps) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [sortField, setSortField] = useState<'hours' | 'total' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [canEdit, setCanEdit] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [margin, setMargin] = useState(0);
  const [isEditingMargin, setIsEditingMargin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkUserRole();
    fetchProjectDiscount();
    fetchProjectMargin();
  }, [projectId]);

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

  const fetchProjectDiscount = async () => {
    if (!projectId) return;

    const { data } = await supabase
      .from('projects')
      .select('discount_percentage')
      .eq('id', projectId)
      .single();

    if (data?.discount_percentage) {
      setDiscount(data.discount_percentage);
    }
  };

  const fetchProjectMargin = async () => {
    if (!projectId) return;

    const { data } = await supabase
      .from('projects')
      .select('margin_percentage')
      .eq('id', projectId)
      .single();

    if (data?.margin_percentage) {
      setMargin(data.margin_percentage);
    }
  };

  const handleUpdateDiscount = async (newDiscount: number) => {
    if (!projectId) return;

    const { error } = await supabase
      .from('projects')
      .update({ discount_percentage: newDiscount })
      .eq('id', projectId);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Errore durante l\'aggiornamento dello sconto.',
        variant: 'destructive',
      });
      return;
    }

    setDiscount(newDiscount);
    setIsEditingDiscount(false);
    toast({
      title: 'Sconto aggiornato',
      description: 'Lo sconto è stato applicato con successo.',
    });
  };

  const handleUpdateMargin = async (newMargin: number) => {
    if (!projectId) return;

    const { error } = await supabase
      .from('projects')
      .update({ margin_percentage: newMargin })
      .eq('id', projectId);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Errore durante l\'aggiornamento della marginalità.',
        variant: 'destructive',
      });
      return;
    }

    setMargin(newMargin);
    setIsEditingMargin(false);
    toast({
      title: 'Marginalità aggiornata',
      description: 'La marginalità è stata applicata con successo.',
    });
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
      discountPercentage: discount,
      discountedTotal: 0,
      categoryBreakdown: {},
    };

    let activitiesTotal = 0;
    let productsTotal = 0;

    budgetItems.forEach(item => {
      // Apply margin to activities only
      const itemCost = item.isProduct 
        ? item.totalCost 
        : item.totalCost * (1 + margin / 100);
      
      summary.totalCost += itemCost;
      
      // Products should not contribute to total hours
      if (!item.isProduct) {
        summary.totalHours += item.hoursWorked;
        activitiesTotal += itemCost;
        
        // Only add non-product items to category breakdown
        if (!summary.categoryBreakdown[item.category]) {
          summary.categoryBreakdown[item.category] = { cost: 0, hours: 0 };
        }
        summary.categoryBreakdown[item.category].cost += itemCost;
        summary.categoryBreakdown[item.category].hours += item.hoursWorked;
      } else {
        productsTotal += item.totalCost;
      }
    });

    // Apply discount only to activities (after margin)
    const discountAmount = (activitiesTotal * discount) / 100;
    summary.discountedTotal = activitiesTotal - discountAmount + productsTotal;

    return summary;
  }, [budgetItems, discount, margin]);

  // Update project totals in database
  const updateProjectTotals = async () => {
    if (!projectId) return;
    
    try {
      // Fetch all budget items for this project to recalculate totals
      const { data: items, error: fetchError } = await supabase
        .from('budget_items')
        .select('total_cost, hours_worked, is_product')
        .eq('project_id', projectId);

      if (fetchError) throw fetchError;

      const totalBudget = items?.reduce((sum, item) => sum + item.total_cost, 0) || 0;
      // Exclude products from total hours
      const totalHours = items?.reduce((sum, item) => sum + (item.is_product ? 0 : item.hours_worked), 0) || 0;

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
            assignee_id: newItem.assigneeId || null,
            assignee_name: newItem.assigneeName || null,
            hourly_rate: newItem.hourlyRate,
            hours_worked: newItem.hoursWorked,
            total_cost: totalCost,
            is_custom_activity: newItem.isCustomActivity || false,
            is_product: newItem.isProduct || false,
            product_id: newItem.productId || null,
            display_order: nextOrder,
          }
        ]);

      if (error) throw error;

      await refetch();
      await updateProjectTotals();
      setIsFormOpen(false);
      toast({
        title: newItem.isProduct ? "Prodotto aggiunto" : "Attività aggiunta",
        description: newItem.isProduct 
          ? "Il nuovo prodotto è stato aggiunto al budget."
          : "La nuova attività è stata aggiunta al budget.",
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
          assignee_id: updatedItem.assigneeId || null,
          assignee_name: updatedItem.assigneeName || null,
          hourly_rate: updatedItem.hourlyRate,
          hours_worked: updatedItem.hoursWorked,
          total_cost: totalCost,
          is_custom_activity: updatedItem.isCustomActivity,
          is_product: updatedItem.isProduct || false,
          product_id: updatedItem.productId || null,
        })
        .eq('id', updatedItem.id);

      if (error) throw error;

      await refetch();
      await updateProjectTotals();
      setEditingItem(null);
      toast({
        title: updatedItem.isProduct ? "Prodotto aggiornato" : "Attività aggiornata",
        description: updatedItem.isProduct
          ? "Il prodotto è stato aggiornato con successo."
          : "L'attività è stata aggiornata con successo.",
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
      ['Categoria', 'Nome', 'Tipo', 'Assegnatario', 'Costo Orario/Unitario (€)', 'Ore/Quantità', 'Costo Totale (€)'],
      ...budgetItems.map(item => [
        item.category,
        item.activityName,
        item.isProduct ? 'Prodotto' : 'Attività',
        item.assigneeName || 'N/A',
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

  const handleGeneratePdf = async () => {
    if (!projectId) return;
    
    setIsGeneratingPdf(true);
    try {
      // Fetch project with client info
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*, clients(name, address, phone, email, notes)')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // Filter only products for quote
      const productItems = budgetItems.filter(item => item.isProduct);

      // Fetch services linked to the budget template
      let serviceItems: any[] = [];
      if (projectData.budget_template_id) {
        const { data: services, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .eq('budget_template_id', projectData.budget_template_id);
        
        if (!servicesError && services) {
          serviceItems = services;
        }
      }

      if (productItems.length === 0 && serviceItems.length === 0) {
        toast({
          title: 'Nessun prodotto o servizio',
          description: 'Aggiungi almeno un prodotto o servizio al budget per generare un preventivo.',
          variant: 'destructive',
        });
        return;
      }

      // Calculate totals
      const productsTotal = productItems.reduce((sum, item) => sum + item.totalCost, 0);
      
      // Service price = total budget minus products
      const servicePrice = projectData.total_budget - productsTotal;
      
      // Override service price with calculated value
      serviceItems = serviceItems.map(service => ({
        ...service,
        gross_price: servicePrice,
        net_price: servicePrice / 1.22
      }));
      
      // Apply margin only to services
      const servicesWithMargin = servicePrice * (1 + (margin || 0) / 100);
      
      // Total before discount (products + services with margin)
      const totalAmount = productsTotal + servicesWithMargin;
      
      // Apply discount
      const discountPercentage = discount || 0;
      const marginPercentage = margin || 0;
      const discountAmount = totalAmount * (discountPercentage / 100);
      const discountedTotal = totalAmount - discountAmount;

      // Generate quote number (e.g., PREV-2025-001)
      const now = new Date();
      const year = now.getFullYear();
      const { data: existingQuotes } = await supabase
        .from('quotes')
        .select('quote_number')
        .like('quote_number', `PREV-${year}-%`)
        .order('created_at', { ascending: false })
        .limit(1);
      
      let quoteNumber = `PREV-${year}-001`;
      if (existingQuotes && existingQuotes.length > 0) {
        const lastNumber = parseInt(existingQuotes[0].quote_number.split('-')[2]);
        quoteNumber = `PREV-${year}-${String(lastNumber + 1).padStart(3, '0')}`;
      }

      // Save quote to database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: quoteError } = await supabase
        .from('quotes')
        .insert({
          project_id: projectId,
          user_id: user.id,
          quote_number: quoteNumber,
          total_amount: totalAmount,
          discount_percentage: discountPercentage,
          margin_percentage: marginPercentage,
          discounted_total: discountedTotal,
          status: 'draft',
        });

      if (quoteError) throw quoteError;

      toast({
        title: 'Preventivo creato',
        description: 'Il preventivo è stato creato con successo. Puoi scaricarlo dalla sezione Preventivi.',
      });
    } catch (error) {
      console.error('Error generating quote:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante la creazione del preventivo.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
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

  const getCategoryVariant = (category: string) => {
    switch (category) {
      case 'Dev':
        return 'blue';
      case 'Design':
        return 'purple';
      case 'Management':
        return 'gray';
      case 'Content':
        return 'yellow';
      case 'Marketing':
        return 'green';
      case 'Support':
        return 'red';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Totale: {budgetItems.length} {budgetItems.length === 1 ? 'elemento' : 'elementi'}
          </p>
        </div>
        <div className="flex items-center justify-between mb-6">
            <div className="flex gap-3 items-center flex-wrap">
              {canEdit && (
                <Button
                  onClick={() => setIsFormOpen(true)}
                  className="bg-gradient-primary shadow-soft hover:shadow-medium transition-all"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Aggiungi Elemento
                </Button>
              )}
              
              {/* Discount Input */}
              {canEdit && (
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-card">
                  <Percent className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm whitespace-nowrap">Sconto attività:</Label>
                  {isEditingDiscount ? (
                    <>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={discount}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        className="w-16 h-7 text-sm"
                      />
                      <span className="text-sm">%</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleUpdateDiscount(discount)}
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setIsEditingDiscount(false);
                          fetchProjectDiscount();
                        }}
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-semibold">{discount}%</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => setIsEditingDiscount(true)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              )}
              
              {/* Margin Input */}
              {canEdit && (
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-card">
                  <Percent className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm whitespace-nowrap">Marginalità:</Label>
                  {isEditingMargin ? (
                    <>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={margin}
                        onChange={(e) => setMargin(parseFloat(e.target.value) || 0)}
                        className="w-16 h-7 text-sm"
                      />
                      <span className="text-sm">%</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleUpdateMargin(margin)}
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setIsEditingMargin(false);
                          fetchProjectMargin();
                        }}
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-semibold">{margin}%</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => setIsEditingMargin(true)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              )}
              
              <Button
                variant="outline"
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                className="shadow-soft hover:shadow-medium transition-all"
              >
                <FileText className="w-4 h-4 mr-2" />
                {isGeneratingPdf ? 'Generazione...' : 'Genera Preventivo'}
              </Button>
              
              <Button
                variant="outline"
                onClick={exportToCsv}
                className="shadow-soft hover:shadow-medium transition-all"
              >
                <Download className="w-4 h-4 mr-2" />
                Esporta CSV
              </Button>
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Assegnatario</TableHead>
                    <TableHead className="text-right">Costo Orario/Unitario</TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('hours')}
                        className="h-8 px-2"
                      >
                        Ore/Qtà
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
                  Aggiungi Primo Elemento
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
  );
};

// Sortable Row Component
interface SortableRowProps {
  item: BudgetItem;
  onEdit: (item: BudgetItem) => void;
  onDelete: (id: string) => void;
  getCategoryVariant: (category: string) => "default" | "destructive" | "outline" | "secondary" | "blue" | "purple" | "gray" | "yellow" | "green" | "red";
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
      <TableCell>
        <Badge variant={item.isProduct ? "secondary" : "outline"}>
          {item.isProduct ? 'Prodotto' : 'Attività'}
        </Badge>
      </TableCell>
      <TableCell>{item.assigneeName || '-'}</TableCell>
      <TableCell className="text-right">
        {item.isProduct ? `${item.hourlyRate.toFixed(2)} €` : `${item.hourlyRate.toFixed(2)} €/h`}
      </TableCell>
      <TableCell className="text-right">
        {item.isProduct ? item.hoursWorked.toFixed(0) : `${item.hoursWorked.toFixed(1)}h`}
      </TableCell>
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
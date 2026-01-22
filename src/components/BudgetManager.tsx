import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BudgetItem, Category, BudgetSummary } from '@/types/budget';
import { assignees } from '@/data/assignees';
import { getRolePermissions } from '@/lib/permissions';
import { formatHours } from '@/lib/utils';

type UserRole = 'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member';
import { BudgetItemForm } from '@/components/BudgetItemForm';
import { BudgetSummaryCard } from '@/components/BudgetSummaryCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Download, Edit, Trash2, GripVertical, ArrowUpDown, FileText, Percent, Check, X, Copy, MoreVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getCategoryBadgeColor } from '@/lib/categoryColors';
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
  projectId?: string;  // This is now actually the budget_id
  budgetId?: string;   // Explicit budget_id
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
  parentId: dbItem.parent_id || null,
});

export const BudgetManager = ({ projectId, budgetId: explicitBudgetId }: BudgetManagerProps) => {
  // Use explicit budgetId if provided, otherwise fall back to projectId (for backward compatibility)
  const budgetId = explicitBudgetId || projectId;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [sortField, setSortField] = useState<'hours' | 'total' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [canEdit, setCanEdit] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [margin, setMargin] = useState(0);
  const [isEditingMargin, setIsEditingMargin] = useState(false);
  const [editingServices, setEditingServices] = useState<any[]>([]);
  const [isEditingServices, setIsEditingServices] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkUserRole();
    fetchBudgetMargin();
  }, [budgetId]);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    // Use permissions from database to check if user can edit budget
    const permissions = getRolePermissions(roleData?.role as UserRole | null);
    setCanEdit(permissions.canEditBudget);
  };


  const fetchBudgetMargin = async () => {
    if (!budgetId) return;

    const { data } = await supabase
      .from('budgets')
      .select('margin_percentage')
      .eq('id', budgetId)
      .single();

    if (data?.margin_percentage) {
      setMargin(data.margin_percentage);
    }
  };


  const handleUpdateMargin = async (newMargin: number) => {
    if (!budgetId) return;

    const { error } = await supabase
      .from('budgets')
      .update({ margin_percentage: newMargin })
      .eq('id', budgetId);

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
    queryKey: ['budget-items', budgetId],
    queryFn: async () => {
      if (!budgetId) return [];
      
      // Try to fetch by budget_id first, then fall back to project_id for backward compatibility
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .or(`budget_id.eq.${budgetId},project_id.eq.${budgetId}`)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data.map(transformDbToBudgetItem);
    },
    enabled: !!budgetId,
  });

  // Fetch budget to get budget_template_id and project billing_type
  const { data: budgetData } = useQuery({
    queryKey: ['budget-template', budgetId],
    queryFn: async () => {
      if (!budgetId) return null;
      
      const { data, error } = await supabase
        .from('budgets')
        .select('budget_template_id, project_id, projects:project_id(billing_type)')
        .eq('id', budgetId)
        .single();
      
      if (error) throw error;
      return {
        ...data,
        billing_type: data.projects?.billing_type || null
      };
    },
    enabled: !!budgetId,
  });

  // Fetch services linked to budget template
  const { data: services = [], refetch: refetchServices } = useQuery({
    queryKey: ['template-services', budgetData?.budget_template_id],
    queryFn: async () => {
      if (!budgetData?.budget_template_id) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('budget_template_id', budgetData.budget_template_id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!budgetData?.budget_template_id,
  });

  // Update editingServices when services data changes
  useEffect(() => {
    if (services.length > 0 && !isEditingServices) {
      setEditingServices(services);
    }
  }, [services, isEditingServices]);

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
      discountPercentage: 0,
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

    // No discount in budget - discount is only applied in quotes
    summary.discountedTotal = activitiesTotal + productsTotal;

    return summary;
  }, [budgetItems, margin]);

  // Update budget totals in database
  const updateBudgetTotals = async () => {
    if (!budgetId) return;
    
    try {
      // Fetch all budget items for this budget to recalculate totals
      const { data: items, error: fetchError } = await supabase
        .from('budget_items')
        .select('total_cost, hours_worked, is_product')
        .or(`budget_id.eq.${budgetId},project_id.eq.${budgetId}`);

      if (fetchError) throw fetchError;

      const totalBudget = items?.reduce((sum, item) => sum + item.total_cost, 0) || 0;
      // Exclude products from total hours
      const totalHours = items?.reduce((sum, item) => sum + (item.is_product ? 0 : item.hours_worked), 0) || 0;

      const { error } = await supabase
        .from('budgets')
        .update({
          total_budget: totalBudget,
          total_hours: totalHours,
        })
        .eq('id', budgetId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating budget totals:', error);
    }
  };

  const handleAddItem = async (newItemOrItems: Omit<BudgetItem, 'id'> | Array<Omit<BudgetItem, 'id'>>) => {
    if (!budgetId) return;
    
    try {
      // Handle array of items (from multi-select)
      const itemsToAdd = Array.isArray(newItemOrItems) ? newItemOrItems : [newItemOrItems];
      
      // Get the max display_order for this budget
      const { data: maxOrderData } = await supabase
        .from('budget_items')
        .select('display_order')
        .or(`budget_id.eq.${budgetId},project_id.eq.${budgetId}`)
        .order('display_order', { ascending: false })
        .limit(1);
      
      let nextOrder = maxOrderData && maxOrderData.length > 0 
        ? maxOrderData[0].display_order + 1 
        : 1;
      
      const insertData = itemsToAdd.map((newItem, index) => {
        const totalCost = newItem.hourlyRate * newItem.hoursWorked;
        return {
          budget_id: budgetId,
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
          display_order: nextOrder + index,
        };
      });
      
      const { error } = await supabase
        .from('budget_items')
        .insert(insertData);

      if (error) throw error;

      await refetch();
      await updateBudgetTotals();
      setIsFormOpen(false);
      
      const count = itemsToAdd.length;
      const hasProducts = itemsToAdd.some(i => i.isProduct);
      toast({
        title: count > 1 ? `${count} attività aggiunte` : (hasProducts ? "Prodotto aggiunto" : "Attività aggiunta"),
        description: count > 1 
          ? `Le ${count} attività sono state aggiunte al budget.`
          : (hasProducts 
            ? "Il nuovo prodotto è stato aggiunto al budget."
            : "La nuova attività è stata aggiunta al budget."),
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
      await updateBudgetTotals();
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
      await updateBudgetTotals();
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

  const handleDuplicateItem = async (item: BudgetItem) => {
    if (!budgetId) return;
    
    try {
      // Get the max display_order for this budget
      const { data: maxOrderData } = await supabase
        .from('budget_items')
        .select('display_order')
        .or(`budget_id.eq.${budgetId},project_id.eq.${budgetId}`)
        .order('display_order', { ascending: false })
        .limit(1);
      
      const nextOrder = maxOrderData && maxOrderData.length > 0 
        ? maxOrderData[0].display_order + 1 
        : 1;
      
      const { error } = await supabase
        .from('budget_items')
        .insert([
          {
            budget_id: budgetId,
            category: item.category,
            activity_name: item.activityName,
            assignee_id: item.assigneeId || null,
            assignee_name: item.assigneeName || null,
            hourly_rate: item.hourlyRate,
            hours_worked: item.hoursWorked,
            total_cost: item.totalCost,
            is_custom_activity: item.isCustomActivity || false,
            is_product: item.isProduct || false,
            product_id: item.productId || null,
            display_order: nextOrder,
          }
        ]);

      if (error) throw error;

      await refetch();
      await updateBudgetTotals();
      toast({
        title: item.isProduct ? "Prodotto duplicato" : "Attività duplicata",
        description: item.isProduct 
          ? "Il prodotto è stato duplicato con successo."
          : "L'attività è stata duplicata con successo.",
      });
    } catch (error) {
      console.error('Error duplicating budget item:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la duplicazione.",
        variant: "destructive",
      });
    }
  };

  const handleEditServices = () => {
    setEditingServices([...services]);
    setIsEditingServices(true);
  };

  const handleCancelEditServices = () => {
    setEditingServices([...services]);
    setIsEditingServices(false);
  };

  const updateService = (id: string, field: string, value: any) => {
    setEditingServices(prev => 
      prev.map(service => {
        if (service.id === id) {
          const updated = { ...service, [field]: value };
          
          // Recalculate gross_price if net_price or vat_rate changes
          if (field === 'net_price' || field === 'vat_rate') {
            const netPrice = field === 'net_price' ? value : updated.net_price;
            const vatRate = field === 'vat_rate' ? value : (updated.vat_rate || 22);
            updated.gross_price = netPrice * (1 + vatRate / 100);
          }
          
          return updated;
        }
        return service;
      })
    );
  };

  const handleSaveServices = async () => {
    try {
      // Update each service
      for (const service of editingServices) {
        const { error } = await supabase
          .from('services')
          .update({
            name: service.name,
            description: service.description,
            category: service.category,
            net_price: service.net_price,
            vat_rate: service.vat_rate || 22,
            gross_price: service.gross_price,
          })
          .eq('id', service.id);

        if (error) throw error;
      }

      await refetchServices();
      setIsEditingServices(false);
      toast({
        title: 'Servizi aggiornati',
        description: 'I servizi sono stati aggiornati con successo.',
      });
    } catch (error) {
      console.error('Error updating services:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante l\'aggiornamento dei servizi.',
        variant: 'destructive',
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
    if (!budgetId) return;
    
    setIsGeneratingPdf(true);
    try {
      // Fetch budget with client info
      const { data: budgetDataForQuote, error: budgetError } = await supabase
        .from('budgets')
        .select('*, clients(id, name, address, phone, email, notes)')
        .eq('id', budgetId)
        .single();

      if (budgetError) throw budgetError;

      // Filter only products for quote
      const productItems = budgetItems.filter(item => item.isProduct);

      // Fetch services linked to the budget template
      let serviceItems: any[] = [];
      if (budgetDataForQuote.budget_template_id) {
        const { data: services, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .eq('budget_template_id', budgetDataForQuote.budget_template_id);
        
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
      const servicePrice = (budgetDataForQuote.total_budget || 0) - productsTotal;
      
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
      
      // No discount in quote generation from budget - set to 0
      const discountPercentage = 0;
      const marginPercentage = margin || 0;
      const discountedTotal = totalAmount;

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

      // Save quote to database - use budgetId for project_id for now
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: newQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          project_id: budgetId, // Using budgetId as project_id for backward compatibility
          budget_id: budgetId,
          user_id: user.id,
          quote_number: quoteNumber,
          total_amount: totalAmount,
          discount_percentage: discountPercentage,
          margin_percentage: marginPercentage,
          discounted_total: discountedTotal,
          status: 'draft',
        })
        .select('id')
        .single();

      if (quoteError) throw quoteError;

      // Fetch client payment splits and copy them to the new quote
      if (budgetDataForQuote.client_id && newQuote?.id) {
        const { data: clientPaymentSplits } = await supabase
          .from('client_payment_splits')
          .select('*')
          .eq('client_id', budgetDataForQuote.client_id)
          .order('display_order');

        if (clientPaymentSplits && clientPaymentSplits.length > 0) {
          const quotePaymentSplits = clientPaymentSplits.map(split => ({
            quote_id: newQuote.id,
            payment_mode_id: split.payment_mode_id,
            payment_term_id: split.payment_term_id,
            percentage: split.percentage,
            display_order: split.display_order || 0,
          }));

          const { error: splitsError } = await supabase
            .from('quote_payment_splits')
            .insert(quotePaymentSplits);

          if (splitsError) {
            console.error('Error copying payment splits:', splitsError);
          }
        }
      }

      // Fetch product payment splits and copy them to the new quote
      if (productItems.length > 0 && newQuote?.id) {
        const productIds = productItems
          .filter(item => item.productId)
          .map(item => item.productId);

        if (productIds.length > 0) {
          const { data: productPaymentSplits } = await supabase
            .from('product_payment_splits')
            .select('*')
            .in('product_id', productIds)
            .order('display_order');

          if (productPaymentSplits && productPaymentSplits.length > 0) {
            // Get existing quote payment splits to determine next display_order
            const { data: existingQuoteSplits } = await supabase
              .from('quote_payment_splits')
              .select('display_order')
              .eq('quote_id', newQuote.id)
              .order('display_order', { ascending: false })
              .limit(1);

            let nextOrder = existingQuoteSplits && existingQuoteSplits.length > 0
              ? (existingQuoteSplits[0].display_order || 0) + 1
              : 0;

            const productQuoteSplits = productPaymentSplits.map(split => ({
              quote_id: newQuote.id,
              payment_mode_id: split.payment_mode_id,
              payment_term_id: split.payment_term_id,
              percentage: split.percentage,
              display_order: nextOrder++,
            }));

            const { error: productSplitsError } = await supabase
              .from('quote_payment_splits')
              .insert(productQuoteSplits);

            if (productSplitsError) {
              console.error('Error copying product payment splits:', productSplitsError);
            }
          }
        }
      }

      // Fetch service payment splits and copy them to the new quote
      if (serviceItems.length > 0 && newQuote?.id) {
        const serviceIds = serviceItems.map(service => service.id);

        if (serviceIds.length > 0) {
          const { data: servicePaymentSplits } = await supabase
            .from('service_payment_splits')
            .select('*')
            .in('service_id', serviceIds)
            .order('display_order');

          if (servicePaymentSplits && servicePaymentSplits.length > 0) {
            // Get existing quote payment splits to determine next display_order
            const { data: existingQuoteSplits } = await supabase
              .from('quote_payment_splits')
              .select('display_order')
              .eq('quote_id', newQuote.id)
              .order('display_order', { ascending: false })
              .limit(1);

            let nextOrder = existingQuoteSplits && existingQuoteSplits.length > 0
              ? (existingQuoteSplits[0].display_order || 0) + 1
              : 0;

            const serviceQuoteSplits = servicePaymentSplits.map(split => ({
              quote_id: newQuote.id,
              payment_mode_id: split.payment_mode_id,
              payment_term_id: split.payment_term_id,
              percentage: split.percentage,
              display_order: nextOrder++,
            }));

            const { error: serviceSplitsError } = await supabase
              .from('quote_payment_splits')
              .insert(serviceQuoteSplits);

            if (serviceSplitsError) {
              console.error('Error copying service payment splits:', serviceSplitsError);
            }
          }
        }
      }

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


  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
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
                          fetchBudgetMargin();
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
                        onDuplicate={handleDuplicateItem}
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
          onSubmit={(item) => handleAddItem(item)}
          billingType={budgetData?.billing_type}
        />

        {editingItem && (
          <BudgetItemForm
            isOpen={!!editingItem}
            onClose={() => setEditingItem(null)}
            onSubmit={handleUpdateItem}
            initialData={editingItem}
            isEditing
            billingType={budgetData?.billing_type}
          />
        )}



      {/* Services Section */}
      {services.length > 0 && (
        <div className="rounded-lg border bg-card mt-8">
          <div className="p-6 border-b flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Servizi Collegati</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Servizi dal template di budget collegato
              </p>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                {isEditingServices ? (
                  <>
                    <Button
                      onClick={handleSaveServices}
                      size="sm"
                      className="bg-gradient-primary"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Salva
                    </Button>
                    <Button
                      onClick={handleCancelEditServices}
                      size="sm"
                      variant="outline"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Annulla
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleEditServices}
                    size="sm"
                    variant="outline"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Modifica
                  </Button>
                )}
              </div>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codice</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Categoria</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editingServices.map((service: any) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.code}</TableCell>
                  <TableCell>
                    {isEditingServices ? (
                      <Input
                        value={service.name}
                        onChange={(e) => updateService(service.id, 'name', e.target.value)}
                        className="min-w-[150px]"
                      />
                    ) : (
                      service.name
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditingServices ? (
                      <Input
                        value={service.description || ''}
                        onChange={(e) => updateService(service.id, 'description', e.target.value)}
                        className="min-w-[200px]"
                        placeholder="Descrizione"
                      />
                    ) : (
                      service.description || '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditingServices ? (
                      <Input
                        value={service.category}
                        onChange={(e) => updateService(service.id, 'category', e.target.value)}
                        className="min-w-[120px]"
                      />
                    ) : (
                      <Badge variant="outline">{service.category}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

// Sortable Row Component
interface SortableRowProps {
  item: BudgetItem;
  onEdit: (item: BudgetItem) => void;
  onDelete: (id: string) => void;
  onDuplicate: (item: BudgetItem) => void;
  canEdit: boolean;
}

const SortableRow = ({ item, onEdit, onDelete, onDuplicate, canEdit }: SortableRowProps) => {
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
        <Badge className={getCategoryBadgeColor(item.category)}>
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
        {item.isProduct ? `${((item.hourlyRate ?? 0) / 1.22).toFixed(2)} €` : `${(item.hourlyRate ?? 0).toFixed(2)} €/h`}
      </TableCell>
      <TableCell className="text-right">
        {item.isProduct ? (item.hoursWorked ?? 0).toFixed(0) : formatHours(item.hoursWorked ?? 0)}
      </TableCell>
      <TableCell className="text-right font-semibold">{item.isProduct ? ((item.totalCost ?? 0) / 1.22).toFixed(2) : (item.totalCost ?? 0).toFixed(2)} €</TableCell>
      {canEdit && (
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Edit className="h-4 w-4 mr-2" />
                Modifica
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(item)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplica
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(item.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      )}
    </TableRow>
  );
};
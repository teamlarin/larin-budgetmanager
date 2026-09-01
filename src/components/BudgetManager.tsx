import React, { useState, useMemo, useEffect } from 'react';
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

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Download, Edit, Trash2, GripVertical, ArrowUpDown, Copy, MoreVertical, ChevronDown, ChevronRight, FolderInput } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getCategoryBadgeColor } from '@/lib/categoryColors';
import { getDisciplineColor, getDisciplineLabel } from '@/lib/disciplineColors';
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
  sourceTemplateId: dbItem.source_template_id || null,
});

export const BudgetManager = ({ projectId, budgetId: explicitBudgetId }: BudgetManagerProps) => {
  // Use explicit budgetId if provided, otherwise fall back to projectId (for backward compatibility)
  const budgetId = explicitBudgetId || projectId;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [addToGroup, setAddToGroup] = useState<{ key: string; label: string; templateId: string | null } | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<{ key: string; label: string; ids: string[] } | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [sortField, setSortField] = useState<'hours' | 'total' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [canEdit, setCanEdit] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [margin, setMargin] = useState(0);
  const [isEditingMargin, setIsEditingMargin] = useState(false);

  const collapseStorageKey = budgetId ? `budget-collapsed-groups:${budgetId}` : null;
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    if (typeof window === 'undefined' || !collapseStorageKey) return new Set();
    try {
      const raw = window.localStorage.getItem(collapseStorageKey);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? new Set<string>(arr) : new Set();
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    if (!collapseStorageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(collapseStorageKey, JSON.stringify(Array.from(collapsedGroups)));
    } catch {
      // ignore
    }
  }, [collapsedGroups, collapseStorageKey]);
  const toggleGroupCollapsed = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
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
    setIsCoordinator(roleData?.role === 'coordinator');
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

  // Fetch templates referenced by current budget items (for group headers)
  const referencedTemplateIds = useMemo(() => {
    const ids = new Set<string>();
    rawBudgetItems.forEach((it) => {
      if (it.sourceTemplateId) ids.add(it.sourceTemplateId);
    });
    return Array.from(ids);
  }, [rawBudgetItems]);

  const { data: referencedTemplates = [] } = useQuery({
    queryKey: ['referenced-budget-templates', referencedTemplateIds],
    queryFn: async () => {
      if (referencedTemplateIds.length === 0) return [];
      const { data, error } = await supabase
        .from('budget_templates')
        .select('id, name, discipline')
        .in('id', referencedTemplateIds);
      if (error) throw error;
      return data || [];
    },
    enabled: referencedTemplateIds.length > 0,
  });

  const templatesById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; discipline: string }>();
    referencedTemplates.forEach((t: any) => map.set(t.id, t));
    return map;
  }, [referencedTemplates]);

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

  // Group items by source template (or fallback groups)
  type ItemGroup = {
    key: string;
    label: string;
    discipline: string | null;
    items: BudgetItem[];
    totalHours: number;
    totalCost: number;
  };

  const groupedItems = useMemo<ItemGroup[]>(() => {
    const map = new Map<string, ItemGroup>();
    const order: string[] = [];

    budgetItems.forEach((item) => {
      let key: string;
      let label: string;
      let discipline: string | null = null;

      if (item.sourceTemplateId && templatesById.has(item.sourceTemplateId)) {
        const tpl = templatesById.get(item.sourceTemplateId)!;
        key = `tpl:${tpl.id}`;
        label = tpl.name;
        discipline = tpl.discipline || null;
      } else if (item.isProduct) {
        key = '__products__';
        label = 'Prodotti';
      } else {
        key = '__custom__';
        label = 'Attività personalizzate';
      }

      if (!map.has(key)) {
        map.set(key, { key, label, discipline, items: [], totalHours: 0, totalCost: 0 });
        order.push(key);
      }
      const group = map.get(key)!;
      group.items.push(item);
      group.totalHours += item.hoursWorked ?? 0;
      group.totalCost += item.totalCost ?? 0;
    });

    return order.map((k) => map.get(k)!);
  }, [budgetItems, templatesById]);

  // Sezioni disponibili come destinazione per lo spostamento di una voce
  const sectionOptions = useMemo<{ templateId: string | null; label: string }[]>(() => {
    const options: { templateId: string | null; label: string }[] = [];
    groupedItems.forEach((g) => {
      if (g.key.startsWith('tpl:')) {
        options.push({ templateId: g.key.slice(4), label: g.label });
      }
    });
    options.push({ templateId: null, label: 'Attività personalizzate' });
    return options;
  }, [groupedItems]);


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
          source_template_id: newItem.sourceTemplateId || addToGroup?.templateId || null,
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
      setAddToGroup(null);
      
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
          source_template_id: updatedItem.sourceTemplateId || null,
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

  /** Sposta una voce in un'altra sezione (servizio/template di origine) */
  const handleMoveItemToGroup = async (itemId: string, templateId: string | null, label: string) => {
    try {
      const { error } = await supabase
        .from('budget_items')
        .update({ source_template_id: templateId })
        .eq('id', itemId);
      if (error) throw error;

      await refetch();
      await updateBudgetTotals();
      toast({
        title: 'Voce spostata',
        description: `La voce è stata spostata nella sezione "${label}".`,
      });
    } catch (error) {
      console.error('Error moving budget item:', error);
      toast({
        title: 'Errore',
        description: "Si è verificato un errore durante lo spostamento della voce.",
        variant: 'destructive',
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

  const confirmDeleteGroup = async () => {
    if (!groupToDelete || groupToDelete.ids.length === 0) return;
    setIsDeletingGroup(true);
    try {
      const { error } = await supabase
        .from('budget_items')
        .delete()
        .in('id', groupToDelete.ids);

      if (error) throw error;

      await refetch();
      await updateBudgetTotals();
      toast({
        title: "Gruppo eliminato",
        description: `${groupToDelete.ids.length} attività rimosse da "${groupToDelete.label}".`,
      });
      setGroupToDelete(null);
    } catch (error) {
      console.error('Error deleting budget group:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione del gruppo.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingGroup(false);
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

    const activeId = String(active.id);
    const overId = String(over.id);
    const isGroupDrag = activeId.startsWith('group:') && overId.startsWith('group:');
    const isItemDrag = !activeId.startsWith('group:') && !overId.startsWith('group:');

    try {
      let reorderedItems: BudgetItem[] = [];

      if (isGroupDrag) {
        const fromKey = activeId.slice('group:'.length);
        const toKey = overId.slice('group:'.length);
        const groupKeys = groupedItems.map((g) => g.key);
        const oldIdx = groupKeys.indexOf(fromKey);
        const newIdx = groupKeys.indexOf(toKey);
        if (oldIdx === -1 || newIdx === -1) return;
        const reorderedKeys = arrayMove(groupKeys, oldIdx, newIdx);
        const groupsByKey = new Map(groupedItems.map((g) => [g.key, g]));
        reorderedItems = reorderedKeys.flatMap((k) => groupsByKey.get(k)!.items);
      } else if (isItemDrag) {
        const oldIndex = budgetItems.findIndex((item) => item.id === activeId);
        const newIndex = budgetItems.findIndex((item) => item.id === overId);
        if (oldIndex === -1 || newIndex === -1) return;
        reorderedItems = arrayMove(budgetItems, oldIndex, newIndex);
      } else {
        // mismatched types — ignore
        return;
      }

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

          <BudgetSummaryCard summary={budgetSummary} marginPercentage={margin} />
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
                    items={groupedItems.map((g) => `group:${g.key}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {groupedItems.map((group) => {
                      const isCollapsed = collapsedGroups.has(group.key);
                      return (
                        <React.Fragment key={`group-${group.key}`}>
                          <SortableGroupHeader
                            groupKey={group.key}
                            label={group.label}
                            discipline={group.discipline}
                            itemsCount={group.items.length}
                            totalHours={group.totalHours}
                            totalCost={group.totalCost}
                            collapsed={isCollapsed}
                            onToggle={() => toggleGroupCollapsed(group.key)}
                            onDelete={() =>
                              setGroupToDelete({
                                key: group.key,
                                label: group.label,
                                ids: group.items.map((i) => i.id),
                              })
                            }
                            onAddItem={() => {
                              setAddToGroup({
                                key: group.key,
                                label: group.label,
                                templateId: group.key.startsWith('tpl:') ? group.key.slice(4) : null,
                              });
                              setIsFormOpen(true);
                            }}
                            canEdit={canEdit}
                            colSpan={canEdit ? 9 : 7}
                          />
                          {!isCollapsed && (
                            <SortableContext
                              items={group.items.map((item) => item.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {group.items.map((item) => (
                                <SortableRow
                                  key={item.id}
                                  item={item}
                                  onEdit={setEditingItem}
                                  onDelete={handleDeleteItem}
                                  onDuplicate={handleDuplicateItem}
                                  onMoveToSection={handleMoveItemToGroup}
                                  sectionOptions={sectionOptions}
                                  currentSectionId={group.key.startsWith('tpl:') ? group.key.slice(4) : null}
                                  canEdit={canEdit}
                                />
                              ))}
                            </SortableContext>
                          )}
                        </React.Fragment>
                      );
                    })}
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
          key={addToGroup?.key || 'new-item'}
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setAddToGroup(null); }}
          onSubmit={(item) => handleAddItem(item)}
          billingType={budgetData?.billing_type}
          presetSourceTemplateId={addToGroup?.templateId ?? null}
          presetGroupLabel={addToGroup?.label ?? null}
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

        <AlertDialog
          open={!!groupToDelete}
          onOpenChange={(open) => {
            if (!open && !isDeletingGroup) setGroupToDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare il gruppo?</AlertDialogTitle>
              <AlertDialogDescription>
                {groupToDelete && (
                  <>
                    Stai per eliminare {groupToDelete.ids.length}{' '}
                    {groupToDelete.ids.length === 1 ? 'attività' : 'attività'} dal gruppo{' '}
                    <strong>"{groupToDelete.label}"</strong>. L'azione non è reversibile.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingGroup}>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  confirmDeleteGroup();
                }}
                disabled={isDeletingGroup}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingGroup ? 'Eliminazione...' : 'Elimina tutto'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

    </div>
  );
};

// Sortable Row Component
interface SortableRowProps {
  item: BudgetItem;
  onEdit: (item: BudgetItem) => void;
  onDelete: (id: string) => void;
  onDuplicate: (item: BudgetItem) => void;
  onMoveToSection: (itemId: string, templateId: string | null, label: string) => void;
  sectionOptions: { templateId: string | null; label: string }[];
  currentSectionId: string | null;
  canEdit: boolean;
}

const SortableRow = ({ item, onEdit, onDelete, onDuplicate, onMoveToSection, sectionOptions, currentSectionId, canEdit }: SortableRowProps) => {
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
        {item.isProduct ? `${(item.hourlyRate ?? 0).toFixed(2)} €` : `${(item.hourlyRate ?? 0).toFixed(2)} €/h`}
      </TableCell>
      <TableCell className="text-right">
        {item.isProduct ? (item.hoursWorked ?? 0).toFixed(0) : formatHours(item.hoursWorked ?? 0)}
      </TableCell>
      <TableCell className="text-right font-semibold">{(item.totalCost ?? 0).toFixed(2)} €</TableCell>
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
              {sectionOptions.length > 1 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderInput className="h-4 w-4 mr-2" />
                    Sposta in sezione
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                    {sectionOptions
                      .filter((s) => s.templateId !== currentSectionId)
                      .map((s) => (
                        <DropdownMenuItem
                          key={s.templateId ?? 'custom'}
                          onClick={() => onMoveToSection(item.id, s.templateId, s.label)}
                        >
                          <span className="truncate">{s.label}</span>
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
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

// Sortable Group Header (drag whole groups + accordion toggle)
interface SortableGroupHeaderProps {
  groupKey: string;
  label: string;
  discipline: string | null;
  itemsCount: number;
  totalHours: number;
  totalCost: number;
  collapsed: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onAddItem: () => void;
  canEdit: boolean;
  colSpan: number;
}

const SortableGroupHeader = ({
  groupKey,
  label,
  discipline,
  itemsCount,
  totalHours,
  totalCost,
  collapsed,
  onToggle,
  onDelete,
  onAddItem,
  canEdit,
  colSpan,
}: SortableGroupHeaderProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `group:${groupKey}`, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className="bg-muted/40 hover:bg-muted/40 cursor-pointer"
      onClick={onToggle}
    >
      <TableCell colSpan={colSpan} className="py-2">
        <div className="flex items-center gap-2">
          {canEdit && (
            <div
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="cursor-grab active:cursor-grabbing pr-1"
              title="Trascina per riordinare"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="font-semibold text-sm">{label}</span>
          {discipline && (
            <Badge
              variant="outline"
              className={`text-[10px] ${getDisciplineColor(discipline as any)}`}
            >
              {getDisciplineLabel(discipline as any)}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {itemsCount} {itemsCount === 1 ? 'voce' : 'voci'}
            </span>
            <span className="text-xs font-medium">{formatHours(totalHours)}</span>
            <span className="text-xs font-semibold">{totalCost.toFixed(2)} €</span>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-primary/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddItem();
                }}
                title={`Aggiungi attività in "${label}"`}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title={`Elimina tutto "${label}"`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
};
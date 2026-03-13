import { useState, useMemo } from 'react';
import { calculateSafeHours } from '@/lib/timeUtils';
import { useNavigate } from 'react-router-dom';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, ArrowUpDown, Users, Trash2, Copy, MoreVertical, Edit, Check, X, FileText, Archive, Square, CheckSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { TableNameCell } from '@/components/ui/table-name-cell';

import type { Project } from '@/types/project';
import { hasPermission } from '@/lib/permissions';
type ProjectWithDetails = Project & {
  profiles: {
    first_name: string;
    last_name: string;
  } | null;
  account_profiles: {
    first_name: string;
    last_name: string;
  } | null;
  assigned_profiles: {
    first_name: string;
    last_name: string;
  } | null;
  clients: {
    name: string;
  } | null;
  hasQuote?: boolean;
  quoteStatus?: string;
  quoteId?: string;
  quoteNumber?: string;
  confirmedCosts?: number;
  residualMargin?: number;
  targetBudget?: number;
};
type SortField = 'name' | 'client' | 'owner' | 'account' | 'amount' | 'created' | null;
type SortDirection = 'asc' | 'desc';
const Index = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    toast
  } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedQuoteFilter, setSelectedQuoteFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedProjectStatusFilter, setSelectedProjectStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showOnlyMyBudgets, setShowOnlyMyBudgets] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member' | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'client' | 'account' | 'status' | null>(null);
  const [editedName, setEditedName] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBudgets, setSelectedBudgets] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const ITEMS_PER_PAGE = 50;
  const {
    data: projects = [],
    isLoading,
    refetch
  } = useQuery<ProjectWithDetails[]>({
    queryKey: ['all-projects', 'v2'], // v2: now includes all time tracking for margin calculation
    queryFn: async () => {
      // Get current user
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Check user role
      if (user) {
        const {
          data: roleData
        } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
        const role = roleData?.role as 'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null;
        setUserRole(role);
      }

      // Fetch overheads setting
      const { data: overheadsData } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'overheads')
        .maybeSingle();
      
      const overheadsAmount = overheadsData?.setting_value && 
        typeof overheadsData.setting_value === 'object' && 
        'amount' in overheadsData.setting_value 
        ? Number((overheadsData.setting_value as { amount: number }).amount) || 0 
        : 0;

      // Fetch clients and users
      const {
        data: clientsData
      } = await supabase.from('clients').select('*').order('name');
      const {
        data: usersData
      } = await supabase.from('profiles').select('id, first_name, last_name, email').eq('approved', true).order('first_name');
      setClients(clientsData || []);
      setUsers(usersData || []);

      // Fetch budgets with clients (budgets are now the source of truth for budget data)
      const {
        data: budgetsData,
        error: budgetsError
      } = await supabase.from('budgets').select('*, clients(name), projects(id, name, project_status, progress, start_date, end_date, is_billable, billing_type, drive_folder_id, drive_folder_name, timesheet_share_token, timesheet_token_created_at, projection_warning_threshold, projection_critical_threshold, manual_activities_budget)').order('created_at', {
        ascending: false
      });
      if (budgetsError) throw budgetsError;

      // Map budgets to project-like structure for backward compatibility
      const projectsData = budgetsData?.map(budget => ({
        ...budget,
        // Use project data if linked, otherwise use budget data
        project_status: budget.projects?.project_status || 'in_partenza',
        progress: budget.projects?.progress || 0,
        start_date: budget.projects?.start_date || null,
        end_date: budget.projects?.end_date || null,
        is_billable: budget.projects?.is_billable ?? true,
        billing_type: budget.projects?.billing_type || 'one_shot',
        drive_folder_id: budget.projects?.drive_folder_id || null,
        drive_folder_name: budget.projects?.drive_folder_name || null,
        timesheet_share_token: budget.projects?.timesheet_share_token || null,
        timesheet_token_created_at: budget.projects?.timesheet_token_created_at || null,
        projection_warning_threshold: budget.projects?.projection_warning_threshold || 10,
        projection_critical_threshold: budget.projects?.projection_critical_threshold || 25,
        manual_activities_budget: budget.projects?.manual_activities_budget || null,
      })) || [];

      // Fetch quotes for all budgets
      const budgetIds = budgetsData?.map(b => b.id) || [];
      const {
        data: quotesData
      } = await supabase.from('quotes').select('id, budget_id, status, quote_number').in('budget_id', budgetIds);
      
      // Create a map of budget_id to quote info
      const quotesMap = new Map(quotesData?.map(q => [q.budget_id, { status: q.status, id: q.id, quoteNumber: q.quote_number }]) || []);

      // Fetch budget items for all budgets using budget_id
      const { data: budgetItemsData } = await supabase
        .from('budget_items')
        .select('id, budget_id, is_product, total_cost, vat_rate')
        .in('budget_id', budgetIds);
      
      // Create a map of budget_item_id to budget_id
      const budgetItemsMap = new Map(budgetItemsData?.map(bi => [bi.id, bi.budget_id]) || []);
      const budgetItemIds = budgetItemsData?.map(bi => bi.id) || [];

      // Calculate external costs (products) per budget - net cost without VAT
      const externalCostsMap = new Map<string, number>();
      budgetItemsData?.forEach(item => {
        if (item.is_product && item.budget_id) {
          const totalCost = Number(item.total_cost || 0);
          const vatRate = Number(item.vat_rate || 22);
          const netCost = totalCost / (1 + vatRate / 100);
          const currentCost = externalCostsMap.get(item.budget_id) || 0;
          externalCostsMap.set(item.budget_id, currentCost + netCost);
        }
      });

      // Fetch time tracking entries for confirmed hours (with user_id for hourly rate)
      const { data: timeTrackingData } = await supabase
        .from('activity_time_tracking')
        .select('budget_item_id, actual_start_time, actual_end_time, user_id')
        .in('budget_item_id', budgetItemIds)
        .not('actual_start_time', 'is', null)
        .not('actual_end_time', 'is', null);

      // Fetch user hourly rates from profiles
      const timeTrackingUserIds = [...new Set(timeTrackingData?.map(t => t.user_id) || [])];
      const { data: timeTrackingProfiles } = await supabase
        .from('profiles')
        .select('id, hourly_rate')
        .in('id', timeTrackingUserIds);
      
      const profileHourlyRateMap = new Map(timeTrackingProfiles?.map(p => [p.id, Number(p.hourly_rate) || 0]) || []);

      // Calculate confirmed costs per project using user's hourly rate + overheads
      const confirmedCostsMap = new Map<string, number>();
      timeTrackingData?.forEach(entry => {
        const projectId = budgetItemsMap.get(entry.budget_item_id);
        if (projectId && entry.actual_start_time && entry.actual_end_time) {
          const hours = calculateSafeHours(entry.actual_start_time, entry.actual_end_time);
          const userHourlyRate = profileHourlyRateMap.get(entry.user_id) || 0;
          const cost = hours * (userHourlyRate + overheadsAmount);
          const currentCost = confirmedCostsMap.get(projectId) || 0;
          confirmedCostsMap.set(projectId, currentCost + cost);
        }
      });

      // Get unique user IDs for both user_id, account_user_id, and assigned_user_id
      const userIds = [...new Set([...(projectsData?.map(p => p.user_id).filter(Boolean) || []), ...(projectsData?.map(p => p.account_user_id).filter(Boolean) || []), ...(projectsData?.map(p => (p as any).assigned_user_id).filter(Boolean) || [])])];

      // Fetch profiles for all users
      const {
        data: profilesData,
        error: profilesError
      } = await supabase.from('profiles').select('id, first_name, last_name').in('id', userIds);
      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profilesMap = new Map(profilesData?.map(p => [p.id, {
        first_name: p.first_name,
        last_name: p.last_name
      }]) || []);

      // Merge projects with profiles, quotes, and margin calculations
      return projectsData?.map(project => {
        const quoteInfo = quotesMap.get(project.id);
        const confirmedCosts = confirmedCostsMap.get(project.id) || 0;
        const marginPercentage = project.margin_percentage || 0;
        const totalBudget = project.total_budget || 0;
        
        // Budget attività (vendita) = total_budget del progetto
        const activitiesBudget = totalBudget;
        
        // Target budget = budget disponibile dopo aver tolto il margine
        const targetBudget = activitiesBudget * (1 - marginPercentage / 100);
        
        // Costi esterni (prodotti)
        const externalCosts = externalCostsMap.get(project.id) || 0;
        
        // Marginalità residua = (Budget attività - Costi confermati - Costi esterni) / Budget attività * 100
        const remainingBudget = activitiesBudget - confirmedCosts - externalCosts;
        const residualMargin = activitiesBudget > 0 ? (remainingBudget / activitiesBudget) * 100 : 0;
        
        return {
          ...project,
          profiles: profilesMap.get(project.user_id) || null,
          account_profiles: project.account_user_id ? profilesMap.get(project.account_user_id) || null : null,
          assigned_profiles: (project as any).assigned_user_id ? profilesMap.get((project as any).assigned_user_id) || null : null,
          hasQuote: !!quoteInfo,
          quoteStatus: quoteInfo?.status,
          quoteId: quoteInfo?.id,
          quoteNumber: quoteInfo?.quoteNumber,
          confirmedCosts,
          targetBudget,
          residualMargin
        };
      }) as ProjectWithDetails[] || [];
    }
  });
  const handleProjectCreated = () => {
    refetch();
    setIsCreateDialogOpen(false);
  };
  const handleDelete = async (e: React.MouseEvent, budgetId: string) => {
    e.stopPropagation(); // Prevent row click navigation

    if (!confirm('Sei sicuro di voler eliminare questo budget? Il progetto associato (se esiste) non verrà eliminato.')) {
      return;
    }
    setDeletingId(budgetId);
    try {
      // Delete from budgets table - budget_items will be cascade deleted
      const { error } = await supabase.from('budgets').delete().eq('id', budgetId);
      if (error) throw error;
      toast({
        title: 'Budget eliminato',
        description: 'Il budget è stato eliminato con successo. Il progetto associato rimane intatto.'
      });
      refetch();
    } catch (error) {
      console.error('Error deleting budget:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante l\'eliminazione del budget.',
        variant: 'destructive'
      });
    } finally {
      setDeletingId(null);
    }
  };
  
  const handleBulkDelete = async () => {
    if (selectedBudgets.size === 0) return;
    
    if (!confirm(`Sei sicuro di voler eliminare ${selectedBudgets.size} budget? I progetti associati non verranno eliminati.`)) {
      return;
    }
    
    setIsBulkDeleting(true);
    try {
      const budgetIds = Array.from(selectedBudgets);
      const { error } = await supabase
        .from('budgets')
        .delete()
        .in('id', budgetIds);
      
      if (error) throw error;
      
      toast({
        title: 'Budget eliminati',
        description: `${budgetIds.length} budget sono stati eliminati con successo.`
      });
      
      setSelectedBudgets(new Set());
      refetch();
    } catch (error) {
      console.error('Error bulk deleting budgets:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante l\'eliminazione dei budget.',
        variant: 'destructive'
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };
  
  const toggleBudgetSelection = (budgetId: string) => {
    setSelectedBudgets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(budgetId)) {
        newSet.delete(budgetId);
      } else {
        newSet.add(budgetId);
      }
      return newSet;
    });
  };
  
  const toggleAllBudgets = () => {
    if (selectedBudgets.size === paginatedProjects.length) {
      setSelectedBudgets(new Set());
    } else {
      setSelectedBudgets(new Set(paginatedProjects.map(p => p.id)));
    }
  };
  
  const handleDuplicate = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Prevent row click navigation

    setDuplicatingId(projectId);
    try {
      // Get the original budget
      const {
        data: originalBudget,
        error: fetchError
      } = await supabase.from('budgets').select('*').eq('id', projectId).single();
      if (fetchError) throw fetchError;

      // Create the duplicated budget
      const {
        data: newBudget,
        error: createError
      } = await supabase.from('budgets').insert([{
        name: `${originalBudget.name} (duplicato)`,
        description: originalBudget.description,
        project_type: originalBudget.project_type,
        client_id: originalBudget.client_id,
        account_user_id: originalBudget.account_user_id,
        user_id: currentUserId,
        status: 'in_attesa',
        total_budget: 0,
        total_hours: 0
      }]).select().single();
      if (createError) throw createError;

      // Get all budget items from the original budget
      const {
        data: budgetItems,
        error: itemsError
      } = await supabase.from('budget_items').select('*').or(`budget_id.eq.${projectId},project_id.eq.${projectId}`);
      if (itemsError) throw itemsError;

      // Duplicate budget items if any exist
      if (budgetItems && budgetItems.length > 0) {
        const duplicatedItems = budgetItems.map(item => ({
          budget_id: newBudget.id,
          project_id: newBudget.id, // Keep for backward compatibility
          category: item.category,
          activity_name: item.activity_name,
          assignee_id: item.assignee_id,
          assignee_name: item.assignee_name,
          hourly_rate: item.hourly_rate,
          hours_worked: item.hours_worked,
          total_cost: item.total_cost,
          is_custom_activity: item.is_custom_activity,
          display_order: item.display_order
        }));
        const {
          error: insertItemsError
        } = await supabase.from('budget_items').insert(duplicatedItems);
        if (insertItemsError) throw insertItemsError;

        // Update budget totals
        const totalBudget = budgetItems.reduce((sum, item) => sum + item.total_cost, 0);
        const totalHours = budgetItems.reduce((sum, item) => sum + item.hours_worked, 0);
        await supabase.from('budgets').update({
          total_budget: totalBudget,
          total_hours: totalHours
        }).eq('id', newBudget.id);
      }
      toast({
        title: 'Budget duplicato',
        description: 'Il budget è stato duplicato con successo.'
      });
      refetch();
    } catch (error) {
      console.error('Error duplicating project:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante la duplicazione del budget.',
        variant: 'destructive'
      });
    } finally {
      setDuplicatingId(null);
    }
  };
  const handleUpdateName = async (projectId: string, newName: string) => {
    if (!newName.trim()) {
      toast({
        title: 'Errore',
        description: 'Il nome del budget non può essere vuoto.',
        variant: 'destructive'
      });
      return;
    }
    const {
      error
    } = await supabase.from('budgets').update({
      name: newName
    }).eq('id', projectId);
    if (error) {
      toast({
        title: 'Errore',
        description: 'Errore durante l\'aggiornamento del nome.',
        variant: 'destructive'
      });
      return;
    }
    toast({
      title: 'Nome aggiornato',
      description: 'Il nome del budget è stato aggiornato con successo.'
    });
    setEditingProjectId(null);
    setEditingField(null);
    // Invalidate budget detail cache
    queryClient.invalidateQueries({ queryKey: ['budget', projectId] });
    refetch();
  };
  const handleUpdateClient = async (projectId: string, clientId: string) => {
    const {
      error
    } = await supabase.from('budgets').update({
      client_id: clientId
    }).eq('id', projectId);
    if (error) {
      toast({
        title: 'Errore',
        description: 'Errore durante l\'aggiornamento del cliente.',
        variant: 'destructive'
      });
      return;
    }
    toast({
      title: 'Cliente aggiornato',
      description: 'Il cliente è stato aggiornato con successo.'
    });
    setEditingProjectId(null);
    setEditingField(null);
    // Invalidate budget detail cache
    queryClient.invalidateQueries({ queryKey: ['budget', projectId] });
    refetch();
  };
  const handleUpdateAccount = async (projectId: string, accountId: string) => {
    const {
      error
    } = await supabase.from('budgets').update({
      account_user_id: accountId
    }).eq('id', projectId);
    if (error) {
      toast({
        title: 'Errore',
        description: 'Errore durante l\'aggiornamento dell\'account.',
        variant: 'destructive'
      });
      return;
    }
    toast({
      title: 'Account aggiornato',
      description: 'L\'account è stato aggiornato con successo.'
    });
    setEditingProjectId(null);
    setEditingField(null);
    // Invalidate budget detail cache
    queryClient.invalidateQueries({ queryKey: ['budget', projectId] });
    refetch();
  };
  const handleUpdateStatus = async (projectId: string, newStatus: string) => {
    const { error } = await supabase
      .from('budgets')
      .update({ status: newStatus as 'bozza' | 'in_attesa' | 'in_revisione' | 'approvato' | 'rifiutato' })
      .eq('id', projectId);
    if (error) {
      toast({
        title: 'Errore',
        description: 'Errore durante l\'aggiornamento dello stato.',
        variant: 'destructive'
      });
      return;
    }

    // If status changed to approved, generate quote if not exists
    if (newStatus === 'approvato') {
      // Check if quote already exists
      const { data: existingQuote } = await supabase
        .from('quotes')
        .select('id')
        .eq('budget_id', projectId)
        .maybeSingle();
      
      if (!existingQuote) {
        // Import and use the quote generation logic
        const { generateQuoteForBudget } = await import('@/lib/generateQuoteForBudget');
        await generateQuoteForBudget(projectId, toast);
      }
    }

    toast({
      title: 'Stato aggiornato',
      description: 'Lo stato del budget è stato aggiornato con successo.'
    });
    setEditingProjectId(null);
    setEditingField(null);
    // Invalidate budget detail cache
    queryClient.invalidateQueries({ queryKey: ['budget', projectId] });
    refetch();
  };
  const startEditing = (projectId: string, field: 'name' | 'client' | 'account' | 'status', currentName?: string) => {
    setEditingProjectId(projectId);
    setEditingField(field);
    if (field === 'name' && currentName) {
      setEditedName(currentName);
    }
  };
  const cancelEditing = () => {
    setEditingProjectId(null);
    setEditingField(null);
    setEditedName('');
  };
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get unique values for filters
  const uniqueClients = [...new Set(projects.map(p => p.clients?.name).filter(Boolean))].sort();
  const uniqueAccounts = [...new Set(projects.map(p => p.account_profiles ? `${p.account_profiles.first_name} ${p.account_profiles.last_name}`.trim() : null).filter(Boolean))].sort();

  // Filter and sort projects
  const filteredProjects = projects.filter(project => {
    // Archive filter: separate archived (quote approved) from active
    const isArchived = project.quoteStatus === 'approved';
    if (showArchived !== isArchived) {
      return false;
    }
    // My budgets filter
    if (showOnlyMyBudgets && project.user_id !== currentUserId) {
      return false;
    }
    // Search filter - search in project name and client name
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const projectName = project.name?.toLowerCase() || '';
      const clientName = project.clients?.name?.toLowerCase() || '';
      if (!projectName.includes(query) && !clientName.includes(query)) {
        return false;
      }
    }
    // Client filter
    if (selectedClient !== 'all' && project.clients?.name !== selectedClient) {
      return false;
    }
    // Account filter
    if (selectedAccount !== 'all') {
      const accountName = project.account_profiles ? `${project.account_profiles.first_name} ${project.account_profiles.last_name}`.trim() : null;
      if (accountName !== selectedAccount) {
        return false;
      }
    }
    // Quote filter
    if (selectedQuoteFilter === 'with_quote' && !project.hasQuote) {
      return false;
    }
    if (selectedQuoteFilter === 'without_quote' && project.hasQuote) {
      return false;
    }
    // Status filter (budget status)
    if (selectedStatusFilter !== 'all' && project.status !== selectedStatusFilter) {
      return false;
    }
    // Project status filter
    if (selectedProjectStatusFilter !== 'all' && project.project_status !== selectedProjectStatusFilter) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (!sortField) return 0;
    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'client':
        const clientA = a.clients?.name || '';
        const clientB = b.clients?.name || '';
        comparison = clientA.localeCompare(clientB);
        break;
      case 'owner':
        const ownerA = a.profiles ? `${a.profiles.first_name} ${a.profiles.last_name}` : '';
        const ownerB = b.profiles ? `${b.profiles.first_name} ${b.profiles.last_name}` : '';
        comparison = ownerA.localeCompare(ownerB);
        break;
      case 'account':
        const accountA = a.account_profiles ? `${a.account_profiles.first_name} ${a.account_profiles.last_name}` : '';
        const accountB = b.account_profiles ? `${b.account_profiles.first_name} ${b.account_profiles.last_name}` : '';
        comparison = accountA.localeCompare(accountB);
        break;
      case 'amount':
        comparison = a.total_budget - b.total_budget;
        break;
      case 'created':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE);
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProjects.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProjects, currentPage]);
  if (isLoading) {
    return <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>;
  }
  return <div className="page-container stack-lg">
      <div className="page-header">
        <h1 className="page-title">Budget</h1>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cerca budget per nome..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-2">
            <Button 
              variant={showArchived ? "default" : "outline"} 
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive className="h-4 w-4 mr-2" />
              {showArchived ? 'Budget Attivi' : 'Archivio'}
            </Button>
            {hasPermission(userRole, 'canViewAllProjects') && <Button 
              variant={showOnlyMyBudgets ? "default" : "outline"} 
              onClick={() => setShowOnlyMyBudgets(!showOnlyMyBudgets)}
            >
                <Users className="h-4 w-4 mr-2" />
                {showOnlyMyBudgets ? 'Tutti i Budget' : 'I Miei Budget'}
              </Button>}
            {hasPermission(userRole, 'canCreateProjects') && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuovo budget
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtra per cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i clienti</SelectItem>
              {uniqueClients.map(client => <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtra per account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli account</SelectItem>
              {uniqueAccounts.map(account => <SelectItem key={account} value={account}>
                  {account}
                </SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedQuoteFilter} onValueChange={setSelectedQuoteFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtra per preventivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="with_quote">Con preventivo</SelectItem>
              <SelectItem value="without_quote">Senza preventivo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Stato budget" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati budget</SelectItem>
              <SelectItem value="bozza">Bozza</SelectItem>
              <SelectItem value="in_attesa">In Attesa</SelectItem>
              <SelectItem value="in_revisione">In Revisione</SelectItem>
              <SelectItem value="approvato">Approvato</SelectItem>
              <SelectItem value="rifiutato">Rifiutato</SelectItem>
            </SelectContent>
          </Select>

          {selectedBudgets.size > 0 && hasPermission(userRole, 'canEditProjects') && userRole !== 'coordinator' && (
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Elimina ({selectedBudgets.size})
            </Button>
          )}
        </div>
      </div>

      <Card variant="static">
        <CardContent variant="table">
          <Table>
            <TableHeader>
              <TableRow>
                {hasPermission(userRole, 'canEditProjects') && userRole !== 'coordinator' && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={paginatedProjects.length > 0 && selectedBudgets.size === paginatedProjects.length}
                      onCheckedChange={toggleAllBudgets}
                      aria-label="Seleziona tutti"
                    />
                  </TableHead>
                )}
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('name')} className="h-8 px-2 lg:px-3">
                    Nome Budget
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('client')} className="h-8 px-2 lg:px-3">
                    Cliente
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('owner')} className="h-8 px-2 lg:px-3">
                    Proprietario
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  Assegnato a
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('account')} className="h-8 px-2 lg:px-3">
                    Account
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('created')} className="h-8 px-2 lg:px-3">
                    Data creazione
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" onClick={() => handleSort('amount')} className="h-8 px-2 lg:px-3">
                    Importo
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Stato Budget</TableHead>
                <TableHead>Preventivo</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProjects.length === 0 ? <TableRow>
                  <TableCell colSpan={hasPermission(userRole, 'canEditProjects') && userRole !== 'coordinator' ? 11 : 10} className="text-center text-muted-foreground py-8">
                    {searchQuery || selectedClient !== 'all' || selectedAccount !== 'all' || selectedQuoteFilter !== 'all' || selectedStatusFilter !== 'all' || selectedProjectStatusFilter !== 'all' || showOnlyMyBudgets ? 'Nessun budget trovato con i filtri applicati' : 'Nessun budget trovato'}
                  </TableCell>
                </TableRow> : paginatedProjects.map(project => {
              const creatorName = project.profiles ? `${project.profiles.first_name} ${project.profiles.last_name}`.trim() : 'Utente sconosciuto';
              const accountName = project.account_profiles ? `${project.account_profiles.first_name} ${project.account_profiles.last_name}`.trim() : '-';
              const canEdit = project.user_id === currentUserId || hasPermission(userRole, 'canEditProjects');
              const canEditStatus = hasPermission(userRole, 'canChangeProjectStatus');
              const isEditingName = editingProjectId === project.id && editingField === 'name';
              const isEditingClient = editingProjectId === project.id && editingField === 'client';
              const isEditingAccount = editingProjectId === project.id && editingField === 'account';
              const isEditingStatus = editingProjectId === project.id && editingField === 'status';
              
              return <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50 group" onClick={() => {
                if (!editingProjectId) navigate(`/projects/${project.id}`);
              }}>
                      {hasPermission(userRole, 'canEditProjects') && userRole !== 'coordinator' && (
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedBudgets.has(project.id)}
                            onCheckedChange={() => toggleBudgetSelection(project.id)}
                            aria-label={`Seleziona ${project.name}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium" onClick={e => {
                  if (isEditingName || isEditingClient || isEditingAccount || isEditingStatus) {
                    e.stopPropagation();
                  }
                }}>
                        {isEditingName ? <div className="flex items-center gap-2">
                            <Input value={editedName} onChange={e => setEditedName(e.target.value)} className="h-8 min-w-[200px] w-full" autoFocus onKeyDown={e => {
                      if (e.key === 'Enter') handleUpdateName(project.id, editedName);
                      if (e.key === 'Escape') cancelEditing();
                    }} />
                            <Button size="sm" variant="ghost" onClick={() => handleUpdateName(project.id, editedName)}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEditing}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div> : <div className="flex items-center gap-2 group/name">
                            <TableNameCell
                              name={project.name}
                              href={`/projects/${project.id}`}
                              onClick={() => navigate(`/projects/${project.id}`)}
                            />
                            {canEdit && <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover/name:opacity-100" onClick={e => {
                      e.stopPropagation();
                      startEditing(project.id, 'name', project.name);
                    }}>
                                <Edit className="h-3 w-3" />
                              </Button>}
                          </div>}
                      </TableCell>
                      <TableCell onClick={e => {
                  if (isEditingName || isEditingClient || isEditingAccount) {
                    e.stopPropagation();
                  }
                }}>
                        {isEditingClient ? <div className="flex items-center gap-2">
                            <Select value={project.client_id || ''} onValueChange={value => handleUpdateClient(project.id, value)}>
                              <SelectTrigger className="h-8 w-[150px]">
                                <SelectValue placeholder="Seleziona" />
                              </SelectTrigger>
                              <SelectContent>
                                {clients.map(client => <SelectItem key={client.id} value={client.id}>
                                    {client.name}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="ghost" onClick={e => {
                      e.stopPropagation();
                      cancelEditing();
                    }}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div> : <div className="flex items-center gap-2 group/client">
                            <span>{project.clients?.name || '-'}</span>
                            {canEdit && <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover/client:opacity-100" onClick={e => {
                      e.stopPropagation();
                      startEditing(project.id, 'client');
                    }}>
                                <Edit className="h-3 w-3" />
                              </Button>}
                          </div>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {creatorName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {project.assigned_profiles 
                          ? `${project.assigned_profiles.first_name} ${project.assigned_profiles.last_name}`.trim() 
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" onClick={e => {
                  if (isEditingName || isEditingClient || isEditingAccount) {
                    e.stopPropagation();
                  }
                }}>
                        {isEditingAccount ? <div className="flex items-center gap-2">
                            <Select value={project.account_user_id || ''} onValueChange={value => handleUpdateAccount(project.id, value)}>
                              <SelectTrigger className="h-8 w-[150px]">
                                <SelectValue placeholder="Seleziona" />
                              </SelectTrigger>
                              <SelectContent>
                                {users.map(user => <SelectItem key={user.id} value={user.id}>
                                    {user.first_name} {user.last_name}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="ghost" onClick={e => {
                      e.stopPropagation();
                      cancelEditing();
                    }}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div> : <div className="flex items-center gap-2 group/account">
                            <span>{accountName}</span>
                            {canEdit && <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover/account:opacity-100" onClick={e => {
                      e.stopPropagation();
                      startEditing(project.id, 'account');
                    }}>
                                <Edit className="h-3 w-3" />
                              </Button>}
                          </div>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(project.created_at).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {project.total_budget.toFixed(2)} €
                      </TableCell>
                      <TableCell onClick={e => {
                        if (isEditingStatus) e.stopPropagation();
                      }}>
                        {isEditingStatus ? (
                          <div className="flex items-center gap-2">
                            <Select value={project.status} onValueChange={value => handleUpdateStatus(project.id, value)}>
                              <SelectTrigger className="h-8 w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bozza">Bozza</SelectItem>
                                <SelectItem value="in_attesa">In Attesa</SelectItem>
                                <SelectItem value="in_revisione">In Revisione</SelectItem>
                                <SelectItem value="approvato">Approvato</SelectItem>
                                <SelectItem value="rifiutato">Rifiutato</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="ghost" onClick={e => {
                              e.stopPropagation();
                              cancelEditing();
                            }}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/status">
                            <Badge variant={
                              project.status === 'approvato' ? 'default' : 
                              project.status === 'rifiutato' ? 'destructive' : 
                              project.status === 'in_revisione' ? 'default' :
                              project.status === 'bozza' ? 'outline' :
                              'secondary'
                            } className={
                              project.status === 'in_revisione' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                              project.status === 'bozza' ? 'border-muted-foreground/40 text-muted-foreground' :
                              project.status === 'approvato' ? 'bg-green-600 hover:bg-green-700 text-white' :
                              ''
                            }>
                              {project.status === 'bozza' ? 'Bozza' :
                               project.status === 'in_attesa' ? 'In Attesa' : 
                               project.status === 'in_revisione' ? 'In Revisione' :
                               project.status === 'approvato' ? 'Approvato' : 'Rifiutato'}
                            </Badge>
                            {canEditStatus && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0 opacity-0 group-hover/status:opacity-100" 
                                onClick={e => {
                                  e.stopPropagation();
                                  startEditing(project.id, 'status');
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {project.hasQuote ? (
                          <span 
                            className="text-primary hover:underline cursor-pointer font-medium"
                            onClick={e => {
                              e.stopPropagation();
                              if (project.quoteId) {
                                navigate(`/quotes/${project.quoteId}`);
                              }
                            }}
                          >
                            {project.quoteNumber}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={e => {
                              e.stopPropagation();
                              navigate(`/projects/${project.id}`);
                            }}>
                              <FileText className="h-4 w-4 mr-2" />
                              Vai al Budget
                            </DropdownMenuItem>
                            {(hasPermission(userRole, 'canEditProjects') || userRole === 'account') && userRole !== 'coordinator' && (
                              <DropdownMenuItem onClick={e => handleDuplicate(e, project.id)} disabled={duplicatingId === project.id}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplica
                              </DropdownMenuItem>
                            )}
                            {(hasPermission(userRole, 'canDeleteProjects') || userRole === 'account') && userRole !== 'coordinator' && (
                              <DropdownMenuItem onClick={e => handleDelete(e, project.id)} disabled={deletingId === project.id} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Elimina
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>;
            })}
            </TableBody>
          </Table>
          
          {totalPages > 1 && (
            <div className="mt-4 px-6 pb-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Totale: {filteredProjects.length} {filteredProjects.length === 1 ? 'budget' : 'budget'}
                </p>
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {[...Array(totalPages)].map((_, i) => {
                    const page = i + 1;
                    if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <PaginationEllipsis key={page} />;
                    }
                    return null;
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateProjectDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} onProjectCreated={handleProjectCreated} />
    </div>;
};
export default Index;
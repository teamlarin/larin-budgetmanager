import { useState, useEffect, useMemo } from 'react';
import { disciplineLabels } from '@/lib/constants';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Calculator, BarChart3, MoreVertical, Check, X, ArrowUpDown, ArrowUp, ArrowDown, Plus, Trash2, Upload, AlertTriangle, AlertCircle, ChevronLeft, ChevronRight, Download, Clock, Flag, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CircularProgress } from '@/components/ui/circular-progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Project } from '@/types/project';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CreateManualProjectDialog } from '@/components/CreateManualProjectDialog';
import { ProjectImport } from '@/components/ProjectImport';
import { hasPermission } from '@/lib/permissions';
import { format, differenceInCalendarDays } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import * as XLSX from 'xlsx';
import { TableNameCell } from '@/components/ui/table-name-cell';
import { ProgressUpdateDialog } from '@/components/ProgressUpdateDialog';
type ProjectWithDetails = Project & {
  profiles: {
    first_name: string;
    last_name: string;
  } | null;
  account_profiles: {
    first_name: string;
    last_name: string;
  } | null;
  project_leader: {
    first_name: string;
    last_name: string;
  } | null;
  quote_number?: string;
  confirmedCosts?: number;
  targetBudget?: number;
  residualMargin?: number;
  laborCost?: number;
  externalCost?: number;
  hasBudget?: boolean;
  teamMembers?: string[];
};
const ApprovedProjects = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('ap_search') || '');
  const [selectedArea, setSelectedArea] = useState<string>(() => sessionStorage.getItem('ap_area') || 'all');
  const [selectedAccount, setSelectedAccount] = useState<string>(() => sessionStorage.getItem('ap_account') || 'all');
  const [selectedProjectLeader, setSelectedProjectLeader] = useState<string>(() => sessionStorage.getItem('ap_leader') || 'all');
  const [selectedProjectStatus, setSelectedProjectStatus] = useState<string>(() => sessionStorage.getItem('ap_status') || 'aperto');
  const [userRole, setUserRole] = useState<'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member' | null>(null);
  const [editingField, setEditingField] = useState<{
    projectId: string;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [sortField, setSortField] = useState<string | null>(() => sessionStorage.getItem('ap_sortField') || 'name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => (sessionStorage.getItem('ap_sortDir') as 'asc' | 'desc') || 'asc');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(() => parseInt(sessionStorage.getItem('ap_page') || '1', 10));

  // Persist filters to sessionStorage
  useEffect(() => { sessionStorage.setItem('ap_search', searchQuery); }, [searchQuery]);
  useEffect(() => { sessionStorage.setItem('ap_area', selectedArea); }, [selectedArea]);
  useEffect(() => { sessionStorage.setItem('ap_account', selectedAccount); }, [selectedAccount]);
  useEffect(() => { sessionStorage.setItem('ap_leader', selectedProjectLeader); }, [selectedProjectLeader]);
  useEffect(() => { sessionStorage.setItem('ap_status', selectedProjectStatus); }, [selectedProjectStatus]);
  useEffect(() => { sessionStorage.setItem('ap_sortField', sortField || ''); }, [sortField]);
  useEffect(() => { sessionStorage.setItem('ap_sortDir', sortDirection); }, [sortDirection]);
  useEffect(() => { sessionStorage.setItem('ap_page', String(currentPage)); }, [currentPage]);
  const [progressDialogProject, setProgressDialogProject] = useState<{ id: string; name: string; progress: number; clientName?: string; projectLeaderId?: string | null; accountUserId?: string | null } | null>(null);
  const [showOnlyCritical, setShowOnlyCritical] = useState(false);
  const [alertDialogType, setAlertDialogType] = useState<'deadline' | 'margin' | 'closing' | null>(null);
  const itemsPerPage = 50;
  useEffect(() => {
    supabase.auth.getUser().then(async ({
      data
    }) => {
      setCurrentUserId(data.user?.id || null);
      if (data.user) {
        const {
          data: roleData
        } = await supabase.from('user_roles').select('role').eq('user_id', data.user.id).maybeSingle();
        const role = roleData?.role as 'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null;
        setUserRole(role);
      }
    });
  }, []);
  const {
    data: allProjects = [],
    isLoading,
    refetch
  } = useQuery<ProjectWithDetails[]>({
    queryKey: ['approved-projects', currentUserId, userRole, 'v5'], // v5: Uses edge function for margin calculation
    queryFn: async () => {
      // RLS policies handle project visibility per role
      // Members only see assigned projects, others see all
      const {
        data: projectsData,
        error: projectsError
      } = await supabase.from('projects').select('*, clients(name)').eq('status', 'approvato').order('created_at', {
        ascending: false
      });
      if (projectsError) throw projectsError;

      const projectIds = projectsData?.map(p => p.id) || [];

      // Fetch margins from edge function (uses service role to bypass RLS)
      let marginsData: Record<string, { 
        residualMargin: number; 
        laborCost: number; 
        externalCost: number; 
        totalCost: number;
        budget: number;
        targetBudget: number;
        confirmedHours: number;
        totalHours: number;
        projectType: string;
      }> = {};
      
      try {
        const { data: marginsResponse, error: marginsError } = await supabase.functions.invoke('calculate-project-margins', {
          body: { project_ids: projectIds }
        });
        
        if (marginsError) {
          console.error('Error fetching margins from edge function:', marginsError);
        } else {
          marginsData = marginsResponse?.margins || {};
        }
      } catch (error) {
        console.error('Error invoking calculate-project-margins:', error);
      }

      const userIds = [...new Set([
        ...(projectsData?.map(p => p.user_id).filter(Boolean) || []), 
        ...(projectsData?.map(p => p.account_user_id).filter(Boolean) || []),
        ...(projectsData?.map(p => p.project_leader_id).filter(Boolean) || [])
      ])];
      const {
        data: profilesData,
        error: profilesError
      } = await supabase.from('profiles').select('id, first_name, last_name').in('id', userIds);
      if (profilesError) throw profilesError;
      const profilesMap = new Map(profilesData?.map(p => [p.id, {
        first_name: p.first_name || '',
        last_name: p.last_name || ''
      }]) || []);

      const {
        data: quotesData
      } = await supabase.from('quotes').select('project_id, quote_number').in('project_id', projectIds).eq('status', 'approved');
      const quotesMap = new Map(quotesData?.map(q => [q.project_id, q.quote_number]) || []);

      // Check which projects have a linked budget
      const {
        data: budgetsData
      } = await supabase.from('budgets').select('project_id').in('project_id', projectIds);
      const projectsWithBudget = new Set(budgetsData?.map(b => b.project_id) || []);

      // Fetch project members for all projects
      const { data: membersData } = await supabase
        .from('project_members')
        .select('project_id, user_id')
        .in('project_id', projectIds);
      
      // Get unique member user IDs not already in profilesMap
      const memberUserIds = [...new Set(membersData?.map(m => m.user_id) || [])].filter(id => !profilesMap.has(id));
      if (memberUserIds.length > 0) {
        const { data: memberProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', memberUserIds);
        memberProfiles?.forEach(p => profilesMap.set(p.id, { first_name: p.first_name || '', last_name: p.last_name || '' }));
      }
      
      // Build a map of project_id -> team member names
      const teamMembersMap = new Map<string, string[]>();
      membersData?.forEach(m => {
        const profile = profilesMap.get(m.user_id);
        if (profile) {
          const name = `${profile.first_name} ${profile.last_name}`.trim();
          if (name) {
            const existing = teamMembersMap.get(m.project_id) || [];
            existing.push(name);
            teamMembersMap.set(m.project_id, existing);
          }
        }
      });

      return projectsData?.map(project => {
        const margins = marginsData[project.id];
        const confirmedCosts = margins?.totalCost || 0;
        const targetBudget = margins?.targetBudget || (project.total_budget || 0) * (1 - (project.margin_percentage || 0) / 100);
        const residualMargin = margins?.residualMargin ?? 100;
        const laborCost = margins?.laborCost || 0;
        const externalCost = margins?.externalCost || 0;
        
        // Per progetti "pack", calcola automaticamente il progresso come (ore confermate / ore totali) × 100
        // Può superare 100% per segnalare sforamento
        let calculatedProgress = project.progress || 0;
        if (project.project_type?.toLowerCase().includes('pack') && margins?.totalHours && margins.totalHours > 0) {
          calculatedProgress = Math.round((margins.confirmedHours / margins.totalHours) * 100);
        }

        return {
          ...project,
          profiles: profilesMap.get(project.user_id) || null,
          account_profiles: project.account_user_id ? profilesMap.get(project.account_user_id) || null : null,
          project_leader: project.project_leader_id ? profilesMap.get(project.project_leader_id) || null : null,
          quote_number: quotesMap.get(project.id),
          confirmedCosts,
          targetBudget,
          residualMargin,
          laborCost,
          externalCost,
          progress: calculatedProgress,
          hasBudget: projectsWithBudget.has(project.id),
          teamMembers: teamMembersMap.get(project.id) || []
        };
      }) as ProjectWithDetails[] || [];
    },
    enabled: !!currentUserId
  });
  // Filter out completed projects for filter counts
  const activeProjects = allProjects.filter(p => p.project_status !== 'completato');
  
  // Deduplicate areas by normalizing case (capitalize first letter) with count
  const normalizeArea = (area: string) => area.charAt(0).toUpperCase() + area.slice(1).toLowerCase();
  
  // Build areas with project count (excluding completed)
  const areasWithCount = activeProjects.reduce((acc, p) => {
    if (p.area) {
      const normalizedArea = normalizeArea(p.area);
      acc[normalizedArea] = (acc[normalizedArea] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  const sortedAreas = Object.entries(areasWithCount).sort((a, b) => a[0].localeCompare(b[0]));
  
  // Build accounts with project count (excluding completed)
  const accountsWithCount = activeProjects.reduce((acc, p) => {
    if (p.account_profiles) {
      const name = `${p.account_profiles.first_name} ${p.account_profiles.last_name}`.trim();
      if (name) {
        acc[name] = (acc[name] || 0) + 1;
      }
    }
    return acc;
  }, {} as Record<string, number>);
  
  // Build project leaders with project count (excluding completed)
  const leadersWithCount = activeProjects.reduce((acc, p) => {
    if (p.project_leader) {
      const name = `${p.project_leader.first_name} ${p.project_leader.last_name}`.trim();
      if (name) {
        acc[name] = (acc[name] || 0) + 1;
      }
    }
    return acc;
  }, {} as Record<string, number>);

  const sortedAccounts = Object.entries(accountsWithCount).sort((a, b) => a[0].localeCompare(b[0]));
  const sortedLeaders = Object.entries(leadersWithCount).sort((a, b) => a[0].localeCompare(b[0]));

  // Build project status with count (include all projects for status filter)
  const statusLabels: Record<string, string> = {
    'in_partenza': 'In Partenza',
    'aperto': 'Aperto',
    'da_fatturare': 'Da Fatturare',
    'completato': 'Completato'
  };
  
  const statusWithCount = allProjects.reduce((acc, p) => {
    if (p.project_status) {
      acc[p.project_status] = (acc[p.project_status] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const statusOrder = ['in_partenza', 'aperto', 'da_fatturare', 'completato'];
  const sortedStatuses = statusOrder
    .filter(status => statusWithCount[status] !== undefined)
    .map(status => [status, statusWithCount[status]] as [string, number]);

  const getDisplayProgress = (p: ProjectWithDetails): number => {
    const billingType = (p as any).billing_type;
    if (billingType === 'interno' || billingType === 'consumptive') return -1;
    if (billingType === 'recurring' && p.start_date && p.end_date) {
      const today = new Date();
      const start = new Date(p.start_date);
      const end = new Date(p.end_date);
      const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const daysElapsed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return Math.min(100, Math.max(0, Math.round((daysElapsed / totalDays) * 100)));
    }
    return Number(p.progress || 0);
  };

  // Classification helpers for alert indicators
  const classifyProject = (p: ProjectWithDetails) => {
    const today = new Date();
    const endDate = p.end_date ? new Date(p.end_date) : null;
    const daysToEnd = endDate ? differenceInCalendarDays(endDate, today) : null;
    
    const isOpenStatus = p.project_status === 'aperto' || p.project_status === 'da_fatturare';
    const deadlineCritical = isOpenStatus && daysToEnd !== null && daysToEnd >= 0 && daysToEnd <= 7;
    
    const billingType = p.billing_type;
    const isInterno = billingType === 'interno';
    const isPreSales = billingType === 'pre_sales';
    const isConsumptive = billingType === 'consumptive';
    const isNoBudgetType = isInterno || isPreSales || isConsumptive;
    
    const residualMargin = p.residualMargin || 0;
    const targetMargin = p.margin_percentage || 0;
    const isNegativeMargin = residualMargin < 0;
    // Escludi progetti senza budget dal calcolo margine critico
    const marginCritical = !isNoBudgetType && (isNegativeMargin || (targetMargin > 0 && residualMargin <= targetMargin));
    
    const displayProgress = getDisplayProgress(p);
    const isClosing = !isInterno && !isConsumptive && displayProgress >= 85 && p.project_status !== 'completato';
    
    const hasCriticalIndicator = deadlineCritical || marginCritical || isClosing;
    
    return { deadlineCritical, marginCritical, isClosing, hasCriticalIndicator, daysToEnd };
  };

  // Memoize alert counts from active (non-completed) projects
  const alertStats = useMemo(() => {
    const active = allProjects.filter(p => p.project_status !== 'completato');
    const deadlineProjects: ProjectWithDetails[] = [];
    const marginProjects: ProjectWithDetails[] = [];
    const closingProjects: ProjectWithDetails[] = [];
    
    active.forEach(p => {
      const c = classifyProject(p);
      if (c.deadlineCritical) deadlineProjects.push(p);
      if (c.marginCritical) marginProjects.push(p);
      if (c.isClosing) closingProjects.push(p);
    });
    
    return { deadlineProjects, marginProjects, closingProjects };
  }, [allProjects]);
  const projects = allProjects.filter(project => {
    // Filter by "solo critici" toggle
    if (showOnlyCritical) {
      const c = classifyProject(project);
      if (!c.hasCriticalIndicator) return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const projectName = project.name?.toLowerCase() || '';
      const clientName = project.clients?.name?.toLowerCase() || '';
      const accountName = project.account_profiles 
        ? `${project.account_profiles.first_name} ${project.account_profiles.last_name}`.toLowerCase() 
        : '';
      const leaderName = project.project_leader 
        ? `${project.project_leader.first_name} ${project.project_leader.last_name}`.toLowerCase() 
        : '';
      
      const matchesSearch = projectName.includes(query) || 
                           clientName.includes(query) || 
                           accountName.includes(query) || 
                           leaderName.includes(query);
      if (!matchesSearch) return false;
    }
    if (selectedArea !== 'all' && (!project.area || normalizeArea(project.area) !== selectedArea)) {
      return false;
    }
    if (selectedAccount !== 'all') {
      const accountName = project.account_profiles ? `${project.account_profiles.first_name} ${project.account_profiles.last_name}`.trim() : null;
      if (accountName !== selectedAccount) {
        return false;
      }
    }
    if (selectedProjectLeader !== 'all') {
      const leaderName = project.project_leader ? `${project.project_leader.first_name} ${project.project_leader.last_name}`.trim() : null;
      if (leaderName !== selectedProjectLeader) {
        return false;
      }
    }
    if (selectedProjectStatus !== 'all' && project.project_status !== selectedProjectStatus) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (!sortField) return 0;
    let aValue: any;
    let bValue: any;
    switch (sortField) {
      case 'name':
        aValue = a.name?.toLowerCase() || '';
        bValue = b.name?.toLowerCase() || '';
        break;
      case 'client':
        aValue = a.clients?.name?.toLowerCase() || '';
        bValue = b.clients?.name?.toLowerCase() || '';
        break;
      case 'budget':
        aValue = Number(a.total_budget || 0);
        bValue = Number(b.total_budget || 0);
        break;
      case 'margin':
        aValue = Number(a.residualMargin || 0);
        bValue = Number(b.residualMargin || 0);
        break;
      case 'progress':
        aValue = getDisplayProgress(a);
        bValue = getDisplayProgress(b);
        break;
      case 'end_date':
        aValue = a.end_date ? new Date(a.end_date).getTime() : 0;
        bValue = b.end_date ? new Date(b.end_date).getTime() : 0;
        break;
      case 'status':
        aValue = a.project_status?.toLowerCase() || '';
        bValue = b.project_status?.toLowerCase() || '';
        break;
      default:
        return 0;
    }
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(projects.length / itemsPerPage);
  const paginatedProjects = projects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedArea, selectedAccount, selectedProjectStatus]);
  const handleUpdateProjectStatus = async (projectId: string, newStatus: 'in_partenza' | 'aperto' | 'da_fatturare' | 'completato') => {
    try {
      const {
        error
      } = await supabase.from('projects').update({
        project_status: newStatus
      }).eq('id', projectId);
      if (error) throw error;

      // Send Slack notification when project is completed
      if (newStatus === 'completato') {
        const project = allProjects.find(p => p.id === projectId);
        if (project) {
          const leaderName = project.project_leader
            ? `${project.project_leader.first_name || ''} ${project.project_leader.last_name || ''}`.trim()
            : undefined;
          const accName = project.account_profiles
            ? `${project.account_profiles.first_name || ''} ${project.account_profiles.last_name || ''}`.trim()
            : undefined;
          const quoteNum = (project as any).manual_quote_number || project.quote_number;

          supabase.functions.invoke('send-slack-notification', {
            body: {
              type: 'project_completed',
              project_name: project.name,
              client_name: project.clients?.name,
              project_leader_name: leaderName || undefined,
              account_name: accName || undefined,
              quote_number: quoteNum || undefined,
              residual_margin: project.residualMargin,
            },
          }).then(({ error: slackErr }) => {
            if (slackErr) console.error('Slack notification error:', slackErr);
          });
        }
      }

      // Send Slack notification when project is opened (in_partenza -> aperto)
      if (newStatus === 'aperto') {
        const project = allProjects.find(p => p.id === projectId);
        if (project) {
          const leaderName = project.project_leader
            ? `${project.project_leader.first_name || ''} ${project.project_leader.last_name || ''}`.trim()
            : undefined;
          const accName = project.account_profiles
            ? `${project.account_profiles.first_name || ''} ${project.account_profiles.last_name || ''}`.trim()
            : undefined;
          const quoteNum = (project as any).manual_quote_number || project.quote_number;

          // Fetch team members for Slack notification
          const { data: teamData } = await supabase
            .from('project_members')
            .select('user_id')
            .eq('project_id', project.id);
          let teamNames: string[] = [];
          if (teamData && teamData.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .in('id', teamData.map(m => m.user_id));
            teamNames = (profiles || []).map(p => `${p.first_name || ''} ${p.last_name || ''}`.trim()).filter(Boolean);
          }

          supabase.functions.invoke('send-slack-notification', {
            body: {
              type: 'project_opened',
              project_name: project.name,
              client_name: project.clients?.name,
              project_leader_name: leaderName || undefined,
              account_name: accName || undefined,
              quote_number: quoteNum || undefined,
              discipline: (project as any).discipline ? (disciplineLabels[(project as any).discipline] || (project as any).discipline) : undefined,
              start_date: (project as any).start_date ? format(new Date((project as any).start_date), 'dd/MM/yyyy') : undefined,
              end_date: (project as any).end_date ? format(new Date((project as any).end_date), 'dd/MM/yyyy') : undefined,
              team_members: teamNames.length > 0 ? teamNames : undefined,
            },
          }).then(({ error: slackErr }) => {
            if (slackErr) console.error('Slack notification error:', slackErr);
          });
        }
      }

      refetch();
    } catch (error) {
      console.error('Error updating project status:', error);
    }
  };
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };
  const startEditing = (projectId: string, field: string, currentValue: any) => {
    setEditingField({
      projectId,
      field
    });
    setEditValue(currentValue?.toString() || '');
  };
  const cancelEditing = () => {
    setEditingField(null);
    setEditValue('');
  };
  const saveEdit = async (projectId: string, field: string) => {
    try {
      let updateData: any = {};
      if (field === 'progress') {
        const progressValue = parseFloat(editValue);
        if (isNaN(progressValue) || progressValue < 0 || progressValue > 100) {
          toast.error('Il progresso deve essere un numero tra 0 e 100');
          return;
        }
        updateData.progress = progressValue;
      } else if (field === 'end_date') {
        updateData.end_date = editValue;
      } else if (field === 'is_billable') {
        updateData.is_billable = editValue === 'true';
      } else if (field === 'billing_type') {
        updateData.billing_type = editValue;
      } else if (field === 'margin_percentage') {
        const marginValue = parseFloat(editValue);
        if (isNaN(marginValue) || marginValue < 0 || marginValue > 100) {
          toast.error('La marginalità deve essere un numero tra 0 e 100');
          return;
        }
        updateData.margin_percentage = marginValue;
      }
      const {
        error
      } = await supabase.from('projects').update(updateData).eq('id', projectId);
      if (error) throw error;
      toast.success('Campo aggiornato con successo');
      refetch();
      cancelEditing();
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error('Errore durante l\'aggiornamento');
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    
    setIsDeleting(true);
    try {
      // First, unlink the project from any associated budget
      await supabase
        .from('budgets')
        .update({ project_id: null })
        .eq('project_id', projectToDelete.id);
      
      // Then delete the project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectToDelete.id);
      if (error) throw error;
      toast.success('Progetto eliminato con successo. Il budget associato rimane intatto.');
      refetch();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Errore durante l\'eliminazione del progetto');
    } finally {
      setIsDeleting(false);
      setProjectToDelete(null);
    }
  };

  const exportProjects = (formatType: 'xlsx' | 'csv') => {
    const statusLabelsMap: Record<string, string> = {
      'in_partenza': 'In Partenza',
      'aperto': 'Aperto',
      'da_fatturare': 'Da Fatturare',
      'completato': 'Completato'
    };

    const data = projects.map(p => ({
      'Nome Progetto': p.name || '',
      'Cliente': p.clients?.name || '',
      'Area': p.area || '',
      'Account': p.account_profiles ? `${p.account_profiles.first_name} ${p.account_profiles.last_name}`.trim() : '',
      'Project Leader': p.project_leader ? `${p.project_leader.first_name} ${p.project_leader.last_name}`.trim() : '',
      'Team': (p.teamMembers || []).join(', '),
      'Stato': statusLabelsMap[p.project_status || ''] || p.project_status || '',
      'Budget (€)': Number(p.total_budget || 0),
      'Margine Obiettivo (%)': Number(p.margin_percentage || 0),
      'Target Budget (€)': Number(p.targetBudget || 0),
      'Costo Lavoro (€)': Number(p.laborCost || 0),
      'Costi Esterni (€)': Number(p.externalCost || 0),
      'Costi Totali (€)': Number(p.confirmedCosts || 0),
      'Margine Residuo (%)': Number(p.residualMargin || 0),
      'Progresso (%)': Number(p.progress || 0),
      'Data Inizio': p.start_date ? format(new Date(p.start_date), 'dd/MM/yyyy') : '',
      'Data Fine': p.end_date ? format(new Date(p.end_date), 'dd/MM/yyyy') : '',
      'Fatturabile': p.is_billable ? 'Sì' : 'No',
      'Tipo Fatturazione': p.billing_type || '',
      'N. Preventivo': p.quote_number || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Progetti');

    const fileName = `progetti_${format(new Date(), 'yyyy-MM-dd')}`;
    if (formatType === 'xlsx') {
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } else {
      XLSX.writeFile(wb, `${fileName}.csv`, { bookType: 'csv' });
    }
    toast.success(`Export ${formatType.toUpperCase()} completato`);
  };

  if (isLoading) {
    return <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>;
  }
  return <div className="page-container stack-lg">
      <div className="page-header-with-actions">
        <h1 className="page-title">Progetti</h1>
        <div className="flex gap-2">
          {projects.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Esporta
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border z-50">
                <DropdownMenuItem onClick={() => exportProjects('xlsx')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportProjects('csv')}>
                  <FileText className="h-4 w-4 mr-2" />
                  CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {hasPermission(userRole, 'canCreateProjects') && (
            <>
              <ProjectImport onImportComplete={refetch} />
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuovo progetto
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Alert Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          variant="default" 
          className={`cursor-pointer border-l-4 border-l-destructive ${alertDialogType === 'deadline' ? 'ring-2 ring-destructive/30' : ''}`}
          onClick={() => setAlertDialogType('deadline')}
        >
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scadenza imminente</CardTitle>
            <Clock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{alertStats.deadlineProjects.length}</div>
            <p className="text-xs text-muted-foreground">entro 7 giorni</p>
          </CardContent>
        </Card>
        <Card 
          variant="default" 
          className={`cursor-pointer border-l-4 border-l-orange-500 ${alertDialogType === 'margin' ? 'ring-2 ring-orange-500/30' : ''}`}
          onClick={() => setAlertDialogType('margin')}
        >
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium text-muted-foreground">Margine critico</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{alertStats.marginProjects.length}</div>
            <p className="text-xs text-muted-foreground">margine ≤ obiettivo</p>
          </CardContent>
        </Card>
        <Card 
          variant="default" 
          className={`cursor-pointer border-l-4 border-l-primary ${alertDialogType === 'closing' ? 'ring-2 ring-primary/30' : ''}`}
          onClick={() => setAlertDialogType('closing')}
        >
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium text-muted-foreground">In chiusura</CardTitle>
            <Flag className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{alertStats.closingProjects.length}</div>
            <p className="text-xs text-muted-foreground">progresso ≥ 85%</p>
          </CardContent>
        </Card>
      </div>

      <Card variant="static">
        <CardHeader variant="compact">
          <CardTitle>
            {projects.length} {projects.length === 1 ? 'Progetto' : 'Progetti'}
          </CardTitle>
        </CardHeader>
        <CardContent variant="compact" className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cerca..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
            </div>

            <Select value={selectedArea} onValueChange={setSelectedArea}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Area" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="all">Tutte le aree</SelectItem>
                {sortedAreas.map(([area, count]) => (
                  <SelectItem key={area} value={area}>
                    {area} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="all">Tutti gli account</SelectItem>
                {sortedAccounts.map(([name, count]) => (
                  <SelectItem key={name} value={name}>
                    {name} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedProjectLeader} onValueChange={setSelectedProjectLeader}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Project Leader" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="all">Tutti i leader</SelectItem>
                {sortedLeaders.map(([name, count]) => (
                  <SelectItem key={name} value={name}>
                    {name} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedProjectStatus} onValueChange={setSelectedProjectStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="all">Tutti gli stati</SelectItem>
                {sortedStatuses.map(([status, count]) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch 
                id="critical-filter" 
                checked={showOnlyCritical} 
                onCheckedChange={setShowOnlyCritical} 
              />
              <label htmlFor="critical-filter" className="text-sm font-medium cursor-pointer select-none flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                Solo critici
              </label>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                    <div className="flex items-center">
                      Nome Progetto
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('client')}>
                    <div className="flex items-center">
                      Cliente
                      {getSortIcon('client')}
                    </div>
                  </TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Project leader</TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('budget')}>
                    <div className="flex items-center justify-end">
                      Budget
                      {getSortIcon('budget')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('margin')}>
                    <div className="flex items-center justify-end">
                      Marg. Residua
                      {getSortIcon('margin')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('progress')}>
                    <div className="flex items-center">
                      Progress
                      {getSortIcon('progress')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('end_date')}>
                    <div className="flex items-center">
                      Data Fine
                      {getSortIcon('end_date')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                    <div className="flex items-center">
                      Stato
                      {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProjects.length === 0 ? <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nessun progetto trovato
                    </TableCell>
                  </TableRow> : paginatedProjects.map(project => {
                const accountName = project.account_profiles ? `${project.account_profiles.first_name} ${project.account_profiles.last_name}`.trim() : '-';
                const projectLeaderName = project.project_leader ? `${project.project_leader.first_name} ${project.project_leader.last_name}`.trim() : '-';
                
                // Calculate margin status - aligned with ProjectBudgetStats
                const residualMargin = project.residualMargin || 0;
                const targetMargin = project.margin_percentage || 0;
                
                // Alert levels based on target margin (same logic as ProjectBudgetStats)
                // Critical: residual margin is at or below target margin
                // Warning: residual margin is within 5% above target margin
                const isNegative = residualMargin < 0;
                const isCritical = isNegative || (targetMargin > 0 && residualMargin <= targetMargin);
                const isWarning = !isCritical && targetMargin > 0 && residualMargin <= targetMargin + 5;

                // Row classification for highlighting
                const classification = classifyProject(project);
                const rowClassName = classification.deadlineCritical || classification.marginCritical
                  ? 'bg-destructive/5 hover:bg-destructive/10'
                  : '';
                
                return <TableRow key={project.id} className={rowClassName}>
                        <TableCell className="font-medium">
                          <TableNameCell
                            name={project.name}
                            href={`/projects/${project.id}/canvas`}
                            onClick={() => navigate(`/projects/${project.id}/canvas`)}
                          />
                        </TableCell>
                        <TableCell>{project.clients?.name || '-'}</TableCell>
                        <TableCell>{accountName}</TableCell>
                        <TableCell>{projectLeaderName}</TableCell>
                        <TableCell className="text-right">
                          €{Number(project.total_budget || 0).toLocaleString('it-IT', {
                      minimumFractionDigits: 2
                    })}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const bt = project.billing_type;
                            const isNoBudgetType = bt === 'interno' || bt === 'pre_sales' || bt === 'consumptive';
                            
                            if (isNoBudgetType) {
                              // Per progetti senza budget: mostra solo costi sostenuti
                              const totalCosts = project.confirmedCosts || 0;
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center justify-center">
                                      <span className="text-xs font-medium text-muted-foreground">
                                        €{totalCosts.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs space-y-1">
                                      <div className="font-semibold border-b pb-1 mb-1">Costi Sostenuti</div>
                                      <div>Costi labor: €{(project.laborCost || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                                      <div>Costi esterni: €{(project.externalCost || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                                      <div className="border-t pt-1 mt-1 font-medium">Totale: €{totalCosts.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }
                            
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center">
                                    {isNegative ? (
                                      <div className="flex items-center justify-center w-[40px] h-[40px]">
                                        <span className="text-xs font-bold text-foreground">{residualMargin.toFixed(0)}%</span>
                                      </div>
                                    ) : (
                                      <CircularProgress
                                        value={residualMargin}
                                        size={40}
                                        strokeWidth={3}
                                        colorClassName={
                                          isCritical 
                                            ? 'text-destructive' 
                                            : isWarning 
                                              ? 'text-orange-500' 
                                              : 'text-green-600'
                                        }
                                      />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs space-y-1">
                                    <div className="font-semibold border-b pb-1 mb-1">Dettaglio Margine</div>
                                    <div>Budget totale: €{(project.total_budget || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                                    <div>Margine obiettivo: {targetMargin}%</div>
                                    <div>Target budget: €{(project.targetBudget || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                                    <div className="border-t pt-1 mt-1">Costi labor: €{(project.laborCost || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                                    <div>Costi esterni: €{(project.externalCost || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                                    <div className="font-medium">Totale costi: €{(project.confirmedCosts || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                                    <div className="border-t pt-1 mt-1 font-semibold">Margine residuo: {residualMargin.toFixed(1)}%</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const billingType = project.billing_type;
                            const isInterno = billingType === 'interno';
                            const isConsumptive = billingType === 'consumptive';
                            const isRecurring = billingType === 'recurring';
                            const isPack = billingType === 'pack';
                            
                            // Non mostrare progress per interno e consumptive
                            if (isInterno || isConsumptive) {
                              return <span className="text-sm text-muted-foreground">-</span>;
                            }
                            
                            // Check if recurring - calculate progress from temporal advancement
                            let displayProgress = project.progress || 0;
                            
                            if (isRecurring && project.start_date && project.end_date) {
                              const today = new Date();
                              const start = new Date(project.start_date);
                              const end = new Date(project.end_date);
                              const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                              const daysElapsed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                              displayProgress = Math.min(100, Math.max(0, Math.round((daysElapsed / totalDays) * 100)));
                            }
                            
                            // Recurring projects - auto-calculated from temporal progress
                            if (isRecurring) {
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 p-1 rounded">
                                      <Progress value={displayProgress} className="w-16" />
                                      <span className="text-sm text-muted-foreground">{displayProgress}%</span>
                                      <Calculator className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Calcolato automaticamente dall'avanzamento temporale</p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }
                            
                            // Pack projects - auto-calculated from hours (uses billing_type)
                            if (isPack) {
                              const packProgress = project.progress || 0;
                              const isOvertime = packProgress > 100;
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 p-1 rounded">
                                      <Progress 
                                        value={Math.min(packProgress, 100)} 
                                        className={`w-16 ${isOvertime ? '[&>div]:bg-destructive' : ''}`}
                                      />
                                      <span className={`text-sm ${isOvertime ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                        {packProgress}%
                                      </span>
                                      {isOvertime ? (
                                        <AlertTriangle className="h-3 w-3 text-destructive" />
                                      ) : (
                                        <Calculator className="h-3 w-3 text-muted-foreground" />
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {isOvertime ? (
                                      <p className="text-destructive">⚠️ Sforamento ore: {packProgress - 100}% oltre il previsto</p>
                                    ) : (
                                      <p>Calcolato automaticamente: ore contabili / ore previste attività</p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }
                            
                            // Default - editable only for non-member/coordinator roles OR if user is project leader
                            const canEditProgress = (userRole !== 'member' && userRole !== 'coordinator' && userRole !== 'account') || project.project_leader_id === currentUserId;
                            
                            const closingBadge = classification.isClosing ? (
                              <Badge className="text-[10px] px-1.5 py-0 whitespace-nowrap bg-primary/15 text-primary border-primary/30 hover:bg-primary/20">In chiusura</Badge>
                            ) : null;

                            if (canEditProgress) {
                              return (
                                <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded" onClick={() => setProgressDialogProject({ id: project.id, name: project.name, progress: project.progress || 0, clientName: project.clients?.name, projectLeaderId: project.project_leader_id, accountUserId: project.account_user_id })}>
                                  <Progress value={project.progress || 0} className="w-16" />
                                  <span className="text-sm text-muted-foreground">{project.progress || 0}%</span>
                                  {closingBadge}
                                </div>
                              );
                            }
                            
                            return (
                              <div className="flex items-center gap-2 p-1">
                                <Progress value={project.progress || 0} className="w-16" />
                                <span className="text-sm text-muted-foreground">{project.progress || 0}%</span>
                                {closingBadge}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const canEditEndDate = (userRole !== 'member' && userRole !== 'coordinator' && userRole !== 'account') || project.project_leader_id === currentUserId;
                            
                            const deadlineWarning = classification.deadlineCritical ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertCircle className="h-4 w-4 text-destructive inline ml-1" />
                                </TooltipTrigger>
                                <TooltipContent>Scadenza entro {classification.daysToEnd} giorni</TooltipContent>
                              </Tooltip>
                            ) : null;
                            
                            if (editingField?.projectId === project.id && editingField?.field === 'end_date') {
                              return (
                                <div className="flex items-center gap-2">
                                  <Input type="date" value={editValue} onChange={e => setEditValue(e.target.value)} className="w-40 h-8" autoFocus />
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEdit(project.id, 'end_date')}>
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              );
                            }
                            
                            if (canEditEndDate) {
                              return (
                                <div className="cursor-pointer hover:bg-muted/50 p-1 rounded flex items-center" onClick={() => startEditing(project.id, 'end_date', project.end_date ? format(new Date(project.end_date), 'yyyy-MM-dd') : '')}>
                                  {project.end_date ? new Date(project.end_date).toLocaleDateString('it-IT') : '-'}
                                  {deadlineWarning}
                                </div>
                              );
                            }
                            
                            return (
                              <div className="p-1 flex items-center">
                                {project.end_date ? new Date(project.end_date).toLocaleDateString('it-IT') : '-'}
                                {deadlineWarning}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const canChangeStatus = userRole !== 'member' && userRole !== 'coordinator' && userRole !== 'account';
                            const status = project.project_status || 'in_partenza';
                            const statusConfig: Record<string, { label: string; className: string }> = {
                              'in_partenza': { label: 'In partenza', className: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
                              'aperto': { label: 'Aperto', className: 'bg-green-100 text-green-700 hover:bg-green-200' },
                              'da_fatturare': { label: 'Da fatturare', className: 'bg-red-100 text-red-700 hover:bg-red-200' },
                              'completato': { label: 'Completato', className: 'bg-gray-100 text-gray-600 hover:bg-gray-200' }
                            };
                            const config = statusConfig[status] || statusConfig['in_partenza'];
                            
                            if (!canChangeStatus) {
                              return (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className.split(' hover:')[0]}`}>
                                  {config.label}
                                </span>
                              );
                            }
                            
                            return (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${config.className}`}>
                                    {config.label}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem onClick={() => handleUpdateProjectStatus(project.id, 'in_partenza')}>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">In partenza</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateProjectStatus(project.id, 'aperto')}>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Aperto</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateProjectStatus(project.id, 'da_fatturare')}>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Da fatturare</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateProjectStatus(project.id, 'completato')}>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Completato</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {userRole !== 'member' && project.hasBudget && (
                                <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}/budget`)}>
                                  <Calculator className="mr-2 h-4 w-4" />
                                  Vai al Budget
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => {
                          if (project.quote_number) {
                            navigate(`/quotes`);
                          }
                        }} disabled={!project.quote_number}>
                                <FileText className="mr-2 h-4 w-4" />
                                Vai al Preventivo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}/canvas`)}>
                                <BarChart3 className="mr-2 h-4 w-4" />
                                Canvas & Report
                              </DropdownMenuItem>
                              {userRole !== 'member' && userRole !== 'coordinator' && userRole !== 'account' && (
                                <DropdownMenuItem 
                                  onClick={() => setProjectToDelete({ id: project.id, name: project.name })}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
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
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, projects.length)} di {projects.length} progetti
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Precedente
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      // Show first page, last page, current page, and pages around current
                      if (page === 1 || page === totalPages) return true;
                      if (Math.abs(page - currentPage) <= 1) return true;
                      return false;
                    })
                    .map((page, index, array) => {
                      // Add ellipsis between non-consecutive pages
                      const prevPage = array[index - 1];
                      const showEllipsis = prevPage && page - prevPage > 1;
                      
                      return (
                        <span key={page} className="flex items-center">
                          {showEllipsis && <span className="px-2 text-muted-foreground">...</span>}
                          <Button
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        </span>
                      );
                    })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Successivo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateManualProjectDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} onProjectCreated={() => {
        setSelectedProjectStatus('in_partenza');
        refetch();
        setIsCreateDialogOpen(false);
    }} />

      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina progetto</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare il progetto <strong>"{projectToDelete?.name}"</strong>? 
              Questa azione è irreversibile e tutti i dati associati verranno eliminati permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Eliminazione...' : 'Elimina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {progressDialogProject && (
        <ProgressUpdateDialog
          open={!!progressDialogProject}
          onOpenChange={(open) => { if (!open) setProgressDialogProject(null); }}
          projectId={progressDialogProject.id}
          projectName={progressDialogProject.name}
          currentProgress={progressDialogProject.progress}
          onSaved={() => {
            refetch();
            setProgressDialogProject(null);
          }}
          clientName={progressDialogProject.clientName}
          projectLeaderId={progressDialogProject.projectLeaderId}
          accountUserId={progressDialogProject.accountUserId}
        />
      )}

      {/* Alert Detail Dialog */}
      <Dialog open={!!alertDialogType} onOpenChange={(open) => { if (!open) setAlertDialogType(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {alertDialogType === 'deadline' && <><Clock className="h-5 w-5 text-destructive" /> Progetti in scadenza imminente</>}
              {alertDialogType === 'margin' && <><TrendingDown className="h-5 w-5 text-orange-500" /> Progetti con margine critico</>}
              {alertDialogType === 'closing' && <><Flag className="h-5 w-5 text-primary" /> Progetti in chiusura</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(() => {
              const list = alertDialogType === 'deadline' ? alertStats.deadlineProjects
                : alertDialogType === 'margin' ? alertStats.marginProjects
                : alertStats.closingProjects;
              
              if (list.length === 0) return <p className="text-muted-foreground text-sm py-4">Nessun progetto in questa categoria.</p>;

              // Sort: deadline by days remaining, margin by residualMargin asc, closing by progress desc
              const sorted = [...list].sort((a, b) => {
                if (alertDialogType === 'deadline') {
                  const da = a.end_date ? new Date(a.end_date).getTime() : Infinity;
                  const db = b.end_date ? new Date(b.end_date).getTime() : Infinity;
                  return da - db;
                }
                if (alertDialogType === 'margin') return (a.residualMargin || 0) - (b.residualMargin || 0);
                return (getDisplayProgress(b)) - (getDisplayProgress(a));
              });

              return sorted.map(p => {
                const c = classifyProject(p);
                return (
                  <div 
                    key={p.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => { setAlertDialogType(null); navigate(`/projects/${p.id}/canvas`); }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.clients?.name || 'Nessun cliente'}</div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {alertDialogType === 'deadline' && c.daysToEnd !== null && (
                        <Badge variant="destructive" className="text-xs">
                          {c.daysToEnd === 0 ? 'Oggi' : c.daysToEnd === 1 ? 'Domani' : `${c.daysToEnd}gg`}
                        </Badge>
                      )}
                      {alertDialogType === 'margin' && (
                        <Badge variant="destructive" className="text-xs">
                          {(p.residualMargin || 0).toFixed(1)}%
                        </Badge>
                      )}
                      {alertDialogType === 'closing' && (
                        <Badge className="text-xs bg-primary/15 text-primary border-primary/30">
                          {getDisplayProgress(p)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>;
};
export default ApprovedProjects;
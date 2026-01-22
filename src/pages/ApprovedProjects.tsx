import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Calculator, BarChart3, MoreVertical, Check, X, ArrowUpDown, ArrowUp, ArrowDown, Plus, Trash2, Upload, AlertTriangle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Project } from '@/types/project';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CreateManualProjectDialog } from '@/components/CreateManualProjectDialog';
import { ProjectImport } from '@/components/ProjectImport';
import { hasPermission } from '@/lib/permissions';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
};
const ApprovedProjects = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedProjectLeader, setSelectedProjectLeader] = useState<string>('all');
  const [selectedProjectStatus, setSelectedProjectStatus] = useState<string>('aperto');
  const [userRole, setUserRole] = useState<'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null>(null);
  const [editingField, setEditingField] = useState<{
    projectId: string;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [sortField, setSortField] = useState<string | null>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
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
      // For members, get project IDs they are part of OR where they are project leader
      let memberProjectIds: string[] | null = null;
      if (userRole === 'member' && currentUserId) {
        // Get projects where user is a member
        const { data: memberProjects } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', currentUserId);
        
        // Get projects where user is project leader
        const { data: leaderProjects } = await supabase
          .from('projects')
          .select('id')
          .eq('project_leader_id', currentUserId)
          .eq('status', 'approvato');
        
        const memberIds = memberProjects?.map(mp => mp.project_id) || [];
        const leaderIds = leaderProjects?.map(lp => lp.id) || [];
        
        // Combine and deduplicate
        memberProjectIds = [...new Set([...memberIds, ...leaderIds])];

        // If member has no projects, return empty array
        if (memberProjectIds.length === 0) {
          return [];
        }
      }

      let query = supabase.from('projects').select('*, clients(name)').eq('status', 'approvato').order('created_at', {
        ascending: false
      });

      // Filter by project_members OR project_leader for member role
      if (memberProjectIds) {
        query = query.in('id', memberProjectIds);
      }
      const {
        data: projectsData,
        error: projectsError
      } = await query;
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
          progress: calculatedProgress
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

  const projects = allProjects.filter(project => {
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
      case 'target_margin':
        aValue = Number(a.margin_percentage || 0);
        bValue = Number(b.margin_percentage || 0);
        break;
      case 'margin':
        aValue = Number(a.residualMargin || 0);
        bValue = Number(b.residualMargin || 0);
        break;
      case 'progress':
        aValue = Number(a.progress || 0);
        bValue = Number(b.progress || 0);
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
        {hasPermission(userRole, 'canCreateProjects') && (
          <div className="flex gap-2">
            <ProjectImport onImportComplete={refetch} />
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo progetto
            </Button>
          </div>
        )}
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
                  <TableHead className="text-center">Fatturabile</TableHead>
                  <TableHead>Tipologia</TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('target_margin')}>
                    <div className="flex items-center justify-end">
                      Marg. Obiettivo
                      {getSortIcon('target_margin')}
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
                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
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
                const isCritical = targetMargin > 0 && residualMargin <= targetMargin;
                const isWarning = targetMargin > 0 && residualMargin <= targetMargin + 5 && !isCritical;
                
                return <TableRow key={project.id}>
                        <TableCell className="font-medium cursor-pointer hover:text-primary hover:underline" onClick={() => navigate(`/projects/${project.id}/canvas`)}>
                          {project.name}
                        </TableCell>
                        <TableCell>{project.clients?.name || '-'}</TableCell>
                        <TableCell>{accountName}</TableCell>
                        <TableCell>{projectLeaderName}</TableCell>
                        <TableCell className="text-right">
                          €{Number(project.total_budget || 0).toLocaleString('it-IT', {
                      minimumFractionDigits: 2
                    })}
                        </TableCell>
                        {/* Fatturabile column */}
                        <TableCell className="text-center">
                          {editingField?.projectId === project.id && editingField?.field === 'is_billable' ? (
                            <div className="flex items-center justify-center gap-2">
                              <Select value={editValue} onValueChange={setEditValue}>
                                <SelectTrigger className="w-[80px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="true">Sì</SelectItem>
                                  <SelectItem value="false">No</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEdit(project.id, 'is_billable')}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className={`${userRole === 'admin' ? 'cursor-pointer hover:bg-muted/50' : ''} p-1 rounded inline-block`}
                              onClick={() => userRole === 'admin' && startEditing(project.id, 'is_billable', project.is_billable ? 'true' : 'false')}
                            >
                              <span className={`text-sm font-medium ${project.is_billable !== false ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {project.is_billable !== false ? 'Sì' : 'No'}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        {/* Tipologia Progetto column */}
                        <TableCell>
                          {editingField?.projectId === project.id && editingField?.field === 'billing_type' ? (
                            <div className="flex items-center gap-2">
                              <Select value={editValue} onValueChange={setEditValue}>
                                <SelectTrigger className="w-[130px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="one-shot">One-Shot</SelectItem>
                                  <SelectItem value="recurring">Recurring</SelectItem>
                                  <SelectItem value="consumptive">Consumptive</SelectItem>
                                  <SelectItem value="pack">Pack</SelectItem>
                                  <SelectItem value="pre-sales">Pre Sales</SelectItem>
                                  <SelectItem value="interno">Interno</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEdit(project.id, 'billing_type')}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className={`${userRole === 'admin' ? 'cursor-pointer hover:bg-muted/50' : ''} p-1 rounded`}
                              onClick={() => userRole === 'admin' && startEditing(project.id, 'billing_type', project.billing_type || 'one-shot')}
                            >
                              <span className="text-sm capitalize">{project.billing_type?.replace('-', ' ') || 'One-Shot'}</span>
                            </div>
                          )}
                        </TableCell>
                        {/* Marginalità Obiettivo column */}
                        <TableCell className="text-right">
                          {editingField?.projectId === project.id && editingField?.field === 'margin_percentage' ? (
                            <div className="flex items-center justify-end gap-2">
                              <Input 
                                type="number" 
                                min="0" 
                                max="100" 
                                value={editValue} 
                                onChange={e => setEditValue(e.target.value)} 
                                className="w-20 h-8 text-right" 
                                autoFocus 
                              />
                              <span className="text-sm">%</span>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEdit(project.id, 'margin_percentage')}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className={`${userRole === 'admin' ? 'cursor-pointer hover:bg-muted/50' : ''} p-1 rounded text-right`}
                              onClick={() => userRole === 'admin' && startEditing(project.id, 'margin_percentage', project.margin_percentage || 0)}
                            >
                              <span className="text-sm font-medium">{project.margin_percentage || 0}%</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`flex items-center justify-end gap-2 font-medium ${
                                isCritical 
                                  ? 'text-destructive' 
                                  : isWarning 
                                    ? 'text-orange-500' 
                                    : 'text-green-600'
                              }`}>
                                {isCritical && <AlertCircle className="h-4 w-4" />}
                                {isWarning && <AlertTriangle className="h-4 w-4" />}
                                <span>{residualMargin.toFixed(1)}%</span>
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
                            
                            // Editing mode
                            if (editingField?.projectId === project.id && editingField?.field === 'progress') {
                              return (
                                <div className="flex items-center gap-2">
                                  <Input type="number" min="0" max="100" value={editValue} onChange={e => setEditValue(e.target.value)} className="w-20 h-8" autoFocus />
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEdit(project.id, 'progress')}>
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              );
                            }
                            
                            // Default - editable
                            return (
                              <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded" onClick={() => startEditing(project.id, 'progress', project.progress || 0)}>
                                <Progress value={project.progress || 0} className="w-16" />
                                <span className="text-sm text-muted-foreground">{project.progress || 0}%</span>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {editingField?.projectId === project.id && editingField?.field === 'end_date' ? <div className="flex items-center gap-2">
                              <Input type="date" value={editValue} onChange={e => setEditValue(e.target.value)} className="w-40 h-8" autoFocus />
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEdit(project.id, 'end_date')}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div> : <div className="cursor-pointer hover:bg-muted/50 p-1 rounded" onClick={() => startEditing(project.id, 'end_date', project.end_date ? format(new Date(project.end_date), 'yyyy-MM-dd') : '')}>
                              {project.end_date ? new Date(project.end_date).toLocaleDateString('it-IT') : '-'}
                            </div>}
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={project.project_status || 'in_partenza'} 
                            onValueChange={value => handleUpdateProjectStatus(project.id, value as any)}
                            disabled={userRole === 'member'}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="in_partenza">In Partenza</SelectItem>
                              <SelectItem value="aperto">Aperto</SelectItem>
                              <SelectItem value="da_fatturare">Da Fatturare</SelectItem>
                              <SelectItem value="completato">Completato</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {userRole !== 'member' && (
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
                              {userRole !== 'member' && (
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
    </div>;
};
export default ApprovedProjects;
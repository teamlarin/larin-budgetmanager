import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Calculator, BarChart3, MoreVertical, Check, X, ArrowUpDown, ArrowUp, ArrowDown, Plus, Trash2, Upload, AlertTriangle, AlertCircle } from 'lucide-react';
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
  quote_number?: string;
  confirmedCosts?: number;
  targetBudget?: number;
  residualMargin?: number;
};
const ApprovedProjects = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedProjectStatus, setSelectedProjectStatus] = useState<string>('all');
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
    queryKey: ['approved-projects', currentUserId, userRole, 'v2'], // v2: now includes all time tracking
    queryFn: async () => {
      // For members, first get the project IDs they are part of
      let memberProjectIds: string[] | null = null;
      if (userRole === 'member' && currentUserId) {
        const {
          data: memberProjects
        } = await supabase.from('project_members').select('project_id').eq('user_id', currentUserId);
        memberProjectIds = memberProjects?.map(mp => mp.project_id) || [];

        // If member has no projects, return empty array
        if (memberProjectIds.length === 0) {
          return [];
        }
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

      let query = supabase.from('projects').select('*, clients(name)').eq('status', 'approvato').order('created_at', {
        ascending: false
      });

      // Filter by project_members for member role
      if (memberProjectIds) {
        query = query.in('id', memberProjectIds);
      }
      const {
        data: projectsData,
        error: projectsError
      } = await query;
      if (projectsError) throw projectsError;

      const projectIds = projectsData?.map(p => p.id) || [];

      // Fetch budget items for all projects (including product info for external costs)
      const { data: budgetItemsData } = await supabase
        .from('budget_items')
        .select('id, project_id, is_product, total_cost, vat_rate')
        .in('project_id', projectIds);
      
      const budgetItemsMap = new Map(budgetItemsData?.map(bi => [bi.id, bi.project_id]) || []);
      const budgetItemIds = budgetItemsData?.map(bi => bi.id) || [];

      // Calculate external costs (products) per project - net cost without VAT
      const externalCostsMap = new Map<string, number>();
      budgetItemsData?.forEach(item => {
        if (item.is_product) {
          const totalCost = Number(item.total_cost || 0);
          const vatRate = Number(item.vat_rate || 22);
          const netCost = totalCost / (1 + vatRate / 100);
          const currentCost = externalCostsMap.get(item.project_id) || 0;
          externalCostsMap.set(item.project_id, currentCost + netCost);
        }
      });

      // Fetch time tracking entries for confirmed hours
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

      // Calculate confirmed costs per project
      const confirmedCostsMap = new Map<string, number>();
      timeTrackingData?.forEach(entry => {
        const projectId = budgetItemsMap.get(entry.budget_item_id);
        if (projectId && entry.actual_start_time && entry.actual_end_time) {
          const start = new Date(entry.actual_start_time);
          const end = new Date(entry.actual_end_time);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          const userHourlyRate = profileHourlyRateMap.get(entry.user_id) || 0;
          const cost = hours * (userHourlyRate + overheadsAmount);
          const currentCost = confirmedCostsMap.get(projectId) || 0;
          confirmedCostsMap.set(projectId, currentCost + cost);
        }
      });

      const userIds = [...new Set([...(projectsData?.map(p => p.user_id).filter(Boolean) || []), ...(projectsData?.map(p => p.account_user_id).filter(Boolean) || [])])];
      const {
        data: profilesData,
        error: profilesError
      } = await supabase.from('profiles').select('id, first_name, last_name').in('id', userIds);
      if (profilesError) throw profilesError;
      const profilesMap = new Map(profilesData?.map(p => [p.id, {
        first_name: p.first_name,
        last_name: p.last_name
      }]) || []);

      const {
        data: quotesData
      } = await supabase.from('quotes').select('project_id, quote_number').in('project_id', projectIds).eq('status', 'approved');
      const quotesMap = new Map(quotesData?.map(q => [q.project_id, q.quote_number]) || []);

      return projectsData?.map(project => {
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
          quote_number: quotesMap.get(project.id),
          confirmedCosts,
          targetBudget,
          residualMargin
        };
      }) as ProjectWithDetails[] || [];
    },
    enabled: !!currentUserId
  });
  const uniqueAreas = [...new Set(allProjects.map(p => p.area).filter(Boolean))].sort();
  const uniqueAccounts = [...new Set(allProjects.map(p => p.account_profiles ? `${p.account_profiles.first_name} ${p.account_profiles.last_name}`.trim() : null).filter(Boolean))].sort();
  const projects = allProjects.filter(project => {
    if (searchQuery && !project.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedArea !== 'all' && project.area !== selectedArea) {
      return false;
    }
    if (selectedAccount !== 'all') {
      const accountName = project.account_profiles ? `${project.account_profiles.first_name} ${project.account_profiles.last_name}`.trim() : null;
      if (accountName !== selectedAccount) {
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
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectToDelete.id);
      if (error) throw error;
      toast.success('Progetto eliminato con successo');
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
  return <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Progetti
          </h1>
          <p className="text-muted-foreground">
            Gestione dei progetti approvati
          </p>
        </div>
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

      <Card>
        <CardHeader>
          <CardTitle>
            {projects.length} {projects.length === 1 ? 'Progetto' : 'Progetti'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cerca progetti..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
            </div>

            <Select value={selectedArea} onValueChange={setSelectedArea}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le aree</SelectItem>
                {uniqueAreas.map(area => <SelectItem key={area} value={area!}>
                    {area}
                  </SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli account</SelectItem>
                {uniqueAccounts.map(account => <SelectItem key={account} value={account}>
                    {account}
                  </SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedProjectStatus} onValueChange={setSelectedProjectStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="in_partenza">In Partenza</SelectItem>
                <SelectItem value="aperto">Aperto</SelectItem>
                <SelectItem value="da_fatturare">Da Fatturare</SelectItem>
                <SelectItem value="completato">Completato</SelectItem>
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
                {projects.length === 0 ? <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nessun progetto trovato
                    </TableCell>
                  </TableRow> : projects.map(project => {
                const accountName = project.account_profiles ? `${project.account_profiles.first_name} ${project.account_profiles.last_name}`.trim() : '-';
                const creatorName = project.profiles ? `${project.profiles.first_name} ${project.profiles.last_name}`.trim() : '-';
                
                // Calculate margin status
                const residualMargin = project.residualMargin || 0;
                const targetMargin = project.margin_percentage || 0;
                const warningThreshold = project.projection_warning_threshold || 10;
                const criticalThreshold = project.projection_critical_threshold || 25;
                
                // Alert levels based on how far residual margin is from target margin
                const marginDifference = targetMargin - residualMargin;
                const isCritical = marginDifference >= criticalThreshold || residualMargin < 0;
                const isWarning = marginDifference >= warningThreshold && !isCritical;
                
                return <TableRow key={project.id}>
                        <TableCell className="font-medium cursor-pointer hover:text-primary hover:underline" onClick={() => navigate(`/projects/${project.id}/canvas`)}>
                          {project.name}
                        </TableCell>
                        <TableCell>{project.clients?.name || '-'}</TableCell>
                        <TableCell>{accountName}</TableCell>
                        <TableCell>{creatorName}</TableCell>
                        <TableCell className="text-right">
                          €{Number(project.total_budget || 0).toLocaleString('it-IT', {
                      minimumFractionDigits: 2
                    })}
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
                                <div>Marginalità obiettivo: {targetMargin}%</div>
                                <div>Marginalità residua: {residualMargin.toFixed(1)}%</div>
                                <div>Costi confermati: €{(project.confirmedCosts || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                                <div>Budget target: €{(project.targetBudget || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {editingField?.projectId === project.id && editingField?.field === 'progress' ? <div className="flex items-center gap-2">
                              <Input type="number" min="0" max="100" value={editValue} onChange={e => setEditValue(e.target.value)} className="w-20 h-8" autoFocus />
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEdit(project.id, 'progress')}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div> : <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded" onClick={() => startEditing(project.id, 'progress', project.progress || 0)}>
                              <Progress value={project.progress || 0} className="w-16" />
                              <span className="text-sm text-muted-foreground">{project.progress || 0}%</span>
                            </div>}
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
                          <Select value={project.project_status || 'in_partenza'} onValueChange={value => handleUpdateProjectStatus(project.id, value as any)}>
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
                              <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}/budget`)}>
                                <Calculator className="mr-2 h-4 w-4" />
                                Vai al Budget
                              </DropdownMenuItem>
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
                              <DropdownMenuItem 
                                onClick={() => setProjectToDelete({ id: project.id, name: project.name })}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Elimina
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>;
              })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateManualProjectDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} onProjectCreated={() => {
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
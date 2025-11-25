import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Calculator, BarChart3, MoreVertical, Check, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import type { Project } from '@/types/project';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';

type ProjectWithDetails = Project & {
  profiles: { first_name: string; last_name: string } | null;
  account_profiles: { first_name: string; last_name: string } | null;
  quote_number?: string;
};

const ApprovedProjects = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedProjectStatus, setSelectedProjectStatus] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [userRole, setUserRole] = useState<'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null>(null);
  const [editingField, setEditingField] = useState<{ projectId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setCurrentUserId(data.user?.id || null);
      
      if (data.user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .maybeSingle();
        
        const role = roleData?.role as 'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null;
        setUserRole(role);
      }
    });
  }, []);

  const { data: allProjects = [], isLoading, refetch } = useQuery<ProjectWithDetails[]>({
    queryKey: ['approved-projects'],
    queryFn: async () => {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .eq('status', 'approvato')
        .order('created_at', { ascending: false });
      
      if (projectsError) throw projectsError;
      
      const userIds = [...new Set([
        ...projectsData?.map(p => p.user_id).filter(Boolean) || [],
        ...projectsData?.map(p => p.account_user_id).filter(Boolean) || []
      ])];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);
      
      if (profilesError) throw profilesError;
      
      const profilesMap = new Map(
        profilesData?.map(p => [p.id, { first_name: p.first_name, last_name: p.last_name }]) || []
      );

      const projectIds = projectsData?.map(p => p.id) || [];
      const { data: quotesData } = await supabase
        .from('quotes')
        .select('project_id, quote_number')
        .in('project_id', projectIds)
        .eq('status', 'approved');

      const quotesMap = new Map(
        quotesData?.map(q => [q.project_id, q.quote_number]) || []
      );
      
      return projectsData?.map(project => ({
        ...project,
        profiles: profilesMap.get(project.user_id) || null,
        account_profiles: project.account_user_id ? profilesMap.get(project.account_user_id) || null : null,
        quote_number: quotesMap.get(project.id)
      })) as ProjectWithDetails[] || [];
    },
  });

  const uniqueClients = [...new Set(allProjects.map(p => p.clients?.name).filter(Boolean))].sort();
  const uniqueAccounts = [...new Set(
    allProjects.map(p => p.account_profiles ? `${p.account_profiles.first_name} ${p.account_profiles.last_name}`.trim() : null).filter(Boolean)
  )].sort();

  const projects = allProjects.filter(project => {
    if (searchQuery && !project.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedClient !== 'all' && project.clients?.name !== selectedClient) {
      return false;
    }
    if (selectedAccount !== 'all') {
      const accountName = project.account_profiles 
        ? `${project.account_profiles.first_name} ${project.account_profiles.last_name}`.trim()
        : null;
      if (accountName !== selectedAccount) {
        return false;
      }
    }
    if (selectedProjectStatus !== 'all' && project.project_status !== selectedProjectStatus) {
      return false;
    }
    if (selectedArea !== 'all' && project.area !== selectedArea) {
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
        aValue = Number(a.margin_percentage || 0);
        bValue = Number(b.margin_percentage || 0);
        break;
      case 'progress':
        aValue = Number(a.progress || 0);
        bValue = Number(b.progress || 0);
        break;
      case 'area':
        aValue = a.area?.toLowerCase() || '';
        bValue = b.area?.toLowerCase() || '';
        break;
      case 'discipline':
        aValue = a.discipline?.toLowerCase() || '';
        bValue = b.discipline?.toLowerCase() || '';
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
      const { error } = await supabase
        .from('projects')
        .update({ project_status: newStatus })
        .eq('id', projectId);

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
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const startEditing = (projectId: string, field: string, currentValue: any) => {
    setEditingField({ projectId, field });
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
      } else if (field === 'area') {
        updateData.area = editValue;
      } else if (field === 'discipline') {
        updateData.discipline = editValue;
      } else if (field === 'end_date') {
        updateData.end_date = editValue;
      }

      const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId);

      if (error) throw error;
      
      toast.success('Campo aggiornato con successo');
      refetch();
      cancelEditing();
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error('Errore durante l\'aggiornamento');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Progetti
        </h1>
        <p className="text-muted-foreground">
          Gestione dei progetti approvati
        </p>
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
              <Input
                placeholder="Cerca progetti..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i clienti</SelectItem>
                {uniqueClients.map((client) => (
                  <SelectItem key={client} value={client}>
                    {client}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli account</SelectItem>
                {uniqueAccounts.map((account) => (
                  <SelectItem key={account} value={account}>
                    {account}
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
                <SelectItem value="in_partenza">In Partenza</SelectItem>
                <SelectItem value="aperto">Aperto</SelectItem>
                <SelectItem value="da_fatturare">Da Fatturare</SelectItem>
                <SelectItem value="completato">Completato</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedArea} onValueChange={setSelectedArea}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Area" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="all">Tutte le aree</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="tech">Tech</SelectItem>
                <SelectItem value="branding">Branding</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Nome Progetto
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('client')}
                  >
                    <div className="flex items-center">
                      Cliente
                      {getSortIcon('client')}
                    </div>
                  </TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Project Leader</TableHead>
                  <TableHead>N. Preventivo</TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('budget')}
                  >
                    <div className="flex items-center justify-end">
                      Budget
                      {getSortIcon('budget')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('margin')}
                  >
                    <div className="flex items-center justify-end">
                      Margine
                      {getSortIcon('margin')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('progress')}
                  >
                    <div className="flex items-center">
                      Progress
                      {getSortIcon('progress')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('area')}
                  >
                    <div className="flex items-center">
                      Area
                      {getSortIcon('area')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('discipline')}
                  >
                    <div className="flex items-center">
                      Disciplina
                      {getSortIcon('discipline')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('end_date')}
                  >
                    <div className="flex items-center">
                      Data Fine
                      {getSortIcon('end_date')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      Stato
                      {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                      Nessun progetto trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((project) => {
                    const accountName = project.account_profiles
                      ? `${project.account_profiles.first_name} ${project.account_profiles.last_name}`.trim()
                      : '-';

                    const creatorName = project.profiles
                      ? `${project.profiles.first_name} ${project.profiles.last_name}`.trim()
                      : '-';

                    return (
                      <TableRow key={project.id}>
                        <TableCell 
                          className="font-medium cursor-pointer hover:text-primary hover:underline"
                          onClick={() => navigate(`/projects/${project.id}/canvas`)}
                        >
                          {project.name}
                        </TableCell>
                        <TableCell>{project.clients?.name || '-'}</TableCell>
                        <TableCell>{accountName}</TableCell>
                        <TableCell>{creatorName}</TableCell>
                        <TableCell>{project.quote_number || '-'}</TableCell>
                        <TableCell className="text-right">
                          €{Number(project.total_budget || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          {project.margin_percentage ? `${project.margin_percentage}%` : '-'}
                        </TableCell>
                        <TableCell>
                          {editingField?.projectId === project.id && editingField?.field === 'progress' ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 h-8"
                                autoFocus
                              />
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEdit(project.id, 'progress')}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
                              onClick={() => startEditing(project.id, 'progress', project.progress || 0)}
                            >
                              <Progress value={project.progress || 0} className="w-16" />
                              <span className="text-sm text-muted-foreground">{project.progress || 0}%</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingField?.projectId === project.id && editingField?.field === 'area' ? (
                            <div className="flex items-center gap-2">
                              <Select value={editValue} onValueChange={setEditValue}>
                                <SelectTrigger className="w-32 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background border z-50">
                                  <SelectItem value="marketing">Marketing</SelectItem>
                                  <SelectItem value="tech">Tech</SelectItem>
                                  <SelectItem value="branding">Branding</SelectItem>
                                  <SelectItem value="sales">Sales</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEdit(project.id, 'area')}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className="cursor-pointer hover:bg-muted/50 p-1 rounded"
                              onClick={() => startEditing(project.id, 'area', project.area)}
                            >
                              {project.area || '-'}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingField?.projectId === project.id && editingField?.field === 'discipline' ? (
                            <div className="flex items-center gap-2">
                              <Select value={editValue} onValueChange={setEditValue}>
                                <SelectTrigger className="w-48 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background border z-50">
                                  <SelectItem value="content_creation_storytelling">Content Creation & Storytelling</SelectItem>
                                  <SelectItem value="paid_advertising_media_buying">Paid Advertising & Media Buying</SelectItem>
                                  <SelectItem value="website_landing_page_development">Website & Landing Page Development</SelectItem>
                                  <SelectItem value="brand_identity_visual_design">Brand Identity & Visual Design</SelectItem>
                                  <SelectItem value="social_media_management">Social Media Management</SelectItem>
                                  <SelectItem value="email_marketing_automation">Email Marketing & Automation</SelectItem>
                                  <SelectItem value="seo_content_optimization">SEO & Content Optimization</SelectItem>
                                  <SelectItem value="crm_customer_data_platform">CRM & Customer Data Platform</SelectItem>
                                  <SelectItem value="software_development_integration">Software Development & Integration</SelectItem>
                                  <SelectItem value="ai_implementation_automation">AI Implementation & Automation</SelectItem>
                                  <SelectItem value="strategic_consulting">Strategic Consulting</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEdit(project.id, 'discipline')}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className="cursor-pointer hover:bg-muted/50 p-1 rounded"
                              onClick={() => startEditing(project.id, 'discipline', project.discipline)}
                            >
                              {project.discipline || '-'}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingField?.projectId === project.id && editingField?.field === 'end_date' ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="date"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-40 h-8"
                                autoFocus
                              />
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEdit(project.id, 'end_date')}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className="cursor-pointer hover:bg-muted/50 p-1 rounded"
                              onClick={() => startEditing(project.id, 'end_date', project.end_date ? format(new Date(project.end_date), 'yyyy-MM-dd') : '')}
                            >
                              {project.end_date ? new Date(project.end_date).toLocaleDateString('it-IT') : '-'}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={project.project_status || 'in_partenza'}
                            onValueChange={(value) => handleUpdateProjectStatus(project.id, value as any)}
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
                              <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}/budget`)}>
                                <Calculator className="mr-2 h-4 w-4" />
                                Vai al Budget
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  if (project.quote_number) {
                                    navigate(`/quotes`);
                                  }
                                }}
                                disabled={!project.quote_number}
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                Vai al Preventivo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}/canvas`)}>
                                <BarChart3 className="mr-2 h-4 w-4" />
                                Canvas & Report
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApprovedProjects;

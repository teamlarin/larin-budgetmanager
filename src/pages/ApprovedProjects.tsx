import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Calculator, Presentation, BarChart3, MoreVertical } from 'lucide-react';
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
  const [userRole, setUserRole] = useState<'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null>(null);

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
    return true;
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
              <SelectContent>
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
                  <TableHead>Nome Progetto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Project Leader</TableHead>
                  <TableHead>N. Preventivo</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Margine</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Data Fine</TableHead>
                  <TableHead>Stato</TableHead>
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
                        <TableCell className="font-medium">{project.name}</TableCell>
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
                          <div className="flex items-center gap-2">
                            <Progress value={project.progress || 0} className="w-16" />
                            <span className="text-sm text-muted-foreground">{project.progress || 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{project.area || '-'}</TableCell>
                        <TableCell>{project.discipline || '-'}</TableCell>
                        <TableCell>
                          {project.end_date ? new Date(project.end_date).toLocaleDateString('it-IT') : '-'}
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

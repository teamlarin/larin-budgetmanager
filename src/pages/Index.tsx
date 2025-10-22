import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, ArrowUpDown, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { BudgetStatusBadge } from '@/components/BudgetStatusBadge';
import type { Project } from '@/types/project';

type ProjectWithDetails = Project & {
  profiles: { first_name: string; last_name: string } | null;
  account_profiles: { first_name: string; last_name: string } | null;
  clients: { name: string } | null;
};

type SortField = 'name' | 'client' | 'owner' | 'account' | 'amount' | 'status' | 'created' | null;
type SortDirection = 'asc' | 'desc';

const Index = () => {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const { data: projects = [], isLoading, refetch } = useQuery<ProjectWithDetails[]>({
    queryKey: ['all-projects'],
    queryFn: async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      
      // Fetch projects with clients
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });
      
      if (projectsError) throw projectsError;
      
      // Get unique user IDs for both user_id and account_user_id
      const userIds = [...new Set([
        ...projectsData?.map(p => p.user_id).filter(Boolean) || [],
        ...projectsData?.map(p => p.account_user_id).filter(Boolean) || []
      ])];
      
      // Fetch profiles for all users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);
      
      if (profilesError) throw profilesError;
      
      // Create a map of user_id to profile
      const profilesMap = new Map(
        profilesData?.map(p => [p.id, { first_name: p.first_name, last_name: p.last_name }]) || []
      );
      
      // Merge projects with profiles
      return projectsData?.map(project => ({
        ...project,
        profiles: profilesMap.get(project.user_id) || null,
        account_profiles: project.account_user_id ? profilesMap.get(project.account_user_id) || null : null
      })) as ProjectWithDetails[] || [];
    },
  });

  const handleProjectCreated = () => {
    refetch();
    setIsCreateDialogOpen(false);
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
  const uniqueAccounts = [...new Set(
    projects.map(p => p.account_profiles ? `${p.account_profiles.first_name} ${p.account_profiles.last_name}`.trim() : null).filter(Boolean)
  )].sort();

  // Filter and sort projects
  const filteredProjects = projects
    .filter(project => {
      // Search filter
      if (searchQuery && !project.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Client filter
      if (selectedClient !== 'all' && project.clients?.name !== selectedClient) {
        return false;
      }
      // Account filter
      if (selectedAccount !== 'all') {
        const accountName = project.account_profiles 
          ? `${project.account_profiles.first_name} ${project.account_profiles.last_name}`.trim()
          : null;
        if (accountName !== selectedAccount) {
          return false;
        }
      }
      // Status filter
      if (selectedStatus !== 'all' && project.status !== selectedStatus) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
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
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'created':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

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
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Budget</h1>
        <p className="text-muted-foreground">
          Gestisci tutti i budget dei tuoi progetti
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca budget per nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/projects?view=mine')}
            >
              <Users className="h-4 w-4 mr-2" />
              I Miei Budget
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Budget
            </Button>
          </div>
        </div>

        <div className="flex gap-4">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtra per cliente" />
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
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtra per account" />
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

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtra per stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="in_attesa">In Attesa</SelectItem>
              <SelectItem value="approvato">Approvato</SelectItem>
              <SelectItem value="rifiutato">Rifiutato</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('name')}
                    className="h-8 px-2 lg:px-3"
                  >
                    Nome Budget
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('client')}
                    className="h-8 px-2 lg:px-3"
                  >
                    Cliente
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('owner')}
                    className="h-8 px-2 lg:px-3"
                  >
                    Proprietario
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('account')}
                    className="h-8 px-2 lg:px-3"
                  >
                    Account
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('created')}
                    className="h-8 px-2 lg:px-3"
                  >
                    Data Creazione
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('amount')}
                    className="h-8 px-2 lg:px-3"
                  >
                    Importo
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('status')}
                    className="h-8 px-2 lg:px-3"
                  >
                    Stato
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {searchQuery || selectedClient !== 'all' || selectedAccount !== 'all' || selectedStatus !== 'all'
                      ? 'Nessun budget trovato con i filtri applicati'
                      : 'Nessun budget trovato'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredProjects.map((project) => {
                  const creatorName = project.profiles 
                    ? `${project.profiles.first_name} ${project.profiles.last_name}`.trim()
                    : 'Utente sconosciuto';
                  
                  const accountName = project.account_profiles
                    ? `${project.account_profiles.first_name} ${project.account_profiles.last_name}`.trim()
                    : '-';
                  
                  return (
                    <TableRow 
                      key={project.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>{project.clients?.name || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {creatorName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {accountName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(project.created_at).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        €{project.total_budget.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <BudgetStatusBadge status={project.status} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
};

export default Index;

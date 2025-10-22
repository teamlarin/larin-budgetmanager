import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProjectCard } from '@/components/ProjectCard';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { supabase } from '@/integrations/supabase/client';
import type { Project } from '@/types/project';

type ProjectWithCreator = Project & {
  profiles: { first_name: string; last_name: string } | null;
  account_profiles: { first_name: string; last_name: string } | null;
};

const Projects = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [canCreateBudget, setCanCreateBudget] = useState(false);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const view = searchParams.get('view') || 'mine';

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setCurrentUserId(data.user?.id || null);
      
      // Check user role
      if (data.user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .maybeSingle();
        
        const userRole = roleData?.role;
        // Editor and admin can create budgets, subscriber cannot
        setCanCreateBudget(userRole === 'admin' || userRole === 'editor');
        setIsSubscriber(userRole === 'subscriber');
      }
    });
  }, []);

  const { data: allProjects = [], isLoading, refetch } = useQuery<ProjectWithCreator[]>({
    queryKey: ['projects'],
    queryFn: async () => {
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
      })) as ProjectWithCreator[] || [];
    },
  });

  // Get unique values for filters
  const uniqueClients = [...new Set(allProjects.map(p => p.clients?.name).filter(Boolean))].sort();
  const uniqueAccounts = [...new Set(
    allProjects.map(p => p.account_profiles ? `${p.account_profiles.first_name} ${p.account_profiles.last_name}`.trim() : null).filter(Boolean)
  )].sort();

  const projects = (view === 'mine' 
    ? allProjects.filter(p => p.user_id === currentUserId)
    : allProjects
  ).filter(project => {
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
  });

  const handleProjectCreated = () => {
    refetch();
    setIsCreateDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {view === 'mine' ? 'I Miei Budget' : 'Tutti i Budget'}
          </h1>
          <p className="text-muted-foreground">
            {view === 'mine' 
              ? 'Gestisci tutti i tuoi budget in un unico posto'
              : 'Visualizza tutti i budget di tutti gli utenti'
            }
          </p>
        </div>
        <div className="flex gap-2">
          {!isSubscriber && (
            <Button
              variant="outline"
              onClick={() => navigate('/')}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Tutti i Budget
            </Button>
          )}
          {canCreateBudget && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Budget
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca budget per nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
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

      {projects.length === 0 ? (
        <Card className="text-center py-12">
          <CardHeader>
            <CardTitle>Nessun budget trovato</CardTitle>
            <CardDescription>
              {searchQuery || selectedClient !== 'all' || selectedAccount !== 'all' || selectedStatus !== 'all'
                ? 'Nessun budget trovato con i filtri applicati'
                : 'Inizia creando il tuo primo budget per gestire costi e attività'
              }
            </CardDescription>
          </CardHeader>
          {!searchQuery && selectedClient === 'all' && selectedAccount === 'all' && selectedStatus === 'all' && canCreateBudget && (
            <CardContent>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crea il tuo primo budget
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const creatorName = project.profiles 
              ? `${project.profiles.first_name} ${project.profiles.last_name}`.trim()
              : 'Utente sconosciuto';
            
            const accountName = project.account_profiles
              ? `${project.account_profiles.first_name} ${project.account_profiles.last_name}`.trim()
              : undefined;
            
            return (
              <ProjectCard 
                key={project.id} 
                project={project} 
                onUpdate={refetch}
                isOwner={project.user_id === currentUserId}
                showCreator={view === 'all'}
                creatorName={creatorName}
                accountName={accountName}
              />
            );
          })}
        </div>
      )}

      <CreateProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
};

export default Projects;
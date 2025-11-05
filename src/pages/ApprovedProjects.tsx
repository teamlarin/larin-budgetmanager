import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, TrendingUp, Clock, DollarSign, FolderOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProjectCard } from '@/components/ProjectCard';
import { supabase } from '@/integrations/supabase/client';
import type { Project } from '@/types/project';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type ProjectWithCreator = Project & {
  profiles: { first_name: string; last_name: string } | null;
  account_profiles: { first_name: string; last_name: string } | null;
};

const ApprovedProjects = () => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [canEditStatus, setCanEditStatus] = useState(false);

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
        // Editor and admin can edit status
        setCanEditStatus(userRole === 'admin' || userRole === 'editor');
      }
    });
  }, []);

  const { data: allProjects = [], isLoading, refetch } = useQuery<ProjectWithCreator[]>({
    queryKey: ['approved-projects'],
    queryFn: async () => {
      // Fetch only approved projects with clients
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .eq('status', 'approvato')
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

  const projects = allProjects.filter(project => {
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
    return true;
  });

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalProjects = allProjects.length;
    const totalBudget = allProjects.reduce((sum, p) => sum + (Number(p.total_budget) || 0), 0);
    const totalHours = allProjects.reduce((sum, p) => sum + (Number(p.total_hours) || 0), 0);

    // Group by client
    const byClient = allProjects.reduce((acc, p) => {
      const clientName = p.clients?.name || 'Senza cliente';
      if (!acc[clientName]) {
        acc[clientName] = { count: 0, budget: 0 };
      }
      acc[clientName].count += 1;
      acc[clientName].budget += Number(p.total_budget) || 0;
      return acc;
    }, {} as Record<string, { count: number; budget: number }>);

    const clientData = Object.entries(byClient).map(([name, data]) => ({
      name,
      progetti: data.count,
      budget: data.budget
    })).sort((a, b) => b.budget - a.budget).slice(0, 10);

    // Group by project type
    const byType = allProjects.reduce((acc, p) => {
      const type = p.project_type || 'Altro';
      if (!acc[type]) {
        acc[type] = { count: 0, budget: 0 };
      }
      acc[type].count += 1;
      acc[type].budget += Number(p.total_budget) || 0;
      return acc;
    }, {} as Record<string, { count: number; budget: number }>);

    const typeData = Object.entries(byType).map(([name, data]) => ({
      name,
      value: data.count,
      budget: data.budget
    }));

    return {
      totalProjects,
      totalBudget,
      totalHours,
      clientData,
      typeData
    };
  }, [allProjects]);

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

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
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Progetti
        </h1>
        <p className="text-muted-foreground">
          Dashboard dei progetti con preventivo approvato
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Totale Progetti
            </CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              Progetti approvati
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Budget Totale
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{statistics.totalBudget.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Somma di tutti i budget
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ore Totali
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics.totalHours.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Somma di tutte le ore
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Progetti per Cliente</CardTitle>
            <CardDescription>Top 10 clienti per budget totale</CardDescription>
          </CardHeader>
          <CardContent>
            {statistics.clientData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statistics.clientData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    className="text-xs"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                    formatter={(value: number) => `€${value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
                  />
                  <Legend />
                  <Bar dataKey="budget" fill="hsl(var(--primary))" name="Budget (€)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nessun dato disponibile
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progetti per Tipologia</CardTitle>
            <CardDescription>Distribuzione per tipo di progetto</CardDescription>
          </CardHeader>
          <CardContent>
            {statistics.typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statistics.typeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {statistics.typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nessun dato disponibile
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {projects.length} {projects.length === 1 ? 'Progetto' : 'Progetti'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca progetti per nome..."
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
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-12">
              <CardTitle className="mb-2">Nessun progetto trovato</CardTitle>
              <CardDescription>
                {searchQuery || selectedClient !== 'all' || selectedAccount !== 'all'
                  ? 'Nessun progetto trovato con i filtri applicati'
                  : 'Non ci sono ancora progetti approvati'
                }
              </CardDescription>
            </div>
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
                    showCreator={true}
                    creatorName={creatorName}
                    accountName={accountName}
                    canEditStatus={canEditStatus}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApprovedProjects;

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { BudgetStatusBadge } from '@/components/BudgetStatusBadge';
import type { Project } from '@/types/project';

type ProjectWithDetails = Project & {
  profiles: { first_name: string; last_name: string } | null;
  account_profiles: { first_name: string; last_name: string } | null;
};

const Index = () => {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: projects = [], isLoading, refetch } = useQuery<ProjectWithDetails[]>({
    queryKey: ['all-projects'],
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
      })) as ProjectWithDetails[] || [];
    },
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
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Budget Manager</h1>
          <p className="text-muted-foreground">
            Panoramica di tutti i budget
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuovo Budget
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Budget</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Proprietario</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nessun budget trovato
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project) => {
                  const creatorName = project.profiles 
                    ? `${project.profiles.first_name} ${project.profiles.last_name}`.trim()
                    : 'Utente sconosciuto';
                  
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

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectCard } from '@/components/ProjectCard';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { supabase } from '@/integrations/supabase/client';
import type { Project } from '@/types/project';

type ProjectWithCreator = Project & {
  profiles: { first_name: string; last_name: string } | null;
};

const Projects = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const view = searchParams.get('view') || 'mine';

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
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
      
      // Get unique user IDs
      const userIds = [...new Set(projectsData?.map(p => p.user_id) || [])];
      
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
        profiles: profilesMap.get(project.user_id) || null
      })) as ProjectWithCreator[] || [];
    },
  });

  const projects = view === 'mine' 
    ? allProjects.filter(p => p.user_id === currentUserId)
    : allProjects;

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
          <Button
            variant="outline"
            onClick={() => navigate('/')}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Tutti i Budget
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuovo Budget
          </Button>
        </div>
      </div>

      {projects.length === 0 ? (
        <Card className="text-center py-12">
          <CardHeader>
            <CardTitle>Nessun budget trovato</CardTitle>
            <CardDescription>
              Inizia creando il tuo primo budget per gestire costi e attività
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crea il tuo primo budget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const creatorName = project.profiles 
              ? `${project.profiles.first_name} ${project.profiles.last_name}`.trim()
              : 'Utente sconosciuto';
            
            return (
              <ProjectCard 
                key={project.id} 
                project={project} 
                onUpdate={refetch}
                isOwner={project.user_id === currentUserId}
                showCreator={view === 'all'}
                creatorName={creatorName}
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
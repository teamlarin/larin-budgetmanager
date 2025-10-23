import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Calendar, FolderKanban, User, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { generatePdfQuote } from '@/lib/generatePdfQuote';
import { BudgetManager } from '@/components/BudgetManager';
import { BudgetStatusBadge } from '@/components/BudgetStatusBadge';
import { BudgetStatusSelector } from '@/components/BudgetStatusSelector';
import { ProjectBriefLink } from '@/components/ProjectBriefLink';
import { supabase } from '@/integrations/supabase/client';
import type { Project } from '@/types/project';
import { useEffect, useState } from 'react';

const ProjectBudget = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [canEditStatus, setCanEditStatus] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const { data: project, isLoading, refetch } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required');
      
      // Fetch project with client info
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*, clients(name, address, phone, email, notes)')
        .eq('id', projectId)
        .single();
      
      if (projectError) throw projectError;
      
      // Fetch owner profile
      let ownerProfile = null;
      if (projectData.user_id) {
        const { data: ownerData } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', projectData.user_id)
          .single();
        ownerProfile = ownerData;
      }
      
      // Fetch account profile
      let accountProfile = null;
      if (projectData.account_user_id) {
        const { data: accountData } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', projectData.account_user_id)
          .single();
        accountProfile = accountData;
      }
      
      return {
        ...projectData,
        owner_profile: ownerProfile,
        account_profile: accountProfile
      } as Project & { 
        owner_profile?: { first_name: string; last_name: string } | null;
        account_profile?: { first_name: string; last_name: string } | null;
      };
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'editor'])
        .maybeSingle();

      setCanEditStatus(!!roleData);
    };

    checkUserRole();
  }, []);

  const handleGeneratePdf = async () => {
    if (!projectId || !project) return;
    
    setIsGeneratingPdf(true);
    try {
      // Fetch budget items
      const { data: budgetItems, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', projectId)
        .order('display_order');

      if (error) throw error;

      await generatePdfQuote({
        project,
        budgetItems: budgetItems || [],
      });

      toast({
        title: 'Preventivo generato',
        description: 'Il PDF è stato scaricato con successo.',
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante la generazione del PDF.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-4 bg-muted rounded w-64"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!project || !projectId) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Budget non trovato</h1>
          <Button onClick={() => navigate('/projects')}>
            Torna ai budget
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/projects')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna ai budget
          </Button>
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
                {project.description && (
                  <p className="text-muted-foreground mt-2">{project.description}</p>
                )}
              </div>
              <div className="flex items-start gap-3">
                {project.status === 'approvato' && (
                  <Button onClick={handleGeneratePdf} disabled={isGeneratingPdf} variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Genera preventivo (PDF)
                  </Button>
                )}
                <div>
                  {canEditStatus ? (
                    <BudgetStatusSelector
                      projectId={projectId}
                      projectName={project.name}
                      currentStatus={project.status}
                      onStatusChange={() => refetch()}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Stato:</span>
                      <BudgetStatusBadge 
                        status={project.status}
                        statusChangedAt={project.status_changed_at}
                      />
                    </div>
                  )}
                  {(project.status === 'approvato' || project.status === 'rifiutato') && project.status_changed_at && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {project.status === 'approvato' ? 'Approvato' : 'Rifiutato'} il {new Date(project.status_changed_at).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tipo:</span>
                <span className="text-sm font-medium">{project.project_type}</span>
              </div>
              {project.clients?.name && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Cliente:</span>
                  <span className="text-sm font-medium">{project.clients.name}</span>
                </div>
              )}
              {project.owner_profile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Creato da:</span>
                  <span className="font-medium text-foreground">
                    {project.owner_profile.first_name} {project.owner_profile.last_name}
                  </span>
                </div>
              )}
              {project.account_profile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Account:</span>
                  <span className="font-medium text-foreground">
                    {project.account_profile.first_name} {project.account_profile.last_name}
                  </span>
                </div>
              )}
              <ProjectBriefLink
                projectId={projectId}
                briefLink={project.brief_link}
                onUpdate={() => refetch()}
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Creato il:</span>
                <span className="font-medium text-foreground">
                  {new Date(project.created_at).toLocaleDateString('it-IT')}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <BudgetManager projectId={projectId} />
      </div>
    </div>
  );
};

export default ProjectBudget;
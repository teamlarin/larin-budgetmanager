import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Calendar, FolderKanban, User, FileText, Edit2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ProjectBudget = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [canEditStatus, setCanEditStatus] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

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

  useEffect(() => {
    const fetchClientsAndUsers = async () => {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('approved', true)
        .order('first_name');

      setClients(clientsData || []);
      setUsers(usersData || []);
    };

    fetchClientsAndUsers();
  }, []);

  const handleUpdateClient = async (clientId: string) => {
    if (!projectId) return;

    const { error } = await supabase
      .from('projects')
      .update({ client_id: clientId })
      .eq('id', projectId);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Errore durante l\'aggiornamento del cliente.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Cliente aggiornato',
      description: 'Il cliente è stato aggiornato con successo.',
    });
    
    setIsEditingClient(false);
    refetch();
  };

  const handleUpdateAccount = async (accountId: string) => {
    if (!projectId) return;

    const { error } = await supabase
      .from('projects')
      .update({ account_user_id: accountId })
      .eq('id', projectId);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Errore durante l\'aggiornamento dell\'account.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Account aggiornato',
      description: 'L\'account è stato aggiornato con successo.',
    });
    
    setIsEditingAccount(false);
    refetch();
  };

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
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cliente:</span>
                {isEditingClient ? (
                  <Select
                    value={project.client_id || ''}
                    onValueChange={(value) => {
                      handleUpdateClient(value);
                    }}
                  >
                    <SelectTrigger className="h-7 w-[200px]">
                      <SelectValue placeholder="Seleziona cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <span className="text-sm font-medium">
                      {project.clients?.name || 'Non specificato'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setIsEditingClient(true)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
              {project.owner_profile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Creato da:</span>
                  <span className="font-medium text-foreground">
                    {project.owner_profile.first_name} {project.owner_profile.last_name}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Account:</span>
                {isEditingAccount ? (
                  <Select
                    value={project.account_user_id || ''}
                    onValueChange={(value) => {
                      handleUpdateAccount(value);
                    }}
                  >
                    <SelectTrigger className="h-7 w-[200px]">
                      <SelectValue placeholder="Seleziona account" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <span className="font-medium text-foreground">
                      {project.account_profile 
                        ? `${project.account_profile.first_name} ${project.account_profile.last_name}`
                        : 'Non specificato'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setIsEditingAccount(true)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
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
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Calendar, FolderKanban, User, Edit2, Target, Check, X, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BudgetManager } from '@/components/BudgetManager';
import { ProjectBriefLink } from '@/components/ProjectBriefLink';
import { ProjectAuditLog } from '@/components/ProjectAuditLog';
import { ClientSelector } from '@/components/ClientSelector';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

const ProjectBudget = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [isEditingObjective, setIsEditingObjective] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');
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
      
      // Fetch latest quote for this project
      const { data: quoteData } = await supabase
        .from('quotes')
        .select('id, status')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
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
        account_profile: accountProfile,
        quote: quoteData
      } as Project & { 
        owner_profile?: { first_name: string; last_name: string } | null;
        account_profile?: { first_name: string; last_name: string } | null;
        quote?: { id: string; status: string } | null;
      };
    },
    enabled: !!projectId,
  });

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

  const handleUpdateObjective = async (objective: string) => {
    if (!projectId) return;

    const { error } = await supabase
      .from('projects')
      .update({ objective })
      .eq('id', projectId);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Errore durante l\'aggiornamento dell\'obiettivo.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Obiettivo aggiornato',
      description: 'L\'obiettivo è stato aggiornato con successo.',
    });
    
    setIsEditingObjective(false);
    refetch();
  };

  const handleUpdateDescription = async () => {
    if (!projectId) return;

    const { error } = await supabase
      .from('projects')
      .update({ description: descriptionValue })
      .eq('id', projectId);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Errore durante l\'aggiornamento della descrizione.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Descrizione aggiornata',
      description: 'La descrizione è stata aggiornata con successo.',
    });
    
    setIsEditingDescription(false);
    refetch();
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
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
                {isEditingDescription ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={descriptionValue}
                      onChange={(e) => setDescriptionValue(e.target.value)}
                      placeholder="Descrizione del progetto..."
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleUpdateDescription}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Salva
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsEditingDescription(false);
                          setDescriptionValue(project.description || '');
                        }}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Annulla
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 mt-2">
                    <p className="text-muted-foreground flex-1">{project.description || 'Nessuna descrizione'}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setDescriptionValue(project.description || '');
                        setIsEditingDescription(true);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Obiettivo:</span>
                  {isEditingObjective ? (
                    <Select
                      value={project.objective || ''}
                      onValueChange={(value) => {
                        handleUpdateObjective(value);
                      }}
                    >
                      <SelectTrigger className="h-7 w-[300px]">
                        <SelectValue placeholder="Seleziona obiettivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Brand positioning & Awareness">Brand positioning & Awareness</SelectItem>
                        <SelectItem value="Lead generation & Acquisition">Lead generation & Acquisition</SelectItem>
                        <SelectItem value="Customer experience & Digital Transformation">Customer experience & Digital Transformation</SelectItem>
                        <SelectItem value="Customer retention & Loyalty">Customer retention & Loyalty</SelectItem>
                        <SelectItem value="Sales enablement & Conversion">Sales enablement & Conversion</SelectItem>
                        <SelectItem value="Operational efficiency & AI Adoption">Operational efficiency & AI Adoption</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      <span className="text-sm font-medium">
                        {project.objective || 'Non specificato'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setIsEditingObjective(true)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Stato budget:</span>
                {project.quote ? (
                  <Badge 
                    variant={
                      project.quote.status === 'approved' ? 'default' :
                      project.quote.status === 'sent' ? 'secondary' :
                      project.quote.status === 'rejected' ? 'destructive' :
                      'outline'
                    }
                    className={
                      project.quote.status === 'approved' ? 'bg-green-500 hover:bg-green-600' : ''
                    }
                  >
                    {project.quote.status === 'approved' ? 'Approvato' :
                     project.quote.status === 'sent' ? 'Inviato' :
                     project.quote.status === 'rejected' ? 'Rifiutato' :
                     'Bozza'}
                  </Badge>
                ) : (
                  <Badge variant="outline">In attesa</Badge>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Modello:</span>
                <span className="text-sm font-medium">{project.project_type}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cliente:</span>
                {isEditingClient ? (
                  <ClientSelector
                    value={project.client_id || ''}
                    onValueChange={handleUpdateClient}
                    onCancel={() => setIsEditingClient(false)}
                    clients={clients}
                    onClientCreated={async () => {
                      const { data } = await supabase
                        .from('clients')
                        .select('*')
                        .order('name');
                      setClients(data || []);
                    }}
                  />
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

        <div className="mt-8">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="audit-log" className="border rounded-lg">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  <span className="text-lg font-semibold">Storico Modifiche</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <ProjectAuditLog projectId={projectId} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
};

export default ProjectBudget;
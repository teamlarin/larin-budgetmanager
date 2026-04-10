import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Calendar, FolderKanban, User, Edit2, Target, Check, X, FileText, Users, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BudgetManager } from '@/components/BudgetManager';
import { BudgetBriefLink } from '@/components/BudgetBriefLink';
import { BudgetAuditLog } from '@/components/BudgetAuditLog';
import { BudgetStatusSelector } from '@/components/BudgetStatusSelector';
import { BudgetStatusBadge } from '@/components/BudgetStatusBadge';
import { ClientSelector } from '@/components/ClientSelector';
import { ClientContactSelector } from '@/components/ClientContactSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { DISCIPLINE_LABELS, getDisciplineColor } from '@/lib/disciplineColors';
import { AREA_LABELS, getAreaColor } from '@/lib/areaColors';

const ProjectBudget = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [isEditingAssigned, setIsEditingAssigned] = useState(false);
  const [isEditingObjective, setIsEditingObjective] = useState(false);
  const [isEditingSecondaryObjective, setIsEditingSecondaryObjective] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingDiscipline, setIsEditingDiscipline] = useState(false);
  const [isEditingArea, setIsEditingArea] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [accountUsers, setAccountUsers] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [clientContacts, setClientContacts] = useState<any[]>([]);

  // Handle Google OAuth callback (for Drive reconnection)
  useEffect(() => {
    const handleGoogleAuthCallback = async () => {
      const hash = window.location.hash;
      
      if (hash.includes("google-auth-success=")) {
        try {
          const tokenDataStr = decodeURIComponent(hash.split("google-auth-success=")[1]);
          const tokenData = JSON.parse(tokenDataStr);
          
          const { error } = await supabase.functions.invoke("google-calendar-auth", {
            body: { action: "save-tokens", ...tokenData },
          });
          
          if (error) throw error;
          
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          toast({ title: "Successo", description: "Google ricollegato con successo!" });
        } catch (err) {
          console.error("Error saving Google tokens:", err);
          toast({ title: "Errore", description: "Impossibile salvare i token Google", variant: "destructive" });
        }
      } else if (hash.includes("google-auth-error=")) {
        const errorMsg = decodeURIComponent(hash.split("google-auth-error=")[1]);
        console.error("Google auth error:", errorMsg);
        toast({ title: "Errore autenticazione Google", description: errorMsg, variant: "destructive" });
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    };
    
    handleGoogleAuthCallback();
  }, [toast]);

  // Fetch current user role
  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        setUserRole(data?.role || null);
      }
    };
    fetchUserRole();
  }, []);

  const { data: project, isLoading, refetch } = useQuery({
    queryKey: ['budget', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Budget ID is required');
      
      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .select('*, clients(name, phone, email, notes, drive_folder_id)')
        .eq('id', projectId)
        .single();
      
      if (budgetError) throw budgetError;
      
      const { data: quoteData } = await supabase
        .from('quotes')
        .select('id, status, quote_number')
        .or(`budget_id.eq.${projectId},project_id.eq.${projectId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // Fetch contact info
      let contactProfile = null;
      if (budgetData.client_contact_id) {
        const { data: contactData } = await supabase
          .from('client_contacts')
          .select('id, first_name, last_name, role, email, phone')
          .eq('id', budgetData.client_contact_id)
          .single();
        contactProfile = contactData;
      }
      
      let ownerProfile = null;
      if (budgetData.user_id) {
        const { data: ownerData } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', budgetData.user_id)
          .single();
        ownerProfile = ownerData;
      }
      
      let accountProfile = null;
      if (budgetData.account_user_id) {
        const { data: accountData } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', budgetData.account_user_id)
          .single();
        accountProfile = accountData;
      }
      
      let assignedProfile = null;
      if (budgetData.assigned_user_id) {
        const { data: assignedData } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', budgetData.assigned_user_id)
          .single();
        assignedProfile = assignedData;
      }
      
      return {
        ...budgetData,
        owner_profile: ownerProfile,
        account_profile: accountProfile,
        assigned_profile: assignedProfile,
        contact_profile: contactProfile,
        quote: quoteData
      } as Project & { 
        owner_profile?: { first_name: string; last_name: string } | null;
        account_profile?: { first_name: string; last_name: string } | null;
        assigned_profile?: { first_name: string; last_name: string } | null;
        contact_profile?: { id: string; first_name: string; last_name: string; role: string | null; email: string | null; phone: string | null } | null;
        quote?: { id: string; status: string; quote_number: string } | null;
        secondary_objective?: string | null;
        discipline?: string | null;
        area?: string | null;
        client_contact_id?: string | null;
      };
    },
    enabled: !!projectId,
  });

  // Fetch clients, users, and contacts
  useEffect(() => {
    const fetchClientsAndUsers = async () => {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      
      const { data: usersData } = await supabase.rpc('get_profiles_by_roles', {
        role_filter: ['admin', 'team_leader', 'account', 'coordinator']
      });

      const { data: accountUsersData } = await supabase.rpc('get_profiles_by_roles', {
        role_filter: ['admin', 'account']
      });

      setClients(clientsData || []);
      setUsers(usersData || []);
      setAccountUsers(accountUsersData || []);
    };

    fetchClientsAndUsers();
  }, []);

  // Fetch client contacts when client changes
  useEffect(() => {
    const fetchContacts = async () => {
      if (!project?.client_id) {
        setClientContacts([]);
        return;
      }
      const { data } = await supabase
        .from('client_contacts')
        .select('id, first_name, last_name, role, email, phone')
        .eq('client_id', project.client_id)
        .order('first_name');
      setClientContacts(data || []);
    };
    fetchContacts();
  }, [project?.client_id]);

  const handleUpdateField = async (field: string, value: any, label: string) => {
    if (!projectId) return;
    const { error } = await supabase.from('budgets').update({ [field]: value }).eq('id', projectId);
    if (error) {
      toast({ title: 'Errore', description: `Errore durante l'aggiornamento.`, variant: 'destructive' });
      return;
    }
    toast({ title: `${label} aggiornato`, description: `${label} aggiornato con successo.` });
    refetch();
  };

  const handleUpdateClient = async (clientId: string) => {
    await handleUpdateField('client_id', clientId, 'Cliente');
    setIsEditingClient(false);
  };

  const handleUpdateAccount = async (accountId: string) => {
    await handleUpdateField('account_user_id', accountId, 'Account');
    setIsEditingAccount(false);
  };

  const handleUpdateAssigned = async (assignedId: string) => {
    await handleUpdateField('assigned_user_id', assignedId === '__none__' ? null : assignedId, 'Assegnazione');
    setIsEditingAssigned(false);
  };

  const handleUpdateContact = async (contactId: string) => {
    await handleUpdateField('client_contact_id', contactId || null, 'Referente');
  };

  const handleUpdateObjective = async (objective: string) => {
    await handleUpdateField('objective', objective, 'Obiettivo');
    setIsEditingObjective(false);
  };

  const handleUpdateSecondaryObjective = async (secondary_objective: string | null) => {
    await handleUpdateField('secondary_objective', secondary_objective, 'Obiettivo secondario');
    setIsEditingSecondaryObjective(false);
  };

  const handleUpdateDiscipline = async (discipline: string | null) => {
    await handleUpdateField('discipline', discipline, 'Disciplina');
    setIsEditingDiscipline(false);
  };

  const handleUpdateArea = async (area: string | null) => {
    await handleUpdateField('area', area, 'Area');
    setIsEditingArea(false);
  };

  const handleUpdateDescription = async () => {
    await handleUpdateField('description', descriptionValue, 'Descrizione');
    setIsEditingDescription(false);
  };

  const OBJECTIVES = [
    "Brand positioning & Awareness",
    "Lead generation & Acquisition",
    "Customer experience & Digital Transformation",
    "Customer retention & Loyalty",
    "Sales enablement & Conversion",
    "Operational efficiency & AI Adoption",
  ];

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
          <h1 className="page-title mb-4">Budget non trovato</h1>
          <Button onClick={() => navigate('/projects')}>Torna ai budget</Button>
        </div>
      </div>
    );
  }

  const quoteStatusConfig: Record<string, { label: string; className: string }> = {
    draft: { label: 'Bozza', className: 'bg-muted text-muted-foreground' },
    sent: { label: 'Inviato', className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
    approved: { label: 'Approvato', className: 'bg-green-500/10 text-green-700 dark:text-green-400' },
    rejected: { label: 'Rifiutato', className: 'bg-destructive/10 text-destructive' },
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Back button + Title row */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna ai budget
          </Button>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="page-title">{project.name}</h1>
              {/* Description inline edit */}
              {isEditingDescription ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={descriptionValue}
                    onChange={(e) => setDescriptionValue(e.target.value)}
                    placeholder="Descrizione del progetto..."
                    className="min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUpdateDescription}>
                      <Check className="h-3 w-3 mr-1" /> Salva
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setIsEditingDescription(false); setDescriptionValue(project.description || ''); }}>
                      <X className="h-3 w-3 mr-1" /> Annulla
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 mt-2">
                  <p className="text-muted-foreground flex-1 whitespace-pre-wrap">{project.description || 'Nessuna descrizione'}</p>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setDescriptionValue(project.description || ''); setIsEditingDescription(true); }}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <BudgetStatusSelector
              projectId={projectId}
              projectName={project.name}
              currentStatus={project.status}
              tableName="budgets"
              disabled={userRole === 'coordinator' || userRole === 'member'}
              onStatusChange={() => { refetch(); queryClient.invalidateQueries({ queryKey: ['budgets'] }); }}
            />
          </div>
        </div>

        {/* Quote banner */}
        {project.quote && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Preventivo collegato:</span>
            <Link to={`/quotes/${project.quote.id}`} className="text-sm text-primary hover:underline font-semibold">
              {project.quote.quote_number}
            </Link>
            <Badge className={quoteStatusConfig[project.quote.status]?.className || ''}>
              {quoteStatusConfig[project.quote.status]?.label || project.quote.status}
            </Badge>
          </div>
        )}

        {/* Two-card header */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Card Left: Dettagli progetto */}
          <Card variant="static">
            <CardHeader variant="compact">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                Dettagli progetto
              </CardTitle>
            </CardHeader>
            <CardContent variant="compact" className="space-y-3">
              {/* Modello */}
              <div className="flex items-center gap-2 text-sm">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Modello:</span>
                <span className="font-medium">{project.project_type}</span>
              </div>

              {/* Disciplina */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Disciplina:</span>
                {isEditingDiscipline ? (
                  <Select value={(project as any).discipline || ''} onValueChange={(v) => handleUpdateDiscipline(v === 'none' ? null : v)}>
                    <SelectTrigger className="h-7 w-[280px]">
                      <SelectValue placeholder="Seleziona disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuna</SelectItem>
                      {Object.entries(DISCIPLINE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    {(project as any).discipline ? (
                      <Badge variant="outline" className={getDisciplineColor((project as any).discipline)}>
                        {DISCIPLINE_LABELS[(project as any).discipline as keyof typeof DISCIPLINE_LABELS] || (project as any).discipline}
                      </Badge>
                    ) : (
                      <span className="font-medium">Non specificata</span>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsEditingDiscipline(true)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>

              {/* Area */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Area:</span>
                {isEditingArea ? (
                  <Select value={(project as any).area || ''} onValueChange={(v) => handleUpdateArea(v === 'none' ? null : v)}>
                    <SelectTrigger className="h-7 w-[200px]">
                      <SelectValue placeholder="Seleziona area" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuna</SelectItem>
                      {Object.entries(AREA_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    {(project as any).area ? (
                      <Badge variant="outline" className={getAreaColor((project as any).area)}>
                        {AREA_LABELS[(project as any).area as keyof typeof AREA_LABELS] || (project as any).area}
                      </Badge>
                    ) : (
                      <span className="font-medium">Non specificata</span>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsEditingArea(true)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>

              {/* Obiettivi */}
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Obiettivo:</span>
                {isEditingObjective ? (
                  <Select value={project.objective || ''} onValueChange={handleUpdateObjective}>
                    <SelectTrigger className="h-7 w-[280px]"><SelectValue placeholder="Seleziona obiettivo" /></SelectTrigger>
                    <SelectContent>
                      {OBJECTIVES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <span className="font-medium">{project.objective || 'Non specificato'}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsEditingObjective(true)}><Edit2 className="h-3 w-3" /></Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-muted-foreground ml-6">Secondario:</span>
                {isEditingSecondaryObjective ? (
                  <Select value={(project as any).secondary_objective || ''} onValueChange={(v) => handleUpdateSecondaryObjective(v === 'none' ? null : v)}>
                    <SelectTrigger className="h-7 w-[280px]"><SelectValue placeholder="Seleziona obiettivo secondario" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {OBJECTIVES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <span className="font-medium">{(project as any).secondary_objective || 'Non specificato'}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsEditingSecondaryObjective(true)}><Edit2 className="h-3 w-3" /></Button>
                  </>
                )}
              </div>

              {/* Brief link */}
              <BudgetBriefLink
                budgetId={projectId}
                briefLink={project.brief_link}
                clientDriveFolderId={(project.clients as any)?.drive_folder_id}
                onUpdate={() => refetch()}
              />

              {/* Data creazione */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Creato il:</span>
                <span className="font-medium text-foreground">
                  {new Date(project.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card Right: Persone e cliente */}
          <Card variant="static">
            <CardHeader variant="compact">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Persone e cliente
              </CardTitle>
            </CardHeader>
            <CardContent variant="compact" className="space-y-3">
              {/* Cliente */}
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Cliente:</span>
                {isEditingClient ? (
                  <ClientSelector
                    value={project.client_id || ''}
                    onValueChange={handleUpdateClient}
                    onCancel={() => setIsEditingClient(false)}
                    clients={clients}
                    onClientCreated={async () => {
                      const { data } = await supabase.from('clients').select('*').order('name');
                      setClients(data || []);
                    }}
                  />
                ) : (
                  <>
                    <span className="font-medium">{project.clients?.name || 'Non specificato'}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsEditingClient(true)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>

              {/* Referente */}
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Referente:</span>
                <ClientContactSelector
                  clientId={project.client_id || undefined}
                  value={(project as any).client_contact_id || undefined}
                  onValueChange={handleUpdateContact}
                  contacts={clientContacts}
                  onContactCreated={async () => {
                    if (project.client_id) {
                      const { data } = await supabase
                        .from('client_contacts')
                        .select('id, first_name, last_name, role, email, phone')
                        .eq('client_id', project.client_id)
                        .order('first_name');
                      setClientContacts(data || []);
                    }
                  }}
                  triggerClassName="h-7 w-[220px]"
                  placeholder="Seleziona referente"
                />
              </div>

              {/* Account */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Account:</span>
                {isEditingAccount ? (
                    <Select value={project.account_user_id || ''} onValueChange={handleUpdateAccount}>
                    <SelectTrigger className="h-7 w-[200px]"><SelectValue placeholder="Seleziona account" /></SelectTrigger>
                    <SelectContent>
                      {accountUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.first_name} {user.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <span className="font-medium text-foreground">
                      {project.account_profile ? `${project.account_profile.first_name} ${project.account_profile.last_name}` : 'Non specificato'}
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsEditingAccount(true)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>

              {/* Assegnato a */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Assegnato a:</span>
                {isEditingAssigned ? (
                  <Select value={(project as any).assigned_user_id || '__none__'} onValueChange={handleUpdateAssigned}>
                    <SelectTrigger className="h-7 w-[200px]"><SelectValue placeholder="Seleziona utente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessuno</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.first_name} {user.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <span className="font-medium text-foreground">
                      {(project as any).assigned_profile ? `${(project as any).assigned_profile.first_name} ${(project as any).assigned_profile.last_name}` : 'Non assegnato'}
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsEditingAssigned(true)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>

              {/* Creato da */}
              {project.owner_profile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Creato da:</span>
                  <span className="font-medium text-foreground">
                    {project.owner_profile.first_name} {project.owner_profile.last_name}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <BudgetManager projectId={projectId} />

        <div className="mt-8">
          <BudgetAuditLog budgetId={projectId} />
        </div>
      </div>
    </div>
  );
};

export default ProjectBudget;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Euro, Clock, MoreVertical, Trash2, Edit, Building2, User, FileText, Check, X } from 'lucide-react';
import { formatHours } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { BudgetStatusBadge } from './BudgetStatusBadge';
import { ClientSelector } from './ClientSelector';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generatePdfQuote } from '@/lib/generatePdfQuote';
import type { Project } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  onUpdate: () => void;
  isOwner?: boolean;
  showCreator?: boolean;
  creatorName?: string;
  accountName?: string;
  canEditStatus?: boolean;
}

export const ProjectCard = ({ project, onUpdate, isOwner = true, showCreator = false, creatorName, accountName, canEditStatus = false }: ProjectCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [editedName, setEditedName] = useState(project.name);
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
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

    fetchData();
  }, []);

  const handleUpdateName = async () => {
    if (!editedName.trim()) {
      toast({
        title: 'Errore',
        description: 'Il nome del budget non può essere vuoto.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('projects')
      .update({ name: editedName })
      .eq('id', project.id);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Errore durante l\'aggiornamento del nome.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Nome aggiornato',
      description: 'Il nome del budget è stato aggiornato con successo.',
    });
    
    setIsEditingName(false);
    onUpdate();
  };

  const handleUpdateClient = async (clientId: string) => {
    const { error } = await supabase
      .from('projects')
      .update({ client_id: clientId })
      .eq('id', project.id);

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
    onUpdate();
  };

  const handleUpdateOwner = async (ownerId: string) => {
    const { error } = await supabase
      .from('projects')
      .update({ user_id: ownerId })
      .eq('id', project.id);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Errore durante l\'aggiornamento del proprietario.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Proprietario aggiornato',
      description: 'Il proprietario è stato aggiornato con successo.',
    });
    
    setIsEditingOwner(false);
    onUpdate();
  };

  const handleUpdateAccount = async (accountId: string) => {
    const { error } = await supabase
      .from('projects')
      .update({ account_user_id: accountId })
      .eq('id', project.id);

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
    onUpdate();
  };

  const handleUpdateStatus = async (newStatus: 'in_attesa' | 'approvato' | 'rifiutato') => {
    const { error } = await supabase
      .from('projects')
      .update({ status: newStatus })
      .eq('id', project.id);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Errore durante l\'aggiornamento dello stato.',
        variant: 'destructive',
      });
      return;
    }

    // Send email notification if status changed to approved or rejected
    if (newStatus === 'approvato' || newStatus === 'rifiutato') {
      try {
        await supabase.functions.invoke('send-budget-notification', {
          body: {
            projectId: project.id,
            projectName: project.name,
            status: newStatus,
          },
        });
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
      }
    }

    toast({
      title: 'Stato aggiornato',
      description: 'Lo stato del budget è stato aggiornato con successo.',
    });
    
    setIsEditingStatus(false);
    onUpdate();
  };

  const handleDelete = async () => {
    if (!confirm('Sei sicuro di voler eliminare questo budget? Questa azione non può essere annullata.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) throw error;

      toast({
        title: 'Budget eliminato',
        description: 'Il budget è stato eliminato con successo.',
      });
      onUpdate();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante l\'eliminazione del budget.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGeneratePdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGeneratingPdf(true);
    try {
      // Fetch budget items
      const { data: budgetItems, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', project.id)
        .order('display_order');

      if (error) throw error;

      // Fetch client data
      let clientData = null;
      if (project.client_id) {
        const { data } = await supabase
          .from('clients')
          .select('name, address, phone, email, notes')
          .eq('id', project.client_id)
          .single();
        clientData = data;
      }

      // Fetch account profile if needed
      let accountProfile = null;
      if (project.account_user_id) {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', project.account_user_id)
          .single();
        accountProfile = data;
      }

      await generatePdfQuote({
        project: {
          ...project,
          clients: clientData,
          account_profile: accountProfile,
        },
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

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdateName();
                    if (e.key === 'Escape') {
                      setEditedName(project.name);
                      setIsEditingName(false);
                    }
                  }}
                />
                <Button size="sm" variant="ghost" onClick={handleUpdateName}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => {
                    setEditedName(project.name);
                    setIsEditingName(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group/title">
                <CardTitle 
                  className="text-lg line-clamp-1 cursor-pointer" 
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  {project.name}
                </CardTitle>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-0 group-hover/title:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingName(true);
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
            <CardDescription className="mt-1 line-clamp-2" onClick={() => navigate(`/projects/${project.id}`)}>
              {project.description || 'Nessuna descrizione'}
            </CardDescription>
          </div>
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Apri budget
                </DropdownMenuItem>
                {project.status === 'approvato' && (
                  <DropdownMenuItem onClick={handleGeneratePdf} disabled={isGeneratingPdf}>
                    <FileText className="h-4 w-4 mr-2" />
                    Genera preventivo (PDF)
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={handleDelete}
                  className="text-destructive"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-2 group/status">
            {isEditingStatus ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Select
                  value={project.status}
                  onValueChange={(value: 'in_attesa' | 'approvato' | 'rifiutato') => handleUpdateStatus(value)}
                >
                  <SelectTrigger className="h-7 w-[130px] text-xs">
                    <SelectValue>
                      <BudgetStatusBadge status={project.status} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_attesa">
                      <BudgetStatusBadge status="in_attesa" />
                    </SelectItem>
                    <SelectItem value="approvato">
                      <BudgetStatusBadge status="approvato" />
                    </SelectItem>
                    <SelectItem value="rifiutato">
                      <BudgetStatusBadge status="rifiutato" />
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingStatus(false);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <BudgetStatusBadge 
                  status={project.status}
                  statusChangedAt={project.status_changed_at}
                />
                {canEditStatus && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 opacity-0 group-hover/status:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingStatus(true);
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>
          <Badge variant="outline">{project.project_type}</Badge>
        </div>
      </CardHeader>
      <CardContent onClick={() => navigate(`/projects/${project.id}`)}>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Euro className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{project.total_budget.toFixed(2)} €</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{formatHours(project.total_hours)}</span>
          </div>
        </div>
        <div className="space-y-2 mt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground group/client">
            <Building2 className="h-3 w-3" />
            <span>Cliente: </span>
            {isEditingClient ? (
              <div onClick={(e) => e.stopPropagation()}>
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
                  triggerClassName="h-6 w-[150px] text-xs"
                  placeholder="Seleziona"
                />
              </div>
            ) : (
              <>
                <span className="font-medium">{project.clients?.name || 'Non specificato'}</span>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 opacity-0 group-hover/client:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingClient(true);
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              Creato il {new Date(project.created_at).toLocaleDateString('it-IT')}
            </span>
          </div>
          {showCreator && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground group/owner">
              <User className="h-3 w-3" />
              <span>Creato da: </span>
              {isEditingOwner ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={project.user_id || ''}
                    onValueChange={(value) => handleUpdateOwner(value)}
                  >
                    <SelectTrigger className="h-6 w-[150px] text-xs">
                      <SelectValue placeholder="Seleziona" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingOwner(false);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="font-medium">{creatorName || 'Non specificato'}</span>
                  {isOwner && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0 opacity-0 group-hover/owner:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingOwner(true);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
          {(accountName || isOwner) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground group/account">
              <User className="h-3 w-3" />
              <span>Account: </span>
              {isEditingAccount ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={project.account_user_id || ''}
                    onValueChange={(value) => handleUpdateAccount(value)}
                  >
                    <SelectTrigger className="h-6 w-[150px] text-xs">
                      <SelectValue placeholder="Seleziona" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingAccount(false);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="font-medium">{accountName || 'Non specificato'}</span>
                  {isOwner && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0 opacity-0 group-hover/account:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingAccount(true);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
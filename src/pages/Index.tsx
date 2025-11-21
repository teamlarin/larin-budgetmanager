import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, ArrowUpDown, Users, Trash2, Copy, MoreVertical, Edit, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { BudgetStatusBadge } from '@/components/BudgetStatusBadge';
import type { Project } from '@/types/project';
import { hasPermission } from '@/lib/permissions';

type ProjectWithDetails = Project & {
  profiles: { first_name: string; last_name: string } | null;
  account_profiles: { first_name: string; last_name: string } | null;
  clients: { name: string } | null;
};

type SortField = 'name' | 'client' | 'owner' | 'account' | 'amount' | 'status' | 'created' | null;
type SortDirection = 'asc' | 'desc';

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'client' | 'account' | 'status' | null>(null);
  const [editedName, setEditedName] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const { data: projects = [], isLoading, refetch } = useQuery<ProjectWithDetails[]>({
    queryKey: ['all-projects'],
    queryFn: async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      
      // Check user role
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        
        const role = roleData?.role as 'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null;
        setUserRole(role);
      }

      // Fetch clients and users
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

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Prevent row click navigation
    
    if (!confirm('Sei sicuro di voler eliminare questo budget? Questa azione non può essere annullata.')) {
      return;
    }

    setDeletingId(projectId);
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: 'Budget eliminato',
        description: 'Il budget è stato eliminato con successo.',
      });
      refetch();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante l\'eliminazione del budget.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Prevent row click navigation
    
    setDuplicatingId(projectId);
    try {
      // Get the original project
      const { data: originalProject, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (fetchError) throw fetchError;

      // Create the duplicated project
      const { data: newProject, error: createError } = await supabase
        .from('projects')
        .insert([{
          name: `${originalProject.name} (duplicato)`,
          description: originalProject.description,
          project_type: originalProject.project_type,
          client_id: originalProject.client_id,
          account_user_id: originalProject.account_user_id,
          user_id: currentUserId,
          status: 'in_attesa',
          total_budget: 0,
          total_hours: 0,
        }])
        .select()
        .single();

      if (createError) throw createError;

      // Get all budget items from the original project
      const { data: budgetItems, error: itemsError } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', projectId);

      if (itemsError) throw itemsError;

      // Duplicate budget items if any exist
      if (budgetItems && budgetItems.length > 0) {
        const duplicatedItems = budgetItems.map(item => ({
          project_id: newProject.id,
          category: item.category,
          activity_name: item.activity_name,
          assignee_id: item.assignee_id,
          assignee_name: item.assignee_name,
          hourly_rate: item.hourly_rate,
          hours_worked: item.hours_worked,
          total_cost: item.total_cost,
          is_custom_activity: item.is_custom_activity,
          display_order: item.display_order,
        }));

        const { error: insertItemsError } = await supabase
          .from('budget_items')
          .insert(duplicatedItems);

        if (insertItemsError) throw insertItemsError;

        // Update project totals
        const totalBudget = budgetItems.reduce((sum, item) => sum + item.total_cost, 0);
        const totalHours = budgetItems.reduce((sum, item) => sum + item.hours_worked, 0);

        await supabase
          .from('projects')
          .update({
            total_budget: totalBudget,
            total_hours: totalHours,
          })
          .eq('id', newProject.id);
      }

      toast({
        title: 'Budget duplicato',
        description: 'Il budget è stato duplicato con successo.',
      });
      refetch();
    } catch (error) {
      console.error('Error duplicating project:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante la duplicazione del budget.',
        variant: 'destructive',
      });
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleUpdateName = async (projectId: string, newName: string) => {
    if (!newName.trim()) {
      toast({
        title: 'Errore',
        description: 'Il nome del budget non può essere vuoto.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('projects')
      .update({ name: newName })
      .eq('id', projectId);

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
    
    setEditingProjectId(null);
    setEditingField(null);
    refetch();
  };

  const handleUpdateClient = async (projectId: string, clientId: string) => {
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
    
    setEditingProjectId(null);
    setEditingField(null);
    refetch();
  };

  const handleUpdateAccount = async (projectId: string, accountId: string) => {
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
    
    setEditingProjectId(null);
    setEditingField(null);
    refetch();
  };

  const handleUpdateStatus = async (projectId: string, newStatus: 'in_attesa' | 'approvato' | 'rifiutato', projectName: string) => {
    const { error } = await supabase
      .from('projects')
      .update({ status: newStatus })
      .eq('id', projectId);

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
            projectId,
            projectName,
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
    
    setEditingProjectId(null);
    setEditingField(null);
    refetch();
  };

  const startEditing = (projectId: string, field: 'name' | 'client' | 'account' | 'status', currentName?: string) => {
    setEditingProjectId(projectId);
    setEditingField(field);
    if (field === 'name' && currentName) {
      setEditedName(currentName);
    }
  };

  const cancelEditing = () => {
    setEditingProjectId(null);
    setEditingField(null);
    setEditedName('');
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
            {hasPermission(userRole, 'canViewAllProjects') && (
              <Button
                variant="outline"
                onClick={() => navigate('/projects?view=mine')}
              >
                <Users className="h-4 w-4 mr-2" />
                I Miei Budget
              </Button>
            )}
            {hasPermission(userRole, 'canCreateProjects') && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Budget
              </Button>
            )}
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
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                  
                  const canEdit = project.user_id === currentUserId || hasPermission(userRole, 'canEditProjects');
                  const isEditingName = editingProjectId === project.id && editingField === 'name';
                  const isEditingClient = editingProjectId === project.id && editingField === 'client';
                  const isEditingAccount = editingProjectId === project.id && editingField === 'account';
                  const isEditingStatus = editingProjectId === project.id && editingField === 'status';
                  
                  return (
                    <TableRow 
                      key={project.id}
                      className="cursor-pointer hover:bg-muted/50 group"
                      onClick={() => {
                        if (!editingProjectId) navigate(`/projects/${project.id}`);
                      }}
                    >
                      <TableCell className="font-medium" onClick={(e) => {
                        if (isEditingName || isEditingClient || isEditingAccount || isEditingStatus) {
                          e.stopPropagation();
                        }
                      }}>
                        {isEditingName ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editedName}
                              onChange={(e) => setEditedName(e.target.value)}
                              className="h-8"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateName(project.id, editedName);
                                if (e.key === 'Escape') cancelEditing();
                              }}
                            />
                            <Button size="sm" variant="ghost" onClick={() => handleUpdateName(project.id, editedName)}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEditing}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/name">
                            <span>{project.name}</span>
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 opacity-0 group-hover/name:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(project.id, 'name', project.name);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => {
                        if (isEditingName || isEditingClient || isEditingAccount || isEditingStatus) {
                          e.stopPropagation();
                        }
                      }}>
                        {isEditingClient ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={project.client_id || ''}
                              onValueChange={(value) => handleUpdateClient(project.id, value)}
                            >
                              <SelectTrigger className="h-8 w-[150px]">
                                <SelectValue placeholder="Seleziona" />
                              </SelectTrigger>
                              <SelectContent>
                                {clients.map((client) => (
                                  <SelectItem key={client.id} value={client.id}>
                                    {client.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEditing();
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/client">
                            <span>{project.clients?.name || '-'}</span>
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 opacity-0 group-hover/client:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(project.id, 'client');
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {creatorName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" onClick={(e) => {
                        if (isEditingName || isEditingClient || isEditingAccount || isEditingStatus) {
                          e.stopPropagation();
                        }
                      }}>
                        {isEditingAccount ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={project.account_user_id || ''}
                              onValueChange={(value) => handleUpdateAccount(project.id, value)}
                            >
                              <SelectTrigger className="h-8 w-[150px]">
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
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEditing();
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/account">
                            <span>{accountName}</span>
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 opacity-0 group-hover/account:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(project.id, 'account');
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(project.created_at).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {project.total_budget.toFixed(2)} €
                      </TableCell>
                      <TableCell onClick={(e) => {
                        if (isEditingName || isEditingClient || isEditingAccount || isEditingStatus) {
                          e.stopPropagation();
                        }
                      }}>
                        {isEditingStatus ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={project.status}
                              onValueChange={(value: 'in_attesa' | 'approvato' | 'rifiutato') => 
                                handleUpdateStatus(project.id, value, project.name)
                              }
                            >
                              <SelectTrigger className="h-8 w-[130px]">
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
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEditing();
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/status">
                            <BudgetStatusBadge 
                              status={project.status}
                              statusChangedAt={project.status_changed_at}
                            />
                            {hasPermission(userRole, 'canChangeProjectStatus') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 opacity-0 group-hover/status:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(project.id, 'status');
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {hasPermission(userRole, 'canEditProjects') && (project.user_id === currentUserId || hasPermission(userRole, 'canEditProjects')) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={(e) => handleDuplicate(e, project.id)}
                                disabled={duplicatingId === project.id}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Duplica
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => handleDelete(e, project.id)}
                                disabled={deletingId === project.id}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Elimina
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
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

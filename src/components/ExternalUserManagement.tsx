import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Trash2, FolderPlus, ExternalLink, Send, Eye } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface ExternalUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  approved: boolean;
  projects: { id: string; name: string }[];
}

export const ExternalUserManagement = () => {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [addProjectDialogUser, setAddProjectDialogUser] = useState<ExternalUser | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [removeAccess, setRemoveAccess] = useState<{ userId: string; projectId: string; projectName: string } | null>(null);
  const [removeUser, setRemoveUser] = useState<ExternalUser | null>(null);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [visibleUsersDialogUser, setVisibleUsersDialogUser] = useState<ExternalUser | null>(null);
  const [selectedVisibleUserIds, setSelectedVisibleUserIds] = useState<Set<string>>(new Set());

  // Fetch external users with their project access
  const { data: externalUsers = [], isLoading } = useQuery<ExternalUser[]>({
    queryKey: ['external-users'],
    queryFn: async () => {
      // Get all users with external role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'external');
      if (roleError) throw roleError;
      if (!roleData?.length) return [];

      const userIds = roleData.map(r => r.user_id);

      // Get profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, approved')
        .in('id', userIds);
      if (profileError) throw profileError;

      // Get project access
      const { data: accessData, error: accessError } = await supabase
        .from('external_project_access')
        .select('user_id, project_id, projects:project_id(id, name)')
        .in('user_id', userIds);
      if (accessError) throw accessError;

      // Build user list
      return (profiles || []).map(profile => ({
        id: profile.id,
        email: profile.email || '',
        first_name: profile.first_name,
        last_name: profile.last_name,
        approved: profile.approved || false,
        projects: (accessData || [])
          .filter(a => a.user_id === profile.id)
          .map(a => ({ id: (a.projects as any)?.id, name: (a.projects as any)?.name }))
          .filter(p => p.id),
      }));
    }
  });

  // Fetch approved projects for assignment
  const { data: availableProjects = [] } = useQuery({
    queryKey: ['projects-for-external-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, clients(name)')
        .eq('status', 'approvato')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // Invite external user
  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Inserisci un\'email valida');
      return;
    }
    setIsInviting(true);
    try {
      // Use Supabase admin invite (magic link)
      const { data, error } = await supabase.auth.signInWithOtp({
        email: inviteEmail.trim(),
        options: {
          data: {
            first_name: inviteFirstName.trim() || undefined,
            last_name: inviteLastName.trim() || undefined,
          }
        }
      });
      if (error) throw error;

      // We need to set the role to 'external' after the user confirms.
      // For now, store the intent. The handle_new_user trigger creates a 'member' role.
      // We'll need to update it once the user is created.
      // Store a pending external invite in app_settings or handle via admin after user signs up.
      
      toast.success(`Invito inviato a ${inviteEmail}`, {
        description: 'L\'utente riceverà un link magico per accedere. Dopo il primo accesso, imposta il ruolo su "external" dalla gestione utenti.'
      });
      
      setInviteEmail('');
      setInviteFirstName('');
      setInviteLastName('');
    } catch (error: any) {
      toast.error('Errore nell\'invio dell\'invito', { description: error.message });
    } finally {
      setIsInviting(false);
    }
  };

  // Add project access
  const addProjectAccess = useMutation({
    mutationFn: async ({ userId, projectId }: { userId: string; projectId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('external_project_access')
        .insert({
          user_id: userId,
          project_id: projectId,
          granted_by: user?.id
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-users'] });
      setAddProjectDialogUser(null);
      setSelectedProjectId('');
      toast.success('Progetto assegnato');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('L\'utente ha già accesso a questo progetto');
      } else {
        toast.error('Errore nell\'assegnazione', { description: error.message });
      }
    }
  });

  // Remove project access
  const removeProjectAccess = useMutation({
    mutationFn: async ({ userId, projectId }: { userId: string; projectId: string }) => {
      const { error } = await supabase
        .from('external_project_access')
        .delete()
        .eq('user_id', userId)
        .eq('project_id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-users'] });
      setRemoveAccess(null);
      toast.success('Accesso al progetto rimosso');
    },
    onError: (error: any) => {
      toast.error('Errore nella rimozione', { description: error.message });
    }
  });

  const getFilteredProjects = (userId: string) => {
    const userProjects = externalUsers.find(u => u.id === userId)?.projects || [];
    const assignedIds = new Set(userProjects.map(p => p.id));
    return availableProjects.filter(p => !assignedIds.has(p.id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          Utenti Esterni
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite Section */}
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium">Invita utente esterno</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="email@esempio.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invite-first">Nome</Label>
              <Input
                id="invite-first"
                placeholder="Nome"
                value={inviteFirstName}
                onChange={e => setInviteFirstName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invite-last">Cognome</Label>
              <Input
                id="invite-last"
                placeholder="Cognome"
                value={inviteLastName}
                onChange={e => setInviteLastName(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            {isInviting ? 'Invio in corso...' : 'Invia invito'}
          </Button>
          <p className="text-xs text-muted-foreground">
            L'utente riceverà un magic link via email. Dopo il primo accesso, assegna il ruolo "external" dalla tab Utenti e poi assegna i progetti qui sotto.
          </p>
        </div>

        {/* External Users List */}
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        ) : externalUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nessun utente esterno configurato.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Progetti assegnati</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {externalUsers.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.first_name || ''} {user.last_name || ''}
                    {!user.approved && (
                      <Badge variant="outline" className="ml-2 text-xs">Non approvato</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.projects.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Nessun progetto</span>
                      ) : (
                        user.projects.map(p => (
                          <Badge key={p.id} variant="secondary" className="text-xs">
                            {p.name}
                            <button
                              className="ml-1 hover:text-destructive"
                              onClick={() => setRemoveAccess({ userId: user.id, projectId: p.id, projectName: p.name })}
                            >
                              ×
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddProjectDialogUser(user)}
                    >
                      <FolderPlus className="h-3 w-3 mr-1" />
                      Progetto
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Add Project Dialog */}
        <Dialog open={!!addProjectDialogUser} onOpenChange={() => setAddProjectDialogUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Assegna progetto a {addProjectDialogUser?.first_name} {addProjectDialogUser?.last_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Progetto</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona un progetto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {addProjectDialogUser && getFilteredProjects(addProjectDialogUser.id).map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {(p.clients as any)?.name ? `(${(p.clients as any).name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddProjectDialogUser(null)}>Annulla</Button>
              <Button
                onClick={() => addProjectDialogUser && selectedProjectId && addProjectAccess.mutate({ userId: addProjectDialogUser.id, projectId: selectedProjectId })}
                disabled={!selectedProjectId || addProjectAccess.isPending}
              >
                Assegna
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Access Confirmation */}
        <AlertDialog open={!!removeAccess} onOpenChange={() => setRemoveAccess(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rimuovi accesso al progetto</AlertDialogTitle>
              <AlertDialogDescription>
                Vuoi rimuovere l'accesso al progetto "{removeAccess?.projectName}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removeAccess && removeProjectAccess.mutate({ userId: removeAccess.userId, projectId: removeAccess.projectId })}
              >
                Rimuovi
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Permission } from "@/lib/permissions";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2 } from "lucide-react";

const RolesDocumentation = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { permissions, loading: permissionsLoading, updatePermission } = useRolePermissions();
  const [updatingCell, setUpdatingCell] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking user role:', error);
        navigate('/');
        return;
      }

      // Solo admin può accedere a questa pagina
      if (roleData?.role !== 'admin') {
        navigate('/');
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    } catch (error) {
      console.error('Unexpected error:', error);
      navigate('/');
    }
  };

  const handleTogglePermission = async (role: string, permissionKey: keyof Permission, currentValue: boolean) => {
    // Admin role permissions cannot be modified
    if (role === 'admin') {
      toast({
        title: "Non modificabile",
        description: "I permessi dell'Admin non possono essere modificati",
        variant: "destructive",
      });
      return;
    }

    const cellKey = `${role}-${permissionKey}`;
    setUpdatingCell(cellKey);

    const success = await updatePermission(role, permissionKey, !currentValue);
    
    if (success) {
      toast({
        title: "Permesso aggiornato",
        description: `Permesso ${!currentValue ? 'abilitato' : 'disabilitato'} per ${roleLabels[role as keyof typeof roleLabels]}`,
      });
    } else {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il permesso",
        variant: "destructive",
      });
    }

    setUpdatingCell(null);
  };

  if (loading || permissionsLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Caricamento...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roles: Array<'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member'> = [
    'admin',
    'account',
    'finance',
    'team_leader',
    'coordinator',
    'member'
  ];

  const permissionLabels: Record<keyof Permission, string> = {
    canAccessSettings: "Accesso Impostazioni",
    canManageUsers: "Gestione Utenti",
    canManageClients: "Gestione Clienti",
    canManageProducts: "Gestione Prodotti",
    canManageServices: "Gestione Servizi",
    canManageLevels: "Gestione Livelli",
    canManageCategories: "Gestione Categorie",
    canManageTemplates: "Gestione Template",
    canCreateProjects: "Creazione Progetti",
    canEditProjects: "Modifica Progetti",
    canDeleteProjects: "Eliminazione Progetti",
    canChangeProjectStatus: "Cambio Stato Progetti",
    canEditBudget: "Modifica Budget",
    canEditFinancialFields: "Modifica Margini/Sconti",
    canViewAllProjects: "Visualizzazione Tutti i Progetti",
    canCreateQuotes: "Creazione Preventivi",
    canEditQuotes: "Modifica Preventivi",
    canDeleteQuotes: "Eliminazione Preventivi",
    canDownloadQuotes: "Download Preventivi",
    canPublishProgressUpdate: "Aggiornamento Progresso Progetti"
  };

  const roleLabels = {
    admin: "Admin",
    account: "Account",
    finance: "Finance",
    team_leader: "Team Leader",
    coordinator: "Coordinator",
    member: "Member"
  };

  const roleDescriptions = {
    admin: "Accesso completo a tutte le funzionalità del sistema",
    account: "Gestione completa di progetti, budget, clienti e impostazioni (esclusa gestione utenti)",
    finance: "Gestione aspetti finanziari: visualizzazione progetti, modifica margini/sconti, gestione preventivi",
    team_leader: "Creazione e modifica progetti e budget, visualizzazione preventivi",
    coordinator: "Modifica progetti e budget, visualizzazione di tutti i progetti e preventivi",
    member: "Visualizzazione progetti assegnati e contribuzione ai budget"
  };

  return (
    <div className="page-container stack-lg">
      <div className="page-header">
        <h1 className="page-title">Documentazione Ruoli e Permessi</h1>
        <p className="page-subtitle">
          Panoramica completa dei permessi per ogni ruolo utente. Clicca sugli switch per modificare i permessi.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <Card key={role}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant={role}>
                  {roleLabels[role]}
                </Badge>
              </CardTitle>
              <CardDescription>
                {roleDescriptions[role]}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matrice Permessi</CardTitle>
          <CardDescription>
            Tabella dettagliata dei permessi per ogni ruolo. I permessi dell'Admin non sono modificabili.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Permesso</TableHead>
                  {roles.map((role) => (
                    <TableHead key={role} className="text-center min-w-[100px]">
                      {roleLabels[role]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Object.keys(permissionLabels) as Array<keyof Permission>).map((permission) => (
                  <TableRow key={permission}>
                    <TableCell className="font-medium">
                      {permissionLabels[permission]}
                    </TableCell>
                    {roles.map((role) => {
                      const rolePermissions = permissions[role];
                      const hasPermission = rolePermissions?.[permission] ?? false;
                      const cellKey = `${role}-${permission}`;
                      const isUpdating = updatingCell === cellKey;
                      const isAdminRole = role === 'admin';

                      return (
                        <TableCell key={role} className="text-center">
                          {isUpdating ? (
                            <Loader2 className="inline-block h-4 w-4 animate-spin text-muted-foreground" />
                          ) : isAdminRole ? (
                            // Admin permissions are always shown as checkmarks (not editable)
                            hasPermission ? (
                              <Check className="inline-block h-5 w-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <X className="inline-block h-5 w-5 text-muted-foreground" />
                            )
                          ) : (
                            <Switch
                              checked={hasPermission}
                              onCheckedChange={() => handleTogglePermission(role, permission, hasPermission)}
                              className="data-[state=checked]:bg-green-600"
                            />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RolesDocumentation;

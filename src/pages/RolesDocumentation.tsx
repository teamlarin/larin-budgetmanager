import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getRolePermissions, Permission } from "@/lib/permissions";
import { Check, X } from "lucide-react";

const RolesDocumentation = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

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

      setLoading(false);
    } catch (error) {
      console.error('Unexpected error:', error);
      navigate('/');
    }
  };

  if (loading) {
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

  const roles: Array<'admin' | 'account' | 'finance' | 'team_leader' | 'member'> = [
    'admin',
    'account',
    'finance',
    'team_leader',
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
    canDownloadQuotes: "Download Preventivi"
  };

  const roleLabels = {
    admin: "Admin",
    account: "Account",
    finance: "Finance",
    team_leader: "Team Leader",
    member: "Member"
  };

  const roleDescriptions = {
    admin: "Accesso completo a tutte le funzionalità del sistema",
    account: "Gestione completa di progetti, budget, clienti e impostazioni (esclusa gestione utenti)",
    finance: "Gestione aspetti finanziari: visualizzazione progetti, modifica margini/sconti, gestione preventivi",
    team_leader: "Creazione e modifica progetti e budget, visualizzazione preventivi",
    member: "Visualizzazione progetti assegnati e contribuzione ai budget"
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Documentazione Ruoli e Permessi</h1>
        <p className="text-muted-foreground">
          Panoramica completa dei permessi per ogni ruolo utente
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <Card key={role}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant={
                  role === 'admin' ? 'default' :
                  role === 'account' ? 'secondary' :
                  role === 'finance' ? 'outline' :
                  role === 'team_leader' ? 'outline' :
                  'outline'
                }>
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
            Tabella dettagliata dei permessi per ogni ruolo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Permesso</TableHead>
                  {roles.map((role) => (
                    <TableHead key={role} className="text-center">
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
                      const permissions = getRolePermissions(role);
                      const hasPermission = permissions[permission];
                      return (
                        <TableCell key={role} className="text-center">
                          {hasPermission ? (
                            <Check className="inline-block h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <X className="inline-block h-5 w-5 text-muted-foreground" />
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

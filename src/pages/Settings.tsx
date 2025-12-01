import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/UserManagement";
import { ClientManagement } from "@/components/ClientManagement";
import { BudgetTemplateManagement } from "@/components/BudgetTemplateManagement";
import { LevelManagement } from "@/components/LevelManagement";
import { ActivityCategoryManagement } from "@/components/ActivityCategoryManagement";
import { ProductManagement } from "@/components/ProductManagement";
import { ServiceManagement } from "@/components/ServiceManagement";
import { DisciplineMappingManagement } from "@/components/DisciplineMappingManagement";
import { GlobalSettingsManagement } from "@/components/GlobalSettingsManagement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getRolePermissions } from "@/lib/permissions";
import { BookOpen } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null>(null);

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
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
        setLoading(false);
        return;
      }

      const role = roleData?.role as 'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null;
      const permissions = getRolePermissions(role);
      
      // Check if user can access settings
      if (!permissions.canAccessSettings) {
        navigate('/profile');
        return;
      }

      setUserRole(role);
      setLoading(false);
    } catch (error) {
      console.error('Unexpected error:', error);
      setLoading(false);
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

  const permissions = getRolePermissions(userRole);
  const defaultTab = permissions.canManageUsers ? "users" : permissions.canManageClients ? "clients" : "mappings";

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Impostazioni</h1>
          <p className="text-muted-foreground">
            Gestisci utenti, clienti e template di budget
          </p>
        </div>
        {permissions.canManageUsers && (
          <Button
            variant="outline"
            onClick={() => navigate('/roles-documentation')}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Documentazione Ruoli
          </Button>
        )}
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          {permissions.canManageUsers && <TabsTrigger value="users">Utenti</TabsTrigger>}
          {permissions.canManageClients && <TabsTrigger value="clients">Clienti</TabsTrigger>}
          {permissions.canManageProducts && <TabsTrigger value="products">Prodotti</TabsTrigger>}
          {permissions.canManageServices && <TabsTrigger value="services">Servizi</TabsTrigger>}
          {permissions.canManageLevels && <TabsTrigger value="levels">Livelli</TabsTrigger>}
          {permissions.canManageCategories && <TabsTrigger value="categories">Categorie Attività</TabsTrigger>}
          {permissions.canManageTemplates && <TabsTrigger value="templates">Template Budget</TabsTrigger>}
          {(permissions.canAccessSettings) && <TabsTrigger value="mappings">Mapping Discipline</TabsTrigger>}
          {permissions.canManageUsers && <TabsTrigger value="global">Impostazioni Globali</TabsTrigger>}
        </TabsList>

        {permissions.canManageUsers && (
          <TabsContent value="users">
            <UserManagement />
          </TabsContent>
        )}

        {permissions.canManageClients && (
          <TabsContent value="clients">
            <ClientManagement />
          </TabsContent>
        )}

        {permissions.canManageProducts && (
          <TabsContent value="products">
            <ProductManagement />
          </TabsContent>
        )}

        {permissions.canManageServices && (
          <TabsContent value="services">
            <ServiceManagement />
          </TabsContent>
        )}

        {permissions.canManageLevels && (
          <TabsContent value="levels">
            <LevelManagement />
          </TabsContent>
        )}

        {permissions.canManageCategories && (
          <TabsContent value="categories">
            <ActivityCategoryManagement />
          </TabsContent>
        )}

        {permissions.canManageTemplates && (
          <TabsContent value="templates">
            <BudgetTemplateManagement />
          </TabsContent>
        )}

        {permissions.canAccessSettings && (
          <TabsContent value="mappings">
            <DisciplineMappingManagement />
          </TabsContent>
        )}

        {permissions.canManageUsers && (
          <TabsContent value="global">
            <GlobalSettingsManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Settings;

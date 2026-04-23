import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/UserManagement";
import { ClientManagement } from "@/components/ClientManagement";
import { ContactManagement } from "@/components/ContactManagement";
import { SupplierManagement } from "@/components/SupplierManagement";
import { BudgetTemplateManagement } from "@/components/BudgetTemplateManagement";
import { LevelManagement } from "@/components/LevelManagement";
import { ActivityCategoryManagement } from "@/components/ActivityCategoryManagement";
import { ProductManagement } from "@/components/ProductManagement";
import { ServiceManagement } from "@/components/ServiceManagement";
import { DisciplineMappingManagement } from "@/components/DisciplineMappingManagement";
import { GlobalSettingsManagement } from "@/components/GlobalSettingsManagement";
import { ProductServiceCategoryManagement } from "@/components/ProductServiceCategoryManagement";
import { PaymentTermsManagement } from "@/components/PaymentTermsManagement";
import { PaymentModesManagement } from "@/components/PaymentModesManagement";
import { IntegrationsTab } from "@/components/IntegrationsTab";
import { PerformanceReviewManagement } from "@/components/PerformanceReviewManagement";


import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getRolePermissions } from "@/lib/permissions";
import { BookOpen, Palette, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member' | 'external' | null>(null);

  // Handle Google OAuth callback
  useEffect(() => {
    const handleGoogleAuthCallback = async () => {
      const hash = window.location.hash;
      
      if (hash.includes("google-auth-success=")) {
        try {
          const tokenDataStr = decodeURIComponent(hash.split("google-auth-success=")[1]);
          const tokenData = JSON.parse(tokenDataStr);
          
          // Save tokens via edge function
          const { error } = await supabase.functions.invoke("google-calendar-auth", {
            body: { 
              action: "save-tokens",
              ...tokenData 
            },
          });
          
          if (error) throw error;
          
          // Clear hash and show success
          window.history.replaceState(null, "", window.location.pathname);
          toast({ title: "Successo", description: "Google ricollegato con successo!" });
        } catch (err) {
          console.error("Error saving Google tokens:", err);
          toast({ title: "Errore", description: "Impossibile salvare i token Google", variant: "destructive" });
        }
      } else if (hash.includes("google-auth-error=")) {
        const errorMsg = decodeURIComponent(hash.split("google-auth-error=")[1]);
        console.error("Google auth error:", errorMsg);
        toast({ title: "Errore autenticazione Google", description: errorMsg, variant: "destructive" });
        window.history.replaceState(null, "", window.location.pathname);
      }
    };
    
    handleGoogleAuthCallback();
  }, [toast]);

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

      const role = roleData?.role as 'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member' | 'external' | null;
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
  const defaultTab = permissions.canManageUsers ? "general" : permissions.canManageClients ? "clients" : "mappings";

  return (
    <div className="page-container stack-lg">
      <div className="page-header-with-actions">
        <h1 className="page-title">Impostazioni</h1>
        {permissions.canManageUsers && (
          <div className="row-sm">
            <Button
              variant="outline"
              onClick={() => navigate('/settings/help-feedback')}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Feedback Guida
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/style-guide')}
            >
              <Palette className="mr-2 h-4 w-4" />
              Design System
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/roles-documentation')}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Documentazione ruoli
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          {permissions.canManageUsers && <TabsTrigger value="general">Generali</TabsTrigger>}
          {permissions.canManageUsers && <TabsTrigger value="users">Utenti</TabsTrigger>}
          {permissions.canManageClients && <TabsTrigger value="clients">Clienti</TabsTrigger>}
          {permissions.canManageClients && <TabsTrigger value="contacts">Contatti</TabsTrigger>}
          {permissions.canManageClients && <TabsTrigger value="suppliers">Fornitori</TabsTrigger>}
          {permissions.canManageProducts && <TabsTrigger value="products">Prodotti</TabsTrigger>}
          {permissions.canManageServices && <TabsTrigger value="services">Servizi</TabsTrigger>}
          {(permissions.canManageCategories || permissions.canAccessSettings) && userRole !== 'account' && userRole !== 'team_leader' && <TabsTrigger value="categories-mappings">Categorie</TabsTrigger>}
          {permissions.canManageTemplates && <TabsTrigger value="templates">Template Budget</TabsTrigger>}
          {permissions.canManageUsers && <TabsTrigger value="payment-terms">Pagamenti</TabsTrigger>}
          {permissions.canManageUsers && <TabsTrigger value="integrations">Integrazioni</TabsTrigger>}
          {(permissions.canManageUsers || userRole === 'team_leader') && <TabsTrigger value="performance">Performance</TabsTrigger>}
        </TabsList>

        {permissions.canManageUsers && (
          <TabsContent value="general" className="space-y-6">
            <GlobalSettingsManagement />
          </TabsContent>
        )}

        {permissions.canManageUsers && (
          <TabsContent value="users" className="space-y-6">
            <UserManagement />
            <LevelManagement />
          </TabsContent>
        )}

        {permissions.canManageClients && (
          <TabsContent value="clients">
            <ClientManagement />
          </TabsContent>
        )}

        {permissions.canManageClients && (
          <TabsContent value="contacts">
            <ContactManagement />
          </TabsContent>
        )}

        {permissions.canManageClients && (
          <TabsContent value="suppliers">
            <SupplierManagement />
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

        {(permissions.canManageCategories || permissions.canAccessSettings) && userRole !== 'account' && userRole !== 'team_leader' && (
          <TabsContent value="categories-mappings" className="space-y-6">
            {permissions.canManageCategories && <ActivityCategoryManagement />}
            <ProductServiceCategoryManagement />
            {permissions.canAccessSettings && <DisciplineMappingManagement />}
          </TabsContent>
        )}

        {permissions.canManageTemplates && (
          <TabsContent value="templates">
            <BudgetTemplateManagement />
          </TabsContent>
        )}

        {permissions.canManageUsers && (
          <TabsContent value="payment-terms" className="space-y-6">
            <PaymentModesManagement />
            <PaymentTermsManagement />
          </TabsContent>
        )}

        {permissions.canManageUsers && (
          <TabsContent value="integrations" className="space-y-6">
            <IntegrationsTab />
          </TabsContent>
        )}

        {(permissions.canManageUsers || userRole === 'team_leader') && (
          <TabsContent value="performance" className="space-y-6">
            <PerformanceReviewManagement />
          </TabsContent>
        )}


      </Tabs>
    </div>
  );
};

export default Settings;

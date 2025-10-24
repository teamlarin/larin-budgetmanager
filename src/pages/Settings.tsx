import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/UserManagement";
import { ClientManagement } from "@/components/ClientManagement";
import { BudgetTemplateManagement } from "@/components/BudgetTemplateManagement";
import { LevelManagement } from "@/components/LevelManagement";
import { ActivityCategoryManagement } from "@/components/ActivityCategoryManagement";
import { ProductManagement } from "@/components/ProductManagement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

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
        .eq('user_id', user.id);

      if (error) {
        console.error('Error checking user role:', error);
        setLoading(false);
        return;
      }

      // Check if user has admin or editor role
      const hasRequiredRole = roleData?.some(
        (r) => r.role === 'admin' || r.role === 'editor'
      );

      if (!hasRequiredRole) {
        // User is a subscriber, redirect to profile
        navigate('/profile');
        return;
      }

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Impostazioni</h1>
        <p className="text-muted-foreground">
          Gestisci utenti, clienti e template di budget
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Utenti</TabsTrigger>
          <TabsTrigger value="clients">Clienti</TabsTrigger>
          <TabsTrigger value="products">Prodotti</TabsTrigger>
          <TabsTrigger value="levels">Livelli</TabsTrigger>
          <TabsTrigger value="categories">Categorie Attività</TabsTrigger>
          <TabsTrigger value="templates">Template Budget</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="clients">
          <ClientManagement />
        </TabsContent>

        <TabsContent value="products">
          <ProductManagement />
        </TabsContent>

        <TabsContent value="levels">
          <LevelManagement />
        </TabsContent>

        <TabsContent value="categories">
          <ActivityCategoryManagement />
        </TabsContent>

        <TabsContent value="templates">
          <BudgetTemplateManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;

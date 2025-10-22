import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/UserManagement";
import { ClientManagement } from "@/components/ClientManagement";
import { BudgetTemplateManagement } from "@/components/BudgetTemplateManagement";
import { LevelManagement } from "@/components/LevelManagement";
import { ActivityCategoryManagement } from "@/components/ActivityCategoryManagement";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'editor'])
      .maybeSingle();

    if (!roleData) {
      // User is a subscriber, redirect to profile
      navigate('/profile');
      return;
    }

    setLoading(false);
  };

  if (loading) {
    return null;
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

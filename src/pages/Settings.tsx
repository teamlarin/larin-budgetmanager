import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { UserManagement } from "@/components/UserManagement";
import { ClientManagement } from "@/components/ClientManagement";
import { BudgetTemplateManagement } from "@/components/BudgetTemplateManagement";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (error) {
      console.error("Error checking admin status:", error);
      toast({
        title: "Errore",
        description: "Impossibile verificare i permessi",
        variant: "destructive",
      });
    }

    setIsAdmin(!!data);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Accesso negato</CardTitle>
            <CardDescription>
              Non hai i permessi necessari per accedere a questa sezione
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate("/")} className="w-full">
              Torna alla home
            </Button>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              Esci
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Impostazioni</h1>
              <p className="text-muted-foreground">
                Gestisci utenti, clienti e modelli di budget
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Esci
          </Button>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users">Utenti</TabsTrigger>
            <TabsTrigger value="clients">Clienti</TabsTrigger>
            <TabsTrigger value="templates">Modelli di Budget</TabsTrigger>
          </TabsList>
          
          <TabsContent value="users" className="mt-6">
            <UserManagement />
          </TabsContent>
          
          <TabsContent value="clients" className="mt-6">
            <ClientManagement />
          </TabsContent>
          
          <TabsContent value="templates" className="mt-6">
            <BudgetTemplateManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;

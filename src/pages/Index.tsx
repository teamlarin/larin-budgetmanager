import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderOpen, Plus, Settings } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        checkUserStatus(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        checkUserStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkUserStatus = async (userId: string) => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("approved")
      .eq("id", userId)
      .single();

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    setIsApproved(profileData?.approved || false);
    setIsAdmin(!!roleData);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!user || loading) {
    return null;
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Account in Attesa di Approvazione</CardTitle>
            <CardDescription>
              Il tuo account è stato creato con successo ma deve essere approvato da un amministratore.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Riceverai una notifica via email quando il tuo account sarà stato approvato.
            </p>
            <Button className="w-full" onClick={handleLogout}>
              Esci
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex justify-end mb-4 gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Impostazioni
            </Button>
          )}
          <Button variant="outline" onClick={handleLogout}>
            Esci
          </Button>
        </div>
        <div className="text-center space-y-6 py-12">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">Budget Manager</h1>
            <p className="text-xl text-muted-foreground">
              Gestisci budget e costi in modo professionale
            </p>
          </div>

          <div className="max-w-2xl mx-auto grid gap-4 md:grid-cols-2">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/projects')}>
              <CardHeader className="text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-primary mb-2" />
                <CardTitle>I Miei Budget</CardTitle>
                <CardDescription>
                  Visualizza e gestisci tutti i tuoi budget esistenti
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Vai ai Budget
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/projects')}>
              <CardHeader className="text-center">
                <Plus className="h-12 w-12 mx-auto text-primary mb-2" />
                <CardTitle>Nuovo Budget</CardTitle>
                <CardDescription>
                  Crea un nuovo budget e inizia a gestire i costi
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">
                  Crea Budget
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

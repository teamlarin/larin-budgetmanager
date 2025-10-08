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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        checkAdminStatus(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        checkAdminStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    setIsAdmin(!!data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!user) {
    return null;
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

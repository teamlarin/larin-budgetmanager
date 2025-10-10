import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FolderOpen, Plus, Settings, LogOut, User } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ first_name: string; last_name: string } | null>(null);

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
      .select("approved, first_name, last_name")
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
    setUserProfile(profileData ? { first_name: profileData.first_name, last_name: profileData.last_name } : null);
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

  const getInitials = () => {
    if (!userProfile) return "U";
    const firstInitial = userProfile.first_name?.charAt(0) || "";
    const lastInitial = userProfile.last_name?.charAt(0) || "";
    return (firstInitial + lastInitial).toUpperCase() || "U";
  };

  const getFullName = () => {
    if (!userProfile) return "Utente";
    return `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || "Utente";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-3 h-auto py-2 px-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="font-semibold">{getFullName()}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Il Mio Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <User className="mr-2 h-4 w-4" />
                Profilo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Esci
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isAdmin && (
            <Button variant="outline" onClick={() => navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Impostazioni
            </Button>
          )}
        </div>
        <div className="text-center space-y-6 py-12">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">Budget Manager</h1>
            <p className="text-xl text-muted-foreground">
              Gestisci budget e costi in modo professionale
            </p>
          </div>

          <div className="max-w-3xl mx-auto grid gap-4 md:grid-cols-3">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/projects?view=mine')}>
              <CardHeader className="text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-primary mb-2" />
                <CardTitle>I Miei Budget</CardTitle>
                <CardDescription>
                  Visualizza e gestisci solo i tuoi budget
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  I Miei Budget
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/projects?view=all')}>
              <CardHeader className="text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-secondary mb-2" />
                <CardTitle>Tutti i Budget</CardTitle>
                <CardDescription>
                  Visualizza tutti i budget di tutti gli utenti
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Tutti i Budget
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/projects?view=mine')}>
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

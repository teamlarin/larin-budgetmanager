import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ first_name: string; last_name: string; avatar_url?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
        checkUserStatus(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
        checkUserStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkUserStatus = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('approved, first_name, last_name, avatar_url')
      .eq('id', userId)
      .single();

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    setIsApproved(profileData?.approved || false);
    setIsAdmin(!!roleData);
    setUserProfile(profileData ? { 
      first_name: profileData.first_name, 
      last_name: profileData.last_name,
      avatar_url: profileData.avatar_url 
    } : null);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (!user || loading) {
    return null;
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Account in Attesa di Approvazione</h1>
          <p className="text-muted-foreground">
            Il tuo account è stato creato con successo ma deve essere approvato da un amministratore.
          </p>
          <p className="text-sm text-muted-foreground">
            Riceverai una notifica via email quando il tuo account sarà stato approvato.
          </p>
          <Button className="w-full" onClick={handleLogout}>
            Esci
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppHeader onLogout={handleLogout} />
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen flex w-full pt-16">
          <AppSidebar userProfile={userProfile} isAdmin={isAdmin} />
          <SidebarInset className="flex-1">
            <main>
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </>
  );
};

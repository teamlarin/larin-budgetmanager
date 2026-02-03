import { useEffect, useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from './AppHeader';
import { ScrollToTop } from './ScrollToTop';
import { AnimatedBackground } from './AnimatedBackground';
import { LoadingScreen } from './LoadingScreen';
import { InteractiveTour } from './InteractiveTour';
import { RoleSimulationBanner } from './RoleSimulationBanner';
import { Settings } from 'lucide-react';
import { hasPermission } from '@/lib/permissions';
import { useTour } from '@/hooks/useTour';
import { useRoleSimulation } from '@/contexts/RoleSimulationContext';
import { getTourStepsForRole, getTourId } from '@/lib/tourSteps';
import { logAction } from '@/hooks/useActionLogger';
import { useGoogleAuthCallback } from '@/hooks/useGoogleAuthCallback';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const navigate = useNavigate();
  const { getEffectiveRole } = useRoleSimulation();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ first_name: string; last_name: string; avatar_url?: string } | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null>(null);

  // Handle Google OAuth callbacks globally
  useGoogleAuthCallback();

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
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('approved, first_name, last_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    // Get Google avatar if available
    const { data: { user } } = await supabase.auth.getUser();
    const googleIdentity = user?.identities?.find(identity => identity.provider === 'google');
    const googleAvatar = googleIdentity?.identity_data?.avatar_url;

    const role = roleData?.role as 'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null;
    
    setIsApproved(profileData?.approved || false);
    setIsAdmin(role === 'admin');
    setUserRole(role);
    setUserProfile(profileData ? { 
      first_name: profileData.first_name, 
      last_name: profileData.last_name,
      // Prioritize uploaded avatar, fallback to Google avatar
      avatar_url: profileData.avatar_url || googleAvatar
    } : null);
    setLoading(false);
  };

  const handleLogout = async () => {
    await logAction({
      actionType: 'logout',
      actionDescription: 'Logout effettuato',
    });
    await supabase.auth.signOut();
    navigate('/auth');
  };

  // Tour configuration
  const tourId = getTourId(userRole);
  const tourSteps = getTourStepsForRole(userRole);
  const { isOpen: isTourOpen, startTour, closeTour, completeTour } = useTour({
    tourId,
    userId: user?.id || null,
    autoStart: true,
  });

  if (!user || loading) {
    return <LoadingScreen />;
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
    <div className="min-h-screen bg-background relative">
      <AnimatedBackground />
      <AppHeader 
        onLogout={handleLogout} 
        userProfile={userProfile}
        userRole={userRole}
        onStartTour={startTour}
      />
      <main className="pt-16" data-tour="dashboard">
        {children}
      </main>
      
      {/* Interactive Tour */}
      <InteractiveTour
        steps={tourSteps}
        isOpen={isTourOpen}
        onClose={completeTour}
        onComplete={completeTour}
        tourId={tourId}
      />
      
      {/* Fixed Settings Button (icon only, bottom left, for admins and accounts) */}
      {hasPermission(getEffectiveRole(userRole), 'canAccessSettings') && (
        <Button 
          variant="default" 
          size="icon"
          className="fixed bottom-6 left-4 shadow-lg z-40"
          asChild
          data-tour="settings-button"
        >
          <NavLink to="/settings" aria-label="Impostazioni">
            <Settings className="h-5 w-5" />
          </NavLink>
        </Button>
      )}

      {/* Scroll to top button */}
      <ScrollToTop />
      
      {/* Role Simulation Banner */}
      <RoleSimulationBanner />
    </div>
  );
};

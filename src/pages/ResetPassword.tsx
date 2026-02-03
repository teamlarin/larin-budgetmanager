import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import larinLogo from "@/assets/logo_larin.png";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";

const passwordSchema = z.object({
  password: z
    .string()
    .min(8, "La password deve contenere almeno 8 caratteri")
    .regex(/[A-Z]/, "La password deve contenere almeno una lettera maiuscola")
    .regex(/[a-z]/, "La password deve contenere almeno una lettera minuscola")
    .regex(/[0-9]/, "La password deve contenere almeno un numero"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Le password non coincidono",
  path: ["confirmPassword"],
});

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    // Listen for auth state changes - Supabase will automatically process the recovery token from URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('Auth state change:', event, session?.user?.email);
      
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked recovery link and Supabase processed it
        console.log('PASSWORD_RECOVERY event detected');
        setHasSession(true);
      } else if (event === 'SIGNED_IN' && session) {
        // Also handle SIGNED_IN in case PASSWORD_RECOVERY doesn't fire
        // Check if this looks like a recovery flow (URL has recovery params)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');
        if (type === 'recovery') {
          console.log('SIGNED_IN with recovery type');
          setHasSession(true);
        } else {
          // Regular sign in - allow password change if user has session
          console.log('SIGNED_IN detected, allowing password change');
          setHasSession(true);
        }
      }
    });

    // Check for existing session or recovery parameters
    const checkSession = async () => {
      if (!mounted) return;
      
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      const accessToken = hashParams.get('access_token');
      
      console.log('Checking session - type:', type, 'has access_token:', !!accessToken);
      
      // If this is a recovery flow with token, wait for onAuthStateChange to process it
      if (type === 'recovery' && accessToken) {
        console.log('Recovery flow detected with token, waiting for auth state change...');
        
        // Check if user is already logged in with Google (no email identity)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession) {
          const hasEmailIdentity = existingSession.user.identities?.some(
            identity => identity.provider === 'email'
          );
          
          if (!hasEmailIdentity) {
            // Sign out the Google session so Supabase can process the recovery token
            console.log('Signing out Google session to allow recovery flow');
            await supabase.auth.signOut();
            // After signout, Supabase will re-process the hash and trigger onAuthStateChange
            return;
          }
        }
        
        // Wait a bit longer for Supabase to process the hash
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check session again
        const { data: { session } } = await supabase.auth.getSession();
        if (session && mounted) {
          console.log('Session established after waiting');
          setHasSession(true);
        }
        return;
      }
      
      // No recovery token in URL - check if user already has a valid session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('Existing session found:', session.user.email);
        setHasSession(true);
      } else {
        // No session and no recovery token - show error
        console.log('No session and no recovery token');
        toast({
          title: "Sessione non valida",
          description: "Il link di reset è scaduto o non è valido. Richiedi un nuovo link.",
          variant: "destructive",
        });
        setTimeout(() => navigate("/forgot-password"), 2000);
      }
    };

    // Small delay to let Supabase process the hash first
    const timeoutId = setTimeout(checkSession, 200);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [navigate, toast]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = passwordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const errors = result.error.errors.map((e) => e.message).join(", ");
      toast({
        title: "Errore di validazione",
        description: errors,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: result.data.password,
    });

    if (error) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    } else {
      toast({
        title: "Password aggiornata",
        description: "La tua password è stata modificata con successo.",
      });
      setTimeout(() => navigate("/auth"), 2000);
    }
  };

  if (!hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center">
            <img src={larinLogo} alt="Larin" className="h-16 w-auto" />
          </div>
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Verifica in corso...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <img src={larinLogo} alt="Larin" className="h-16 w-auto" />
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Reimposta Password</CardTitle>
            <CardDescription>
              Inserisci la tua nuova password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nuova Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <PasswordStrengthIndicator password={password} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Conferma Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvataggio..." : "Reimposta Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;

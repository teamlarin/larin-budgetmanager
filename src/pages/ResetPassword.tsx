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
    const handleRecoveryFlow = async () => {
      // Check if this is a recovery flow from email link (hash contains type=recovery)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      const accessToken = hashParams.get('access_token');
      
      // If this is a recovery flow from email link
      if (type === 'recovery' && accessToken) {
        // Check if user is already logged in with a different session (e.g., Google)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession) {
          // Check if logged in with Google only (no email identity)
          const hasEmailIdentity = existingSession.user.identities?.some(
            identity => identity.provider === 'email'
          );
          
          if (!hasEmailIdentity) {
            // Sign out the Google session first so recovery flow can complete
            console.log('Signing out Google session to allow recovery flow');
            await supabase.auth.signOut();
          }
        }
        
        // Let Supabase process the recovery token from the hash
        // This will create a new session with the recovery token
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error processing recovery token:', error);
          toast({
            title: "Errore",
            description: "Errore nel processare il link di reset. Riprova.",
            variant: "destructive",
          });
          setTimeout(() => navigate("/auth"), 2000);
          return;
        }
        
        if (data.session) {
          setHasSession(true);
        } else {
          toast({
            title: "Sessione non valida",
            description: "Il link di reset è scaduto o non è valido.",
            variant: "destructive",
          });
          setTimeout(() => navigate("/auth"), 2000);
        }
        return;
      }
      
      // Not a recovery flow - just check for existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setHasSession(true);
      } else {
        toast({
          title: "Sessione non valida",
          description: "Il link di reset è scaduto o non è valido.",
          variant: "destructive",
        });
        setTimeout(() => navigate("/auth"), 2000);
      }
    };
    
    handleRecoveryFlow();
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

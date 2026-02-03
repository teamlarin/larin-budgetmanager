import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Hook to handle Google OAuth callback tokens from URL hash.
 * This should be used in the main App layout to catch OAuth redirects globally.
 */
export function useGoogleAuthCallback() {
  const processedRef = useRef(false);

  useEffect(() => {
    const handleGoogleAuthCallback = async () => {
      // Only process once per page load
      if (processedRef.current) return;
      
      const hash = window.location.hash;
      
      // Check for success callback
      if (hash.includes('google-auth-success=')) {
        processedRef.current = true;
        
        try {
          const tokenDataEncoded = hash.split('google-auth-success=')[1]?.split('&')[0];
          if (!tokenDataEncoded) return;
          
          const tokenData = JSON.parse(decodeURIComponent(tokenDataEncoded));
          console.log('Processing Google OAuth callback...');
          
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            toast({
              title: 'Errore',
              description: 'Sessione non valida. Effettua il login e riprova.',
              variant: 'destructive',
            });
            return;
          }

          // Save tokens via edge function
          const response = await fetch(
            `https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/google-calendar-auth?action=save-tokens`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(tokenData),
            }
          );

          if (!response.ok) {
            throw new Error('Failed to save Google tokens');
          }

          toast({
            title: 'Successo',
            description: 'Google collegato correttamente',
          });

          // Clean up URL hash
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          
          // Trigger a reload to refresh the component state
          window.location.reload();
        } catch (error) {
          console.error('Error processing Google OAuth callback:', error);
          toast({
            title: 'Errore',
            description: 'Impossibile completare il collegamento con Google',
            variant: 'destructive',
          });
          // Clean up URL hash even on error
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
      
      // Check for error callback
      if (hash.includes('google-auth-error=')) {
        processedRef.current = true;
        const error = hash.split('google-auth-error=')[1]?.split('&')[0];
        console.error('Google OAuth error:', error);
        toast({
          title: 'Errore',
          description: `Autenticazione Google fallita: ${decodeURIComponent(error || 'unknown')}`,
          variant: 'destructive',
        });
        // Clean up URL hash
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };

    handleGoogleAuthCallback();
  }, []);
}

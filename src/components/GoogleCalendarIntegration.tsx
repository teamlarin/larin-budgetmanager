import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calendar, Settings, Link, Unlink, Loader2 } from 'lucide-react';

interface GoogleCalendar {
  id: string;
  name: string;
  primary: boolean;
  backgroundColor: string;
  selected: boolean;
}

interface GoogleCalendarIntegrationProps {
  onConnectionChange?: (connected: boolean) => void;
}

export function GoogleCalendarIntegration({ onConnectionChange }: GoogleCalendarIntegrationProps) {
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  // Check connection status and fetch calendars
  const { data: calendarData, isLoading, refetch } = useQuery({
    queryKey: ['google-calendar-status'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { connected: false, calendars: [] };

      const response = await fetch(
        `https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/google-calendar-events?action=calendars`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      return data as { connected: boolean; calendars: GoogleCalendar[] };
    },
  });

  const isConnected = calendarData?.connected || false;
  const calendars = calendarData?.calendars || [];

  useEffect(() => {
    onConnectionChange?.(isConnected);
  }, [isConnected, onConnectionChange]);

  useEffect(() => {
    if (calendars.length > 0) {
      setSelectedCalendars(calendars.filter(c => c.selected).map(c => c.id));
    }
  }, [calendars]);

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'google-auth-success') {
        setIsConnecting(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('No session');

          // Save tokens
          const response = await fetch(
            `https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/google-calendar-auth?action=save-tokens`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(event.data.tokens),
            }
          );

          if (!response.ok) throw new Error('Failed to save tokens');

          toast.success('Google Calendar collegato');
          refetch();
          queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] });
        } catch (error) {
          console.error('Error saving Google tokens:', error);
          toast.error('Errore durante il collegamento');
        } finally {
          setIsConnecting(false);
        }
      } else if (event.data?.type === 'google-auth-error') {
        toast.error('Errore durante l\'autenticazione Google');
        setIsConnecting(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refetch, queryClient]);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/google-calendar-auth?action=authorize&state=${encodeURIComponent(window.location.origin)}`
      );
      const { authUrl } = await response.json();
      
      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        authUrl,
        'google-oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    },
    onError: (error) => {
      console.error('Connection error:', error);
      toast.error('Errore durante il collegamento');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/google-calendar-auth?action=disconnect`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to disconnect');
    },
    onSuccess: () => {
      toast.success('Google Calendar scollegato');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] });
    },
    onError: (error) => {
      console.error('Disconnect error:', error);
      toast.error('Errore durante lo scollegamento');
    },
  });

  const saveCalendarsMutation = useMutation({
    mutationFn: async (calendarIds: string[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/google-calendar-events?action=save-calendars`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ calendarIds }),
        }
      );

      if (!response.ok) throw new Error('Failed to save calendars');
    },
    onSuccess: () => {
      toast.success('Calendari aggiornati');
      setSettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] });
    },
    onError: (error) => {
      console.error('Save calendars error:', error);
      toast.error('Errore durante il salvataggio');
    },
  });

  const handleToggleCalendar = (calendarId: string) => {
    setSelectedCalendars(prev =>
      prev.includes(calendarId)
        ? prev.filter(id => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Caricamento...
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isConnected ? (
        <>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Google Calendar
          </Badge>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Calendari
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Seleziona Calendari</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Seleziona i calendari da visualizzare
                </p>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {calendars.map(calendar => (
                    <div key={calendar.id} className="flex items-center gap-3">
                      <Checkbox
                        id={calendar.id}
                        checked={selectedCalendars.includes(calendar.id)}
                        onCheckedChange={() => handleToggleCalendar(calendar.id)}
                      />
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: calendar.backgroundColor || '#4285f4' }}
                      />
                      <Label htmlFor={calendar.id} className="flex-1 cursor-pointer">
                        {calendar.name}
                        {calendar.primary && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Principale
                          </Badge>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between pt-4 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Scollega
                  </Button>
                  <Button
                    onClick={() => saveCalendarsMutation.mutate(selectedCalendars)}
                    disabled={saveCalendarsMutation.isPending}
                  >
                    Salva
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => connectMutation.mutate()}
          disabled={connectMutation.isPending || isConnecting}
        >
          {connectMutation.isPending || isConnecting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Link className="h-4 w-4 mr-2" />
          )}
          Collega Google Calendar
        </Button>
      )}
    </div>
  );
}

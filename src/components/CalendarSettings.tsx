import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Settings, Calendar, Link, Unlink, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const HIDDEN_GOOGLE_EVENTS_KEY = 'hiddenGoogleEvents';

export interface CalendarConfig {
  numberOfDays: number;
  showWeekends: boolean;
  timezone: string;
  weekStartsOn: number;
  workDayStart: string;
  workDayEnd: string;
  defaultSlotDuration: number;
}

const DEFAULT_CONFIG: CalendarConfig = {
  numberOfDays: 7,
  showWeekends: true,
  timezone: 'Europe/Rome',
  weekStartsOn: 1, // Monday
  workDayStart: '08:00',
  workDayEnd: '18:00',
  defaultSlotDuration: 60, // minutes
};

const TIMEZONES = [
  'Europe/Rome',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney',
];


const SLOT_DURATIONS = [
  { value: 15, label: '15 minuti' },
  { value: 30, label: '30 minuti' },
  { value: 45, label: '45 minuti' },
  { value: 60, label: '1 ora' },
];

interface GoogleCalendar {
  id: string;
  name: string;
  primary: boolean;
  backgroundColor: string;
  selected: boolean;
}

interface CalendarSettingsProps {
  config: CalendarConfig;
  onRestoreHiddenEvents?: () => void;
  onConfigChange: (config: CalendarConfig) => void;
  onGoogleConnectionChange?: (connected: boolean) => void;
}

export function CalendarSettings({ config, onConfigChange, onGoogleConnectionChange, onRestoreHiddenEvents }: CalendarSettingsProps) {
  const queryClient = useQueryClient();
  const [localConfig, setLocalConfig] = useState<CalendarConfig>(config);
  const [open, setOpen] = useState(false);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [hiddenEventsCount, setHiddenEventsCount] = useState(0);

  // Sync localConfig with config prop when dialog opens
  useEffect(() => {
    if (open) {
      setLocalConfig(config);
    }
  }, [open, config]);

  // Check hidden events count
  useEffect(() => {
    const updateHiddenCount = () => {
      try {
        const stored = localStorage.getItem(HIDDEN_GOOGLE_EVENTS_KEY);
        if (stored) {
          const hiddenEvents = JSON.parse(stored);
          setHiddenEventsCount(Object.keys(hiddenEvents).length);
        } else {
          setHiddenEventsCount(0);
        }
      } catch {
        setHiddenEventsCount(0);
      }
    };
    
    updateHiddenCount();
    // Update when dialog opens
    if (open) {
      updateHiddenCount();
    }
  }, [open]);

  const handleRestoreHiddenEvents = () => {
    localStorage.removeItem(HIDDEN_GOOGLE_EVENTS_KEY);
    setHiddenEventsCount(0);
    onRestoreHiddenEvents?.();
    toast.success('Eventi Google nascosti ripristinati');
  };
  const [isConnecting, setIsConnecting] = useState(false);

  // Check Google Calendar connection status and fetch calendars
  const { data: calendarData, isLoading: googleLoading, refetch: refetchGoogle } = useQuery({
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

  const isGoogleConnected = calendarData?.connected || false;
  const googleCalendars = calendarData?.calendars || [];

  useEffect(() => {
    onGoogleConnectionChange?.(isGoogleConnected);
  }, [isGoogleConnected, onGoogleConnectionChange]);

  useEffect(() => {
    if (googleCalendars.length > 0) {
      setSelectedCalendars(googleCalendars.filter(c => c.selected).map(c => c.id));
    }
  }, [googleCalendars]);

  // Handle OAuth callback from URL hash (redirect-based flow)
  useEffect(() => {
    const handleHashCallback = async () => {
      const hash = window.location.hash;
      
      if (hash.includes('google-auth-success=')) {
        setIsConnecting(true);
        // Clean up the URL immediately
        window.history.replaceState(null, '', window.location.pathname);
        
        try {
          const tokenData = hash.split('google-auth-success=')[1];
          const tokens = JSON.parse(decodeURIComponent(tokenData));
          
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('No session');

          const response = await fetch(
            `https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/google-calendar-auth?action=save-tokens`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(tokens),
            }
          );

          if (!response.ok) throw new Error('Failed to save tokens');

          toast.success('Google Calendar collegato');
          refetchGoogle();
          queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] });
        } catch (error) {
          console.error('Error saving Google tokens:', error);
          toast.error('Errore durante il collegamento');
        } finally {
          setIsConnecting(false);
        }
      } else if (hash.includes('google-auth-error=')) {
        window.history.replaceState(null, '', window.location.pathname);
        toast.error('Errore durante l\'autenticazione Google');
      }
    };
    
    handleHashCallback();
  }, [refetchGoogle, queryClient]);

  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/google-calendar-auth?action=authorize&state=${encodeURIComponent(window.location.origin)}`
      );
      const { authUrl } = await response.json();
      
      // Redirect in the same window - the callback will redirect back to /calendar
      window.location.href = authUrl;
    },
    onError: (error) => {
      console.error('Connection error:', error);
      toast.error('Errore durante il collegamento');
    },
  });

  const disconnectGoogleMutation = useMutation({
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
      refetchGoogle();
      queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] });
    },
    onError: (error) => {
      console.error('Disconnect error:', error);
      toast.error('Errore durante lo scollegamento');
    },
  });

  const saveGoogleCalendarsMutation = useMutation({
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
      toast.success('Calendari Google aggiornati');
      queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] });
    },
    onError: (error) => {
      console.error('Save calendars error:', error);
      toast.error('Errore durante il salvataggio');
    },
  });

  const handleToggleGoogleCalendar = (calendarId: string) => {
    setSelectedCalendars(prev =>
      prev.includes(calendarId)
        ? prev.filter(id => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  const handleSave = () => {
    onConfigChange(localConfig);
    localStorage.setItem('calendarConfig', JSON.stringify(localConfig));
    
    // Save Google calendar selections if connected
    if (isGoogleConnected) {
      saveGoogleCalendarsMutation.mutate(selectedCalendars);
    }
    
    toast.success('Impostazioni salvate');
    setOpen(false);
  };

  const handleReset = () => {
    setLocalConfig(DEFAULT_CONFIG);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Impostazioni Calendario</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* View Options */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Opzioni di Visualizzazione</h3>
            
            {/* Number of Days */}
            <div className="space-y-2">
              <Label>Numero di giorni da visualizzare</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <Button
                    key={num}
                    variant={localConfig.numberOfDays === num ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLocalConfig({ ...localConfig, numberOfDays: num })}
                  >
                    {num === 7 ? 'W' : num}
                  </Button>
                ))}
                <Button
                  variant={localConfig.numberOfDays === 30 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLocalConfig({ ...localConfig, numberOfDays: 30 })}
                >
                  M
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                W = Settimana, M = Mese
              </p>
            </div>

            {/* Show Weekends */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Visualizza fine settimana</Label>
                <p className="text-xs text-muted-foreground">
                  Mostra o nascondi sabato e domenica
                </p>
              </div>
              <Switch
                checked={localConfig.showWeekends}
                onCheckedChange={(checked) =>
                  setLocalConfig({ ...localConfig, showWeekends: checked })
                }
              />
            </div>
          </div>

          {/* Time Settings */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">Impostazioni Orario</h3>
            
            {/* Timezone */}
            <div className="space-y-2">
              <Label>Fuso orario</Label>
              <Select
                value={localConfig.timezone}
                onValueChange={(value) =>
                  setLocalConfig({ ...localConfig, timezone: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Week Starts On - Fixed to Monday for ISO compliance */}
            <div className="space-y-2">
              <Label>La settimana inizia di</Label>
              <div className="text-sm text-muted-foreground py-2 px-3 border rounded-md bg-muted/50">
                Lunedì (standard ISO)
              </div>
            </div>

            {/* Work Day Start */}
            <div className="space-y-2">
              <Label>Inizio giornata lavorativa</Label>
              <Select
                value={localConfig.workDayStart}
                onValueChange={(value) =>
                  setLocalConfig({ ...localConfig, workDayStart: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    return (
                      <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                        {hour}:00
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Work Day End */}
            <div className="space-y-2">
              <Label>Fine giornata lavorativa</Label>
              <Select
                value={localConfig.workDayEnd}
                onValueChange={(value) =>
                  setLocalConfig({ ...localConfig, workDayEnd: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    return (
                      <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                        {hour}:00
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Activity Settings */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">Impostazioni Attività</h3>
            
            {/* Default Slot Duration */}
            <div className="space-y-2">
              <Label>Dimensione slot predefinita</Label>
              <Select
                value={localConfig.defaultSlotDuration.toString()}
                onValueChange={(value) =>
                  setLocalConfig({ ...localConfig, defaultSlotDuration: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {SLOT_DURATIONS.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value.toString()}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Durata predefinita quando trascini un'attività nel calendario
              </p>
            </div>
          </div>

          {/* Google Calendar Integration */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">Integrazione Google Calendar</h3>
            
            <div className="space-y-4">
              {/* Connection Status */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Stato connessione</Label>
                  <p className="text-xs text-muted-foreground">
                    {isGoogleConnected 
                      ? 'Il tuo Google Calendar è collegato' 
                      : 'Collega il tuo account Google per sincronizzare gli eventi'}
                  </p>
                </div>
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Badge variant={isGoogleConnected ? 'default' : 'secondary'}>
                    <Calendar className="h-3 w-3 mr-1" />
                    {isGoogleConnected ? 'Collegato' : 'Non collegato'}
                  </Badge>
                )}
              </div>

              {/* Connect/Disconnect Button */}
              <div>
                {isGoogleConnected ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => disconnectGoogleMutation.mutate()}
                    disabled={disconnectGoogleMutation.isPending}
                  >
                    {disconnectGoogleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Unlink className="h-4 w-4 mr-2" />
                    )}
                    Scollega Google Calendar
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => connectGoogleMutation.mutate()}
                    disabled={connectGoogleMutation.isPending || isConnecting}
                  >
                    {connectGoogleMutation.isPending || isConnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Link className="h-4 w-4 mr-2" />
                    )}
                    Collega Google Calendar
                  </Button>
                )}
              </div>

              {/* Calendar Selection (only when connected) */}
              {isGoogleConnected && googleCalendars.length > 0 && (
                <div className="space-y-3">
                  <Label>Calendari da visualizzare</Label>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                    {googleCalendars.map(calendar => (
                      <div key={calendar.id} className="flex items-center gap-3">
                        <Checkbox
                          id={calendar.id}
                          checked={selectedCalendars.includes(calendar.id)}
                          onCheckedChange={() => handleToggleGoogleCalendar(calendar.id)}
                        />
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: calendar.backgroundColor || '#4285f4' }}
                        />
                        <Label htmlFor={calendar.id} className="flex-1 cursor-pointer text-sm">
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
                </div>
              )}

              {/* Restore Hidden Events */}
              {isGoogleConnected && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Eventi nascosti</Label>
                    <p className="text-xs text-muted-foreground">
                      {hiddenEventsCount > 0 
                        ? `${hiddenEventsCount} eventi Google nascosti dal calendario`
                        : 'Nessun evento Google nascosto'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRestoreHiddenEvents}
                    disabled={hiddenEventsCount === 0}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Ripristina
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleReset}>
            Ripristina predefinite
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave}>
              Salva
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function loadCalendarConfig(): CalendarConfig {
  try {
    const saved = localStorage.getItem('calendarConfig');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Force weekStartsOn to 1 (Monday) for ISO compliance
      return { ...DEFAULT_CONFIG, ...parsed, weekStartsOn: 1 };
    }
  } catch (error) {
    console.error('Error loading calendar config:', error);
  }
  return DEFAULT_CONFIG;
}

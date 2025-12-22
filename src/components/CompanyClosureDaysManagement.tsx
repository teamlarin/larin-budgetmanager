import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Plus, Trash2, RotateCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ClosureDay {
  date: string;
  name: string;
  isRecurring: boolean; // true = ogni anno (es. festività), false = solo quest'anno
}

interface ClosureDaysSettings {
  closureDays: ClosureDay[];
}

// Festività italiane ricorrenti (formato MM-DD)
const ITALIAN_HOLIDAYS: ClosureDay[] = [
  { date: '01-01', name: 'Capodanno', isRecurring: true },
  { date: '01-06', name: 'Epifania', isRecurring: true },
  { date: '04-25', name: 'Festa della Liberazione', isRecurring: true },
  { date: '05-01', name: 'Festa dei Lavoratori', isRecurring: true },
  { date: '06-02', name: 'Festa della Repubblica', isRecurring: true },
  { date: '08-15', name: 'Ferragosto', isRecurring: true },
  { date: '11-01', name: 'Tutti i Santi', isRecurring: true },
  { date: '12-08', name: 'Immacolata Concezione', isRecurring: true },
  { date: '12-25', name: 'Natale', isRecurring: true },
  { date: '12-26', name: 'Santo Stefano', isRecurring: true },
];

export const CompanyClosureDaysManagement = () => {
  const queryClient = useQueryClient();
  const [closureDays, setClosureDays] = useState<ClosureDay[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [newIsRecurring, setNewIsRecurring] = useState(false);

  // Fetch closure days settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['app-settings', 'closure_days'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('setting_key', 'closure_days')
        .maybeSingle();

      if (error) throw error;
      return data;
    }
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (settings?.setting_value) {
      const value = settings.setting_value as unknown as ClosureDaysSettings;
      setClosureDays(value.closureDays || []);
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (days: ClosureDay[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const settingValue = { closureDays: days } as any;
      
      if (settings?.id) {
        const { error } = await supabase
          .from('app_settings')
          .update({ 
            setting_value: settingValue,
            description: 'Giorni di chiusura aziendale'
          })
          .eq('id', settings.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert([{ 
            setting_key: 'closure_days',
            setting_value: settingValue,
            description: 'Giorni di chiusura aziendale'
          }]);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast.success('Giorni di chiusura salvati');
    },
    onError: (error) => {
      console.error('Error saving closure days:', error);
      toast.error('Errore durante il salvataggio');
    }
  });

  const handleAddDay = () => {
    if (!newDate || !newName.trim()) {
      toast.error('Inserisci data e nome');
      return;
    }

    // Per i giorni ricorrenti, salva solo MM-DD
    const dateToSave = newIsRecurring 
      ? format(parseISO(newDate), 'MM-dd')
      : newDate;

    // Controlla duplicati
    const isDuplicate = closureDays.some(day => 
      day.date === dateToSave && day.isRecurring === newIsRecurring
    );

    if (isDuplicate) {
      toast.error('Questa data è già presente');
      return;
    }

    const newDay: ClosureDay = {
      date: dateToSave,
      name: newName.trim(),
      isRecurring: newIsRecurring
    };

    const updatedDays = [...closureDays, newDay].sort((a, b) => {
      // Ordina per data (le ricorrenti prima per mese-giorno)
      const dateA = a.isRecurring ? a.date : a.date.slice(5);
      const dateB = b.isRecurring ? b.date : b.date.slice(5);
      return dateA.localeCompare(dateB);
    });

    setClosureDays(updatedDays);
    saveMutation.mutate(updatedDays);
    setNewDate('');
    setNewName('');
    setNewIsRecurring(false);
  };

  const handleRemoveDay = (index: number) => {
    const updatedDays = closureDays.filter((_, i) => i !== index);
    setClosureDays(updatedDays);
    saveMutation.mutate(updatedDays);
  };

  const handleResetToItalianHolidays = () => {
    setClosureDays(ITALIAN_HOLIDAYS);
    saveMutation.mutate(ITALIAN_HOLIDAYS);
  };

  const formatDisplayDate = (day: ClosureDay) => {
    if (day.isRecurring) {
      // Formato MM-DD -> "25 Dicembre (ogni anno)"
      const [month, dayNum] = day.date.split('-');
      const tempDate = new Date(2024, parseInt(month) - 1, parseInt(dayNum));
      return `${format(tempDate, 'd MMMM', { locale: it })} (ogni anno)`;
    } else {
      // Formato YYYY-MM-DD -> "25 Dicembre 2024"
      return format(parseISO(day.date), 'd MMMM yyyy', { locale: it });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Calendario
        </CardTitle>
        <CardDescription>
          Gestisci i giorni di chiusura aziendale e le festività
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new closure day */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <h4 className="font-medium">Aggiungi giorno di chiusura</h4>
          <div className="grid gap-4 md:grid-cols-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="newDate">Data</Label>
              <Input
                id="newDate"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newName">Nome</Label>
              <Input
                id="newName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="es. Chiusura estiva"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newIsRecurring}
                  onChange={(e) => setNewIsRecurring(e.target.checked)}
                  className="rounded border-input"
                />
                Ricorrente ogni anno
              </Label>
            </div>
            <Button onClick={handleAddDay} disabled={saveMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi
            </Button>
          </div>
        </div>

        {/* Reset to Italian holidays button */}
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Ripristina festività italiane
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ripristina festività italiane?</AlertDialogTitle>
                <AlertDialogDescription>
                  Questa azione sostituirà tutti i giorni di chiusura attuali con le festività italiane standard.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetToItalianHolidays}>
                  Ripristina
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* List of closure days */}
        {closureDays.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[100px]">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closureDays.map((day, index) => (
                <TableRow key={`${day.date}-${index}`}>
                  <TableCell className="font-medium">
                    {formatDisplayDate(day)}
                  </TableCell>
                  <TableCell>{day.name}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDay(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nessun giorno di chiusura configurato.
            <br />
            <Button 
              variant="link" 
              onClick={handleResetToItalianHolidays}
              className="mt-2"
            >
              Aggiungi le festività italiane
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

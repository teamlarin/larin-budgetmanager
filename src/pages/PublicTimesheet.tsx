import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, Building2, FileText } from 'lucide-react';

interface TimeEntry {
  id: string;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  hours: number;
  userName: string;
  activityName: string;
  category: string;
  notes: string | null;
}

interface TimesheetData {
  project: {
    name: string;
    clientName: string | null;
  };
  timeEntries: TimeEntry[];
  totalAccountingHours: number;
}

const PublicTimesheet = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [data, setData] = useState<TimesheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimesheet = async () => {
      if (!token) {
        setError('Token mancante');
        setLoading(false);
        return;
      }

      try {
        const { data: responseData, error: fnError } = await supabase.functions.invoke('public-timesheet', {
          body: null,
          headers: {},
        });

        // Use fetch directly since we need query params
        const response = await fetch(
          `https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/public-timesheet?token=${encodeURIComponent(token)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Errore nel caricamento');
          setLoading(false);
          return;
        }

        setData(result);
      } catch (err) {
        console.error('Error fetching timesheet:', err);
        setError('Errore nel caricamento del timesheet');
      } finally {
        setLoading(false);
      }
    };

    fetchTimesheet();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Link non valido</h2>
                <p className="text-muted-foreground">
                  {error || 'Il link potrebbe essere scaduto o non valido.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">{data.project.name}</h1>
          </div>
          {data.project.clientName && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{data.project.clientName}</span>
            </div>
          )}
        </div>

        {/* Summary Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Totale Ore Contabili</p>
                <p className="text-2xl font-bold">{data.totalAccountingHours.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timesheet Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registrazioni Tempo Confermate</CardTitle>
          </CardHeader>
          <CardContent>
            {data.timeEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nessuna registrazione confermata
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Utente</TableHead>
                      <TableHead>Attività</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Orario</TableHead>
                      <TableHead>Ore Contabili</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.timeEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {entry.scheduled_date 
                            ? format(new Date(entry.scheduled_date), 'dd/MM/yyyy', { locale: it })
                            : 'N/A'}
                        </TableCell>
                        <TableCell className="font-medium">{entry.userName}</TableCell>
                        <TableCell>{entry.activityName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {entry.scheduled_start_time && entry.scheduled_end_time
                            ? `${entry.scheduled_start_time.slice(0, 5)} - ${entry.scheduled_end_time.slice(0, 5)}`
                            : 'N/A'}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {entry.hours.toFixed(1)}h
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {entry.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Timesheet generato automaticamente
        </div>
      </div>
    </div>
  );
};

export default PublicTimesheet;

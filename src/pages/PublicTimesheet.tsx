import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { formatHours } from '@/lib/utils';
import * as XLSX from 'xlsx';
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
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Clock, AlertCircle, Building2, FileText, Calendar, Download, ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';

interface TimeEntry {
  id: string;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  hours: number;
  userName?: string;
  activityName: string;
  category: string;
  notes: string | null;
  hasGoogleEvent?: boolean;
}

interface ActivitySummary {
  activityName: string;
  category: string;
  confirmedHours: number;
  budgetHours: number;
}

interface TimesheetData {
  project: {
    name: string;
    clientName: string | null;
    billingType: string | null;
    projectType: string | null;
  };
  timeEntries: TimeEntry[];
  totalAccountingHours: number;
  activitySummary: ActivitySummary[];
  hideUsers: boolean;
}

const billingTypeLabels: Record<string, string> = {
  'pack': 'Pack',
  'consuntivo': 'Consuntivo',
  'forfait': 'Forfait',
  'pro_bono': 'Pro Bono',
};

const PublicTimesheet = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const hideDetail = searchParams.get('hide_detail') === '1';
  const [data, setData] = useState<TimesheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(true);

  useEffect(() => {
    const fetchTimesheet = async () => {
      if (!token) {
        setError('Token mancante');
        setLoading(false);
        return;
      }

      try {
        const hideUsers = searchParams.get('hide_users') === '1';
        const hideDetail = searchParams.get('hide_detail') === '1';
        const response = await fetch(
          `https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/public-timesheet?token=${encodeURIComponent(token)}${hideUsers ? '&hide_users=1' : ''}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
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
  }, [token, searchParams]);

  const exportToExcel = () => {
    if (!data) return;

    // Activity summary sheet
    const summaryData = data.activitySummary.map(a => ({
      'Attività': a.activityName,
      'Categoria': a.category,
      'Ore Confermate': a.confirmedHours.toFixed(2),
      'Ore Previste': a.budgetHours.toFixed(2),
      'Avanzamento %': a.budgetHours > 0 ? Math.min((a.confirmedHours / a.budgetHours) * 100, 100).toFixed(0) + '%' : 'N/A'
    }));

    // Detail sheet
    const detailData = data.timeEntries.map(entry => {
      const row: Record<string, string> = {
        'Data': entry.scheduled_date ? format(new Date(entry.scheduled_date), 'dd/MM/yyyy', { locale: it }) : 'N/A',
      };
      if (!data.hideUsers) row['Utente'] = entry.userName || 'N/A';
      row['Attività'] = entry.activityName;
      row['Categoria'] = entry.category;
      row['Ore'] = entry.hours.toFixed(2);
      row['Note'] = entry.notes || '';
      return row;
    });

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Riepilogo');
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Dettaglio');
    XLSX.writeFile(wb, `timesheet_${data.project.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

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

  const billingLabel = data.project.billingType ? billingTypeLabels[data.project.billingType] || data.project.billingType : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">{data.project.name}</h1>
            {billingLabel && (
              <Badge variant="blue">{billingLabel}</Badge>
            )}
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
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Totale Ore Contabili</p>
                  <p className="text-2xl font-bold">{formatHours(data.totalAccountingHours)}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <Download className="h-4 w-4 mr-1" />
                Esporta Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Activity Summary */}
        {data.activitySummary.length > 0 && (
          <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
            <Card className="mb-6">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                  <CardTitle className="flex items-center gap-2">
                    {summaryOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    <BarChart3 className="h-5 w-5" />
                    Riepilogo per Attività
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Attività</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Ore Confermate</TableHead>
                          <TableHead>Ore Previste</TableHead>
                          <TableHead className="w-[200px]">Avanzamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.activitySummary.map((activity, idx) => {
                          const pct = activity.budgetHours > 0 ? Math.min((activity.confirmedHours / activity.budgetHours) * 100, 100) : 0;
                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{activity.activityName}</TableCell>
                              <TableCell><Badge variant="outline">{activity.category}</Badge></TableCell>
                              <TableCell className="font-semibold">{formatHours(activity.confirmedHours)}</TableCell>
                              <TableCell>{formatHours(activity.budgetHours)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={pct} className="h-2 flex-1" />
                                  <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Timesheet Detail Table */}
        {!hideDetail && (
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
                        {!data.hideUsers && <TableHead>Utente</TableHead>}
                        <TableHead>Attività</TableHead>
                        <TableHead>Categoria</TableHead>
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
                          {!data.hideUsers && (
                            <TableCell className="font-medium">{entry.userName || 'N/A'}</TableCell>
                          )}
                          <TableCell>{entry.activityName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{entry.category}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatHours(entry.hours)}
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-start gap-1.5">
                                    {entry.hasGoogleEvent && (
                                      <Calendar className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                                    )}
                                    <span className="truncate">{entry.notes || '-'}</span>
                                  </div>
                                </TooltipTrigger>
                                {entry.notes && (
                                  <TooltipContent side="left" className="max-w-[400px] whitespace-pre-wrap">
                                    {entry.notes}
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Timesheet generato automaticamente
        </div>
      </div>
    </div>
  );
};

export default PublicTimesheet;

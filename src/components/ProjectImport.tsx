import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, FileUp, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parse } from 'date-fns';
import { it } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface ProjectData {
  name: string;
  clientName: string;
  quoteReference: string;
  projectLeader: string;
  status: string;
  projectType: string;
  category: string;
  area: string;
  budget: number;
  margin: number | null;
  startDate: Date | null;
  endDate: Date | null;
}

interface ImportResult {
  success: number;
  skipped: number;
  errors: string[];
}

export const ProjectImport = ({ onImportComplete }: { onImportComplete: () => void }) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [projectsData, setProjectsData] = useState<ProjectData[]>([]);
  const [importing, setImporting] = useState(false);
  const [existingProjectNames, setExistingProjectNames] = useState<Set<string>>(new Set());
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const { toast } = useToast();

  const parseCSV = (text: string): ProjectData[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const projects: ProjectData[] = [];
    
    // Skip header row (index 0 is empty BOM, index 1 is header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // Split by semicolon
      const cols = line.split(';');
      if (cols.length < 12) continue;
      
      const name = cols[0]?.trim();
      if (!name) continue;
      
      const clientName = cols[1]?.trim() || '';
      const quoteReference = cols[2]?.trim() || '';
      const projectLeader = cols[3]?.trim() || '';
      const status = cols[4]?.trim() || '';
      const projectType = cols[5]?.trim() || '';
      const category = cols[6]?.trim() || '';
      const area = cols[7]?.trim() || '';
      
      // Parse budget (handle both . and , as decimal separator)
      let budget = 0;
      const budgetStr = cols[8]?.trim();
      if (budgetStr) {
        budget = parseFloat(budgetStr.replace(',', '.')) || 0;
      }
      
      // Parse margin
      let margin: number | null = null;
      const marginStr = cols[9]?.trim();
      if (marginStr) {
        margin = parseFloat(marginStr.replace(',', '.'));
        if (isNaN(margin)) margin = null;
      }
      
      // Parse dates (format: DD/MM/YYYY)
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      
      try {
        const startDateStr = cols[10]?.trim();
        if (startDateStr) {
          startDate = parse(startDateStr, 'dd/MM/yyyy', new Date());
        }
      } catch (e) {
        console.warn('Could not parse start date:', cols[10]);
      }
      
      try {
        const endDateStr = cols[11]?.trim();
        if (endDateStr) {
          endDate = parse(endDateStr, 'dd/MM/yyyy', new Date());
        }
      } catch (e) {
        console.warn('Could not parse end date:', cols[11]);
      }
      
      projects.push({
        name,
        clientName,
        quoteReference,
        projectLeader,
        status,
        projectType,
        category,
        area,
        budget,
        margin,
        startDate,
        endDate,
      });
    }
    
    return projects;
  };

  const parseExcel = async (file: File): Promise<ProjectData[]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    const projects: ProjectData[] = [];
    
    // Skip header row
    for (let i = 1; i < jsonData.length; i++) {
      const cols = jsonData[i];
      if (!cols || cols.length < 12) continue;
      
      const name = cols[0]?.toString().trim();
      if (!name) continue;
      
      const clientName = cols[1]?.toString().trim() || '';
      const quoteReference = cols[2]?.toString().trim() || '';
      const projectLeader = cols[3]?.toString().trim() || '';
      const status = cols[4]?.toString().trim() || '';
      const projectType = cols[5]?.toString().trim() || '';
      const category = cols[6]?.toString().trim() || '';
      const area = cols[7]?.toString().trim() || '';
      
      // Parse budget
      let budget = 0;
      const budgetVal = cols[8];
      if (budgetVal !== undefined && budgetVal !== null) {
        budget = typeof budgetVal === 'number' ? budgetVal : parseFloat(budgetVal.toString().replace(',', '.')) || 0;
      }
      
      // Parse margin
      let margin: number | null = null;
      const marginVal = cols[9];
      if (marginVal !== undefined && marginVal !== null) {
        margin = typeof marginVal === 'number' ? marginVal : parseFloat(marginVal.toString().replace(',', '.'));
        if (isNaN(margin)) margin = null;
      }
      
      // Parse dates
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      
      try {
        const startDateVal = cols[10];
        if (startDateVal) {
          if (typeof startDateVal === 'number') {
            // Excel serial date
            startDate = new Date((startDateVal - 25569) * 86400 * 1000);
          } else {
            startDate = parse(startDateVal.toString().trim(), 'dd/MM/yyyy', new Date());
          }
        }
      } catch (e) {
        console.warn('Could not parse start date:', cols[10]);
      }
      
      try {
        const endDateVal = cols[11];
        if (endDateVal) {
          if (typeof endDateVal === 'number') {
            // Excel serial date
            endDate = new Date((endDateVal - 25569) * 86400 * 1000);
          } else {
            endDate = parse(endDateVal.toString().trim(), 'dd/MM/yyyy', new Date());
          }
        }
      } catch (e) {
        console.warn('Could not parse end date:', cols[11]);
      }
      
      projects.push({
        name,
        clientName,
        quoteReference,
        projectLeader,
        status,
        projectType,
        category,
        area,
        budget,
        margin,
        startDate,
        endDate,
      });
    }
    
    return projects;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isCSV && !isExcel) {
      toast({
        title: 'Errore',
        description: 'Seleziona un file CSV o Excel (.xlsx, .xls)',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);

    try {
      let projects: ProjectData[];
      
      if (isCSV) {
        const text = await selectedFile.text();
        projects = parseCSV(text);
      } else {
        projects = await parseExcel(selectedFile);
      }
      
      setProjectsData(projects);
      
      // Check for existing projects
      setIsCheckingDuplicates(true);
      const { data: existingProjects } = await supabase
        .from('projects')
        .select('name');
      
      const existingNames = new Set(existingProjects?.map(p => p.name.toLowerCase()) || []);
      setExistingProjectNames(existingNames);
      setIsCheckingDuplicates(false);
      
      const duplicatesCount = projects.filter(p => existingNames.has(p.name.toLowerCase())).length;
      const newCount = projects.length - duplicatesCount;
      
      toast({
        title: 'File caricato',
        description: `${projects.length} progetti trovati: ${newCount} nuovi, ${duplicatesCount} duplicati`,
      });
    } catch (error) {
      console.error('Error parsing file:', error);
      setIsCheckingDuplicates(false);
      toast({
        title: 'Errore',
        description: 'Errore durante la lettura del file',
        variant: 'destructive',
      });
    }
  };

  const mapProjectTypeToBillingType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'one-shot': 'one_shot',
      'recurring': 'recurring',
      'hour-pack': 'hour_pack',
      'cost-based': 'cost_based',
      'pre-sale': 'pre_sale',
    };
    return typeMap[type.toLowerCase()] || 'one_shot';
  };

  const mapStatusToProjectStatus = (status: string): 'in_partenza' | 'aperto' | 'da_fatturare' | 'completato' => {
    const statusMap: Record<string, 'in_partenza' | 'aperto' | 'da_fatturare' | 'completato'> = {
      'aperto': 'aperto',
      'in partenza': 'in_partenza',
      'da fatturare': 'da_fatturare',
      'completato': 'completato',
      'chiuso': 'completato',
    };
    return statusMap[status.toLowerCase()] || 'aperto';
  };

  const handleImport = async () => {
    if (projectsData.length === 0) {
      toast({
        title: 'Errore',
        description: 'Nessun progetto da importare',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    const result: ImportResult = { success: 0, skipped: 0, errors: [] };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get existing clients
      const { data: existingClients } = await supabase
        .from('clients')
        .select('id, name');
      
      const clientsMap = new Map(existingClients?.map(c => [c.name.toLowerCase(), c.id]) || []);

      // Get existing users (for project leader mapping)
      const { data: existingUsers } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('approved', true);
      
      // Create a map with full name as key
      const usersMap = new Map<string, string>();
      existingUsers?.forEach(u => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
        usersMap.set(fullName, u.id);
      });

      // Get existing project names to avoid duplicates
      const { data: existingProjects } = await supabase
        .from('projects')
        .select('name');
      
      const existingNames = new Set(existingProjects?.map(p => p.name.toLowerCase()) || []);

      for (const project of projectsData) {
        try {
          // Skip if project with same name already exists
          if (existingNames.has(project.name.toLowerCase())) {
            result.skipped++;
            continue;
          }

          // Find or create client
          let clientId: string | null = null;
          if (project.clientName) {
            clientId = clientsMap.get(project.clientName.toLowerCase()) || null;
            
            // Create client if not exists
            if (!clientId) {
              const { data: newClient, error: clientError } = await supabase
                .from('clients')
                .insert([{
                  name: project.clientName,
                  user_id: user.id,
                }])
                .select()
                .single();
              
              if (!clientError && newClient) {
                clientId = newClient.id;
                clientsMap.set(project.clientName.toLowerCase(), clientId);
              }
            }
          }

          // Find account user (project leader)
          let accountUserId: string | null = null;
          if (project.projectLeader) {
            accountUserId = usersMap.get(project.projectLeader.toLowerCase()) || null;
          }

          // Create project
          const { error: projectError } = await supabase
            .from('projects')
            .insert([{
              name: project.name,
              description: project.quoteReference ? `Preventivo: ${project.quoteReference}` : null,
              project_type: project.category || 'Personalizzato',
              client_id: clientId,
              account_user_id: accountUserId,
              user_id: user.id,
              total_budget: project.budget,
              margin_percentage: 30,
              billing_type: mapProjectTypeToBillingType(project.projectType),
              area: project.area || null,
              project_status: mapStatusToProjectStatus(project.status),
              status: 'approvato', // Import as approved
              start_date: project.startDate ? project.startDate.toISOString() : null,
              end_date: project.endDate ? project.endDate.toISOString() : null,
            }]);

          if (projectError) {
            result.errors.push(`${project.name}: ${projectError.message}`);
          } else {
            result.success++;
            existingNames.add(project.name.toLowerCase());
          }
        } catch (err: any) {
          result.errors.push(`${project.name}: ${err.message}`);
        }
      }

      if (result.success > 0) {
        toast({
          title: 'Importazione completata',
          description: `${result.success} progetti importati. ${result.skipped} duplicati ignorati.${result.errors.length > 0 ? ` ${result.errors.length} errori.` : ''}`,
        });
        setFile(null);
        setProjectsData([]);
        setOpen(false);
        onImportComplete();
      } else if (result.skipped > 0) {
        toast({
          title: 'Nessun nuovo progetto',
          description: 'Tutti i progetti sono già presenti nel database',
        });
      } else {
        toast({
          title: 'Errore',
          description: `Nessun progetto importato. Errori: ${result.errors.join(', ')}`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error importing projects:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante l\'importazione',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setProjectsData([]);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp className="h-4 w-4 mr-2" />
          Importa progetti
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Importa Progetti</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="project-file">File CSV o Excel</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Formato richiesto: PROGETTO;CLIENTE;PREVENTIVO;PROJECT LEADER;STATO;TIPO;CATEGORIA;AREA;BUDGET;MARGINALITÀ;DATA INIZIO;DATA FINE
            </p>
            <Input
              id="project-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={importing}
            />
          </div>

          {projectsData.length > 0 && (
            <>
              {/* Summary badges */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600">
                    {projectsData.filter(p => !existingProjectNames.has(p.name.toLowerCase())).length} nuovi
                  </Badge>
                  <span className="text-sm text-muted-foreground">verranno importati</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">
                    {projectsData.filter(p => existingProjectNames.has(p.name.toLowerCase())).length} duplicati
                  </Badge>
                  <span className="text-sm text-muted-foreground">verranno ignorati</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>I clienti non presenti verranno creati automaticamente.</span>
              </div>
              
              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Stato</TableHead>
                      <TableHead>Nome Progetto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>N. Preventivo</TableHead>
                      <TableHead>Project Leader</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Marginalità</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectsData.map((project, index) => {
                      const isDuplicate = existingProjectNames.has(project.name.toLowerCase());
                      return (
                        <TableRow key={index} className={isDuplicate ? 'opacity-50 bg-muted/50' : ''}>
                          <TableCell>
                            {isCheckingDuplicates ? (
                              <Badge variant="outline">Verifica...</Badge>
                            ) : isDuplicate ? (
                              <Badge variant="destructive">Duplicato</Badge>
                            ) : (
                              <Badge variant="default" className="bg-green-600">Nuovo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate" title={project.name}>
                            {project.name}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate" title={project.clientName}>
                            {project.clientName || '-'}
                          </TableCell>
                          <TableCell>{project.quoteReference || '-'}</TableCell>
                          <TableCell>{project.projectLeader || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{project.projectType}</Badge>
                          </TableCell>
                          <TableCell>
                            {project.budget > 0 ? `€ ${project.budget.toLocaleString('it-IT')}` : '-'}
                          </TableCell>
                          <TableCell>
                            {project.margin !== null ? `${project.margin}%` : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {project.startDate ? format(project.startDate, 'dd/MM/yy', { locale: it }) : '-'}
                            {' → '}
                            {project.endDate ? format(project.endDate, 'dd/MM/yy', { locale: it }) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={importing}
                >
                  <X className="h-4 w-4 mr-2" />
                  Annulla
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={projectsData.filter(p => !existingProjectNames.has(p.name.toLowerCase())).length === 0 || importing}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {importing ? 'Importazione...' : `Importa ${projectsData.filter(p => !existingProjectNames.has(p.name.toLowerCase())).length} progetti`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

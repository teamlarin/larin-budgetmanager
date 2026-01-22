import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, FileUp, AlertCircle, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
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
  startDate: Date | null;
  endDate: Date | null;
  account: string;
  team: string;
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
  const [existingProjectsMap, setExistingProjectsMap] = useState<Map<string, string>>(new Map());
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [updateDuplicates, setUpdateDuplicates] = useState(false);
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
      
      // Parse dates (format: DD/MM/YYYY)
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      
      try {
        const startDateStr = cols[9]?.trim();
        if (startDateStr) {
          startDate = parse(startDateStr, 'dd/MM/yyyy', new Date());
        }
      } catch (e) {
        console.warn('Could not parse start date:', cols[9]);
      }
      
      try {
        const endDateStr = cols[10]?.trim();
        if (endDateStr) {
          endDate = parse(endDateStr, 'dd/MM/yyyy', new Date());
        }
      } catch (e) {
        console.warn('Could not parse end date:', cols[10]);
      }
      
      // Account and Team
      const account = cols[11]?.trim() || '';
      const team = cols[12]?.trim() || '';
      
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
        startDate,
        endDate,
        account,
        team,
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
      
      // Parse dates
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      
      try {
        const startDateVal = cols[9];
        if (startDateVal) {
          if (typeof startDateVal === 'number') {
            // Excel serial date
            startDate = new Date((startDateVal - 25569) * 86400 * 1000);
          } else {
            startDate = parse(startDateVal.toString().trim(), 'dd/MM/yyyy', new Date());
          }
        }
      } catch (e) {
        console.warn('Could not parse start date:', cols[9]);
      }
      
      try {
        const endDateVal = cols[10];
        if (endDateVal) {
          if (typeof endDateVal === 'number') {
            // Excel serial date
            endDate = new Date((endDateVal - 25569) * 86400 * 1000);
          } else {
            endDate = parse(endDateVal.toString().trim(), 'dd/MM/yyyy', new Date());
          }
        }
      } catch (e) {
        console.warn('Could not parse end date:', cols[10]);
      }
      
      // Account and Team
      const account = cols[11]?.toString().trim() || '';
      const team = cols[12]?.toString().trim() || '';
      
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
        startDate,
        endDate,
        account,
        team,
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
        .select('id, name');
      
      const existingNames = new Set(existingProjects?.map(p => p.name.toLowerCase()) || []);
      const existingMap = new Map(existingProjects?.map(p => [p.name.toLowerCase(), p.id]) || []);
      setExistingProjectNames(existingNames);
      setExistingProjectsMap(existingMap);
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
      
      // Create a map with full name as key (normalize spaces)
      const usersMap = new Map<string, string>();
      existingUsers?.forEach(u => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');
        usersMap.set(fullName, u.id);
        // Also add reversed name (last first)
        const reversedName = `${u.last_name || ''} ${u.first_name || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');
        if (reversedName !== fullName) {
          usersMap.set(reversedName, u.id);
        }
      });

      // Get existing project names to avoid duplicates
      const { data: existingProjects } = await supabase
        .from('projects')
        .select('name');
      
      const existingNames = new Set(existingProjects?.map(p => p.name.toLowerCase()) || []);

      let updated = 0;

      for (const project of projectsData) {
        try {
          const isDuplicate = existingNames.has(project.name.toLowerCase());
          const existingProjectId = existingProjectsMap.get(project.name.toLowerCase());

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

          // Find project leader (normalize spaces)
          let projectLeaderId: string | null = null;
          if (project.projectLeader) {
            const normalizedLeader = project.projectLeader.trim().toLowerCase().replace(/\s+/g, ' ');
            projectLeaderId = usersMap.get(normalizedLeader) || null;
            console.log('Project leader lookup:', { original: project.projectLeader, normalized: normalizedLeader, found: !!projectLeaderId });
          }

          // Find account user
          let accountUserId: string | null = null;
          if (project.account) {
            const normalizedAccount = project.account.trim().toLowerCase().replace(/\s+/g, ' ');
            accountUserId = usersMap.get(normalizedAccount) || null;
            console.log('Account lookup:', { original: project.account, normalized: normalizedAccount, found: !!accountUserId });
          }

          // Parse team members (comma-separated)
          const teamMemberIds: string[] = [];
          if (project.team) {
            const teamNames = project.team.split(',').map(n => n.trim()).filter(Boolean);
            for (const name of teamNames) {
              const normalizedName = name.toLowerCase().replace(/\s+/g, ' ');
              const userId = usersMap.get(normalizedName);
              if (userId) {
                teamMemberIds.push(userId);
              } else {
                console.log('Team member not found:', { original: name, normalized: normalizedName });
              }
            }
          }

          if (isDuplicate && updateDuplicates && existingProjectId) {
            // Update existing project
            const { error: updateError } = await supabase
              .from('projects')
              .update({
                manual_quote_number: project.quoteReference || null,
                client_id: clientId,
                project_leader_id: projectLeaderId,
                account_user_id: accountUserId,
                total_budget: project.budget,
                manual_activities_budget: project.budget,
                billing_type: mapProjectTypeToBillingType(project.projectType),
                area: project.area || null,
                project_status: mapStatusToProjectStatus(project.status),
                start_date: project.startDate ? project.startDate.toISOString() : null,
                end_date: project.endDate ? project.endDate.toISOString() : null,
              })
              .eq('id', existingProjectId);

            if (updateError) {
              result.errors.push(`${project.name}: ${updateError.message}`);
            } else {
              // Update team members for existing project
              if (teamMemberIds.length > 0) {
                // Remove existing team members and add new ones
                await supabase.from('project_members').delete().eq('project_id', existingProjectId);
                const teamInserts = teamMemberIds.map(userId => ({
                  project_id: existingProjectId,
                  user_id: userId,
                }));
                await supabase.from('project_members').insert(teamInserts);
              }
              updated++;
            }
          } else if (isDuplicate) {
            // Skip duplicate
            result.skipped++;
          } else {
            // Create new project
            const { data: newProject, error: projectError } = await supabase
              .from('projects')
              .insert([{
                name: project.name,
                description: null,
                manual_quote_number: project.quoteReference || null,
                project_type: project.category || 'Personalizzato',
                client_id: clientId,
                project_leader_id: projectLeaderId,
                account_user_id: accountUserId,
                user_id: user.id,
                total_budget: project.budget,
                manual_activities_budget: project.budget,
                margin_percentage: 30,
                billing_type: mapProjectTypeToBillingType(project.projectType),
                area: project.area || null,
                project_status: mapStatusToProjectStatus(project.status),
                status: 'approvato',
                start_date: project.startDate ? project.startDate.toISOString() : null,
                end_date: project.endDate ? project.endDate.toISOString() : null,
              }])
              .select('id')
              .single();

            if (projectError) {
              result.errors.push(`${project.name}: ${projectError.message}`);
            } else {
              // Add team members for new project
              if (newProject && teamMemberIds.length > 0) {
                const teamInserts = teamMemberIds.map(userId => ({
                  project_id: newProject.id,
                  user_id: userId,
                }));
                await supabase.from('project_members').insert(teamInserts);
              }
              result.success++;
              existingNames.add(project.name.toLowerCase());
            }
          }
        } catch (err: any) {
          result.errors.push(`${project.name}: ${err.message}`);
        }
      }

      if (result.success > 0 || updated > 0) {
        const messages = [];
        if (result.success > 0) messages.push(`${result.success} nuovi importati`);
        if (updated > 0) messages.push(`${updated} aggiornati`);
        if (result.skipped > 0) messages.push(`${result.skipped} ignorati`);
        if (result.errors.length > 0) messages.push(`${result.errors.length} errori`);
        
        toast({
          title: 'Importazione completata',
          description: messages.join(', '),
        });
        setFile(null);
        setProjectsData([]);
        setUpdateDuplicates(false);
        setOpen(false);
        onImportComplete();
      } else if (result.skipped > 0) {
        toast({
          title: 'Nessun nuovo progetto',
          description: 'Tutti i progetti sono già presenti. Attiva "Aggiorna duplicati" per aggiornarli.',
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importa Progetti</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div>
            <Label htmlFor="project-file">File CSV o Excel</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Formato richiesto: PROGETTO;CLIENTE;PREVENTIVO;PROJECT LEADER;STATO;TIPO;CATEGORIA;AREA;BUDGET;DATA INIZIO;DATA FINE;ACCOUNT;TEAM (separato da virgola)
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
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-600">
                      {projectsData.filter(p => !existingProjectNames.has(p.name.toLowerCase())).length} nuovi
                    </Badge>
                    <span className="text-sm text-muted-foreground">verranno importati</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={updateDuplicates ? "default" : "destructive"} className={updateDuplicates ? "bg-amber-500" : ""}>
                      {projectsData.filter(p => existingProjectNames.has(p.name.toLowerCase())).length} duplicati
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {updateDuplicates ? 'verranno aggiornati' : 'verranno ignorati'}
                    </span>
                  </div>
                </div>
                
                {/* Toggle for updating duplicates */}
                {projectsData.filter(p => existingProjectNames.has(p.name.toLowerCase())).length > 0 && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="update-duplicates"
                      checked={updateDuplicates}
                      onCheckedChange={setUpdateDuplicates}
                    />
                    <Label htmlFor="update-duplicates" className="text-sm cursor-pointer flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      Aggiorna duplicati
                    </Label>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>I clienti non presenti verranno creati automaticamente.</span>
              </div>
              
              <div className="h-[350px] overflow-auto border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[100px]">Stato</TableHead>
                      <TableHead className="min-w-[200px]">Nome Progetto</TableHead>
                      <TableHead className="min-w-[150px]">Cliente</TableHead>
                      <TableHead className="min-w-[120px]">N. Preventivo</TableHead>
                      <TableHead className="min-w-[140px]">Project Leader</TableHead>
                      <TableHead className="min-w-[120px]">Account</TableHead>
                      <TableHead className="min-w-[180px]">Team</TableHead>
                      <TableHead className="min-w-[100px]">Tipo</TableHead>
                      <TableHead className="min-w-[100px]">Budget</TableHead>
                      <TableHead className="min-w-[150px]">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectsData.map((project, index) => {
                      const isDuplicate = existingProjectNames.has(project.name.toLowerCase());
                      return (
                        <TableRow key={index} className={isDuplicate && !updateDuplicates ? 'opacity-50 bg-muted/50' : ''}>
                          <TableCell>
                            {isCheckingDuplicates ? (
                              <Badge variant="outline">Verifica...</Badge>
                            ) : isDuplicate ? (
                              updateDuplicates ? (
                                <Badge variant="default" className="bg-amber-500">Aggiorna</Badge>
                              ) : (
                                <Badge variant="destructive">Duplicato</Badge>
                              )
                            ) : (
                              <Badge variant="default" className="bg-green-600">Nuovo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium" title={project.name}>
                            {project.name}
                          </TableCell>
                          <TableCell title={project.clientName}>
                            {project.clientName || '-'}
                          </TableCell>
                          <TableCell>{project.quoteReference || '-'}</TableCell>
                          <TableCell>{project.projectLeader || '-'}</TableCell>
                          <TableCell>{project.account || '-'}</TableCell>
                          <TableCell className="text-sm">{project.team || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{project.projectType}</Badge>
                          </TableCell>
                          <TableCell>
                            {project.budget > 0 ? `€ ${project.budget.toLocaleString('it-IT')}` : '-'}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {project.startDate ? format(project.startDate, 'dd/MM/yy', { locale: it }) : '-'}
                            {' → '}
                            {project.endDate ? format(project.endDate, 'dd/MM/yy', { locale: it }) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2 justify-end pt-2 flex-shrink-0">
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
                  disabled={(projectsData.filter(p => !existingProjectNames.has(p.name.toLowerCase())).length === 0 && !updateDuplicates) || importing}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {importing ? 'Importazione...' : (() => {
                    const newCount = projectsData.filter(p => !existingProjectNames.has(p.name.toLowerCase())).length;
                    const duplicateCount = projectsData.filter(p => existingProjectNames.has(p.name.toLowerCase())).length;
                    if (updateDuplicates) {
                      return `Importa ${newCount} nuovi, aggiorna ${duplicateCount}`;
                    }
                    return `Importa ${newCount} progetti`;
                  })()}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

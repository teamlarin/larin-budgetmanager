import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, AlertCircle, CheckCircle2, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TimesheetEntry {
  userName: string;
  date: string;
  dayOfWeek: string;
  hours: number;
  projectName: string;
  clientName: string;
}

interface ImportStats {
  total: number;
  matched: number;
  skipped: number;
  usersCreated: number;
}

interface ProjectMatch {
  projectName: string;
  projectId: string | null;
  matched: boolean;
}

interface UserMatch {
  userName: string;
  userId: string | null;
  matched: boolean;
  toCreate: boolean;
}

export const TimesheetImport = ({ onImportComplete }: { onImportComplete: () => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const [projectMatches, setProjectMatches] = useState<ProjectMatch[]>([]);
  const [userMatches, setUserMatches] = useState<UserMatch[]>([]);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const { toast } = useToast();

  const parseCSV = (text: string): TimesheetEntry[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const entries: TimesheetEntry[] = [];
    
    // Skip header line (index 0) and any empty first line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Split by semicolon
      const parts = line.split(';');
      if (parts.length < 6) continue;
      
      const userName = parts[0]?.trim();
      const date = parts[1]?.trim();
      const dayOfWeek = parts[2]?.trim();
      // Hours use Italian format with comma as decimal separator
      const hoursStr = parts[3]?.trim().replace(',', '.');
      const hours = parseFloat(hoursStr) || 0;
      const projectName = parts[4]?.trim();
      const clientName = parts[5]?.trim();
      
      if (userName && date && projectName && hours > 0) {
        entries.push({
          userName,
          date,
          dayOfWeek,
          hours,
          projectName,
          clientName
        });
      }
    }
    
    return entries;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: 'Errore',
        description: 'Seleziona un file CSV',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setStats(null);

    try {
      const text = await selectedFile.text();
      const parsedEntries = parseCSV(text);
      setEntries(parsedEntries);

      // Get unique project names and user names
      const uniqueProjects = [...new Set(parsedEntries.map(e => e.projectName))];
      const uniqueUsers = [...new Set(parsedEntries.map(e => e.userName))];

      // Fetch all projects from database
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name');

      // Fetch all profiles from database
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, full_name, deleted_at');

      // Match projects
      const projectMatchResults: ProjectMatch[] = uniqueProjects.map(projectName => {
        const match = projects?.find(p => 
          p.name.toLowerCase().trim() === projectName.toLowerCase().trim()
        );
        return {
          projectName,
          projectId: match?.id || null,
          matched: !!match
        };
      });

      // Match users by full name (first_name + last_name)
      const userMatchResults: UserMatch[] = uniqueUsers.map(userName => {
        const match = profiles?.find(p => {
          const fullName = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
          return fullName.toLowerCase() === userName.toLowerCase();
        });
        return {
          userName,
          userId: match?.id || null,
          matched: !!match,
          toCreate: !match
        };
      });

      setProjectMatches(projectMatchResults);
      setUserMatches(userMatchResults);

      const matchedProjects = projectMatchResults.filter(p => p.matched).length;
      const matchedUsers = userMatchResults.filter(u => u.matched).length;
      const usersToCreate = userMatchResults.filter(u => u.toCreate).length;

      toast({
        title: 'File caricato',
        description: `${parsedEntries.length} entry trovate. ${matchedProjects}/${uniqueProjects.length} progetti matchati, ${matchedUsers}/${uniqueUsers.length} utenti matchati, ${usersToCreate} utenti da creare come eliminati`,
      });
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast({
        title: 'Errore',
        description: 'Errore durante la lettura del file CSV',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    if (entries.length === 0) {
      toast({
        title: 'Errore',
        description: 'Nessuna entry da importare',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    let importedCount = 0;
    let skippedCount = 0;
    let usersCreatedCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create map of project names to IDs (only matched ones)
      const projectMap = new Map<string, string>();
      for (const pm of projectMatches) {
        if (pm.matched && pm.projectId) {
          projectMap.set(pm.projectName.toLowerCase(), pm.projectId);
        }
      }

      // Create map of user names to IDs
      const userMap = new Map<string, string>();
      
      // First, handle existing users
      for (const um of userMatches) {
        if (um.matched && um.userId) {
          userMap.set(um.userName.toLowerCase(), um.userId);
        }
      }

      // Create missing users as deleted profiles via edge function
      for (const um of userMatches) {
        if (um.toCreate && !um.userId) {
          // Parse name into first and last name
          const nameParts = um.userName.trim().split(' ');
          const firstName = nameParts[0] || um.userName;
          const lastName = nameParts.slice(1).join(' ') || '';

          try {
            const { data, error } = await supabase.functions.invoke('create-deleted-profile', {
              body: {
                firstName,
                lastName,
                fullName: um.userName
              }
            });

            if (error) {
              console.error('Error creating profile for:', um.userName, error);
              continue;
            }

            if (data?.profile) {
              userMap.set(um.userName.toLowerCase(), data.profile.id);
              usersCreatedCount++;
            }
          } catch (err) {
            console.error('Error calling create-deleted-profile:', err);
          }
        }
      }

      // Get or create budget items for each project
      // We'll create a generic "Timesheet Import" activity for each project
      const budgetItemMap = new Map<string, string>();

      for (const [projectNameLower, projectId] of projectMap) {
        // Check if there's already a generic activity for imports
        const { data: existingItem } = await supabase
          .from('budget_items')
          .select('id')
          .eq('project_id', projectId)
          .eq('activity_name', 'Ore importate')
          .maybeSingle();

        if (existingItem) {
          budgetItemMap.set(projectId, existingItem.id);
        } else {
          // Get max display_order for this project
          const { data: maxOrderData } = await supabase
            .from('budget_items')
            .select('display_order')
            .eq('project_id', projectId)
            .order('display_order', { ascending: false })
            .limit(1);

          const maxOrder = maxOrderData?.[0]?.display_order || 0;

          // Create new budget item
          const { data: newItem, error: itemError } = await supabase
            .from('budget_items')
            .insert({
              project_id: projectId,
              activity_name: 'Ore importate',
              category: 'Import',
              hourly_rate: 0,
              hours_worked: 0,
              total_cost: 0,
              display_order: maxOrder + 1,
              is_custom_activity: true
            })
            .select()
            .single();

          if (itemError) {
            console.error('Error creating budget item:', itemError);
            continue;
          }

          if (newItem) {
            budgetItemMap.set(projectId, newItem.id);
          }
        }
      }

      // Import entries
      const entriesToInsert = [];

      for (const entry of entries) {
        const projectId = projectMap.get(entry.projectName.toLowerCase());
        const userId = userMap.get(entry.userName.toLowerCase());

        if (!projectId) {
          skippedCount++;
          continue;
        }

        const budgetItemId = budgetItemMap.get(projectId);
        if (!budgetItemId || !userId) {
          skippedCount++;
          continue;
        }

        // Calculate start and end time from hours
        // We'll use 9:00 as base time and add hours
        const startHour = 9;
        const endHour = startHour + Math.floor(entry.hours);
        const endMinutes = Math.round((entry.hours % 1) * 60);

        const startTime = `${startHour.toString().padStart(2, '0')}:00:00`;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00`;

        // Create timestamp with date and time
        const actualStartTime = `${entry.date}T${startTime}`;
        const actualEndTime = `${entry.date}T${endTime}`;

        entriesToInsert.push({
          budget_item_id: budgetItemId,
          user_id: userId,
          scheduled_date: entry.date,
          actual_start_time: actualStartTime,
          actual_end_time: actualEndTime,
          notes: `Importato da CSV - ${entry.hours}h`
        });
      }

      // Batch insert entries
      if (entriesToInsert.length > 0) {
        // Insert in batches of 100
        const batchSize = 100;
        for (let i = 0; i < entriesToInsert.length; i += batchSize) {
          const batch = entriesToInsert.slice(i, i + batchSize);
          const { error: insertError } = await supabase
            .from('activity_time_tracking')
            .insert(batch);

          if (insertError) {
            console.error('Error inserting batch:', insertError);
            skippedCount += batch.length;
          } else {
            importedCount += batch.length;
          }
        }
      }

      setStats({
        total: entries.length,
        matched: importedCount,
        skipped: skippedCount,
        usersCreated: usersCreatedCount
      });

      toast({
        title: 'Importazione completata',
        description: `${importedCount} entry importate, ${skippedCount} ignorate, ${usersCreatedCount} utenti creati come eliminati`,
      });

      onImportComplete();
    } catch (error) {
      console.error('Error importing timesheet:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante l\'importazione',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setEntries([]);
    setProjectMatches([]);
    setUserMatches([]);
    setStats(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importa Timesheet da CSV</CardTitle>
        <CardDescription>
          Carica un file CSV con colonne: UTENTE;DATA;GIORNO;ORE;PROGETTO;CLIENTE. 
          Le entry di progetti non presenti verranno ignorate. Gli utenti mancanti verranno creati come eliminati.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="csv-file">File CSV</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={importing}
          />
        </div>

        {entries.length > 0 && (
          <>
            {/* Project Matches */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Progetti ({projectMatches.filter(p => p.matched).length}/{projectMatches.length} matchati)</h4>
              <ScrollArea className="h-32 border rounded-lg p-2">
                <div className="space-y-1">
                  {projectMatches.map((pm, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      {pm.matched ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className={pm.matched ? '' : 'text-muted-foreground line-through'}>
                        {pm.projectName}
                      </span>
                      {!pm.matched && (
                        <Badge variant="outline" className="text-xs">ignorato</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* User Matches */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">
                Utenti ({userMatches.filter(u => u.matched).length}/{userMatches.length} matchati, {userMatches.filter(u => u.toCreate).length} da creare)
              </h4>
              <ScrollArea className="h-32 border rounded-lg p-2">
                <div className="space-y-1">
                  {userMatches.map((um, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      {um.matched ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <UserX className="h-4 w-4 text-amber-500" />
                      )}
                      <span>{um.userName}</span>
                      {um.toCreate && (
                        <Badge variant="secondary" className="text-xs">verrà creato come eliminato</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Entry Preview */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Anteprima entry ({entries.length} totali)</h4>
              <div className="border rounded-lg max-h-64 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utente</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ore</TableHead>
                      <TableHead>Progetto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.slice(0, 20).map((entry, index) => {
                      const projectMatch = projectMatches.find(p => p.projectName === entry.projectName);
                      const userMatch = userMatches.find(u => u.userName === entry.userName);
                      const willImport = projectMatch?.matched && (userMatch?.matched || userMatch?.toCreate);
                      
                      return (
                        <TableRow 
                          key={index}
                          className={willImport ? '' : 'opacity-50'}
                        >
                          <TableCell className="font-medium">{entry.userName}</TableCell>
                          <TableCell>{entry.date}</TableCell>
                          <TableCell>{entry.hours}h</TableCell>
                          <TableCell className="max-w-[200px] truncate">{entry.projectName}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {entries.length > 20 && (
                <p className="text-sm text-muted-foreground">
                  Mostrando 20 di {entries.length} entry...
                </p>
              )}
            </div>

            {stats && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Risultato importazione</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Entry totali: {stats.total}</div>
                  <div>Importate: {stats.matched}</div>
                  <div>Ignorate: {stats.skipped}</div>
                  <div>Utenti creati: {stats.usersCreated}</div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleImport}
                disabled={importing || projectMatches.filter(p => p.matched).length === 0}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {importing ? 'Importazione...' : `Importa ${entries.filter(e => 
                  projectMatches.find(p => p.projectName === e.projectName)?.matched
                ).length} entry`}
              </Button>
              <Button
                variant="outline"
                onClick={resetImport}
                disabled={importing}
              >
                <X className="h-4 w-4 mr-2" />
                Annulla
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

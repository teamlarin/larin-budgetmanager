import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, AlertCircle, CheckCircle2, UserX, FileText, Download, XCircle, Clock, Plus, Filter, Eye, EyeOff, Copy, Loader2, ChevronsUpDown, Check, Wand2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

// Simple fuzzy similarity score (0-1) based on longest common subsequence ratio
function similarityScore(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;
  
  // LCS length
  const dp: number[][] = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      dp[i][j] = s1[i - 1] === s2[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return (2 * dp[len1][len2]) / (len1 + len2);
}

function findBestMatch(name: string, projects: { id: string; name: string }[]): { id: string; name: string; score: number } | null {
  let best: { id: string; name: string; score: number } | null = null;
  for (const p of projects) {
    const score = similarityScore(name, p.name);
    if (score > (best?.score ?? 0)) {
      best = { id: p.id, name: p.name, score };
    }
  }
  // Minimum threshold of 0.4 to avoid nonsensical matches
  return best && best.score >= 0.4 ? best : null;
}

interface BudgetItemOption {
  id: string;
  activity_name: string;
  category: string;
}

interface TimesheetEntry {
  userName: string;
  userEmail?: string;
  date: string;
  dayOfWeek: string;
  hours: number;
  projectName: string;
  clientName: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  task?: string;
  category?: string;
}

interface ImportResult {
  entry: TimesheetEntry;
  status: 'success' | 'error' | 'skipped';
  reason?: string;
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
  manuallyMapped?: boolean;
}

interface DbProject {
  id: string;
  name: string;
}

interface UserMatch {
  userName: string;
  userId: string | null;
  matched: boolean;
  toCreate: boolean;
}

interface TimesheetImportProps {
  onImportComplete: () => void;
  projectId?: string;
  projectName?: string;
}

const CREATE_NEW_ACTIVITY_VALUE = '__create_new__';

export const TimesheetImport = ({ onImportComplete, projectId, projectName }: TimesheetImportProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [projectMatches, setProjectMatches] = useState<ProjectMatch[]>([]);
  const [userMatches, setUserMatches] = useState<UserMatch[]>([]);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [lastImportDate, setLastImportDate] = useState<string | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItemOption[]>([]);
  const [selectedBudgetItemId, setSelectedBudgetItemId] = useState<string>(CREATE_NEW_ACTIVITY_VALUE);
  const [excludedEntries, setExcludedEntries] = useState<Set<number>>(new Set());
  const [previewFilter, setPreviewFilter] = useState<'all' | 'toImport' | 'toSkip' | 'duplicates'>('all');
  const [duplicateEntries, setDuplicateEntries] = useState<Set<number>>(new Set());
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [allDbProjects, setAllDbProjects] = useState<DbProject[]>([]);
  const { toast } = useToast();

  // Load last import date from localStorage on mount
  useEffect(() => {
    const savedDate = localStorage.getItem('lastTimesheetImportDate');
    if (savedDate) {
      setLastImportDate(savedDate);
    }
  }, []);

  // Parse a CSV line respecting quoted fields
  const parseCSVLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCSV = (text: string): TimesheetEntry[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const entries: TimesheetEntry[] = [];
    
    if (lines.length === 0) return entries;
    
    // Detect format by checking header
    const header = lines[0].toLowerCase();
    const isTimestampFormat = header.includes('time_block_id') || header.includes('project_title');
    const isNewFormat = header.includes('data inizio') || header.includes('ore lavorate');
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (isTimestampFormat) {
        // Timestamp format (comma-separated, quoted): time_block_id,title,start_time,end_time,project_id,project_title,user_id,user_email
        const parts = parseCSVLine(line, ',');
        if (parts.length < 8) continue;

        const title = parts[1];
        const startMs = parseInt(parts[2]);
        const endMs = parseInt(parts[3]);
        const projectName = parts[5];
        const userEmail = parts[7];

        if (!startMs || !endMs || !projectName || !userEmail) continue;

        const startDate = new Date(startMs);
        const endDate = new Date(endMs);
        const hours = (endMs - startMs) / (1000 * 60 * 60);
        if (hours <= 0) continue;

        const date = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
        const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

        // Extract name from email (part before @), capitalize it for display
        const emailPart = userEmail.split('@')[0] || userEmail;
        // Replace dots and common separators with spaces, then capitalize
        const userName = emailPart
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());

        entries.push({
          userName,
          userEmail,
          date,
          dayOfWeek: '',
          hours: Math.round(hours * 100) / 100,
          projectName,
          clientName: '',
          startTime,
          endTime,
          title,
        });
      } else {
        const parts = line.split(';');

        if (isNewFormat) {
          // New format: UTENTE;TITLE;TASK;CATEGORIA;PROGETTO;DATA;DATA INIZIO;DATA FINE;ORE LAVORATE
          if (parts.length < 9) continue;
          
          const userName = parts[0]?.trim();
          const title = parts[1]?.trim();
          const task = parts[2]?.trim();
          const category = parts[3]?.trim();
          const projectName = parts[4]?.trim();
          const dateStr = parts[5]?.trim();
          const rawStartTime = parts[6]?.trim();
          const rawEndTime = parts[7]?.trim();
          
          const extractTime = (raw: string | undefined): string | undefined => {
            if (!raw) return undefined;
            if (raw.includes(' ')) {
              const timePart = raw.split(' ').pop();
              return timePart && /^\d{1,2}:\d{2}$/.test(timePart) ? timePart : undefined;
            }
            if (/^\d{1,2}:\d{2}$/.test(raw)) return raw;
            return undefined;
          };
          
          const startTime = extractTime(rawStartTime);
          const endTime = extractTime(rawEndTime);
          const hoursWorkedStr = parts[8]?.trim();
          
          let hours = 0;
          if (hoursWorkedStr) {
            const [h, m] = hoursWorkedStr.split(':').map(Number);
            hours = (h || 0) + (m || 0) / 60;
          }
          
          let date = dateStr;
          if (dateStr && dateStr.includes('/')) {
            const dateParts = dateStr.split('/');
            if (dateParts.length === 3) {
              const day = dateParts[0].padStart(2, '0');
              const month = dateParts[1].padStart(2, '0');
              let year = dateParts[2];
              if (year.length === 2) {
                year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
              }
              date = `${year}-${month}-${day}`;
            }
          }
          
          if (userName && date && projectName && hours > 0) {
            entries.push({
              userName, date, dayOfWeek: '', hours, projectName, clientName: '',
              startTime, endTime, title, task, category
            });
          }
        } else {
          // Old format: UTENTE;DATA;GIORNO;ORE;PROGETTO;CLIENTE
          if (parts.length < 6) continue;
          
          const userName = parts[0]?.trim();
          const date = parts[1]?.trim();
          const dayOfWeek = parts[2]?.trim();
          const hoursStr = parts[3]?.trim().replace(',', '.');
          const hours = parseFloat(hoursStr) || 0;
          const projectName = parts[4]?.trim();
          const clientName = parts[5]?.trim();
          
          if (userName && date && projectName && hours > 0) {
            entries.push({ userName, date, dayOfWeek, hours, projectName, clientName });
          }
        }
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
    setImportResults([]);
    setShowReport(false);

    try {
      const text = await selectedFile.text();
      const parsedEntries = parseCSV(text);
      setEntries(parsedEntries);

      // Filter entries by project if projectId is provided
      let filteredEntries = parsedEntries;
      if (projectId && projectName) {
        filteredEntries = parsedEntries.filter(e => {
          // Exact match first
          if (e.projectName.toLowerCase().trim() === projectName.toLowerCase().trim()) return true;
          // Fuzzy match with similarity threshold
          const score = similarityScore(e.projectName, projectName);
          return score >= 0.6;
        });
        if (filteredEntries.length === 0) {
          toast({
            title: 'Attenzione',
            description: `Nessuna entry trovata per il progetto "${projectName}" nel file CSV`,
            variant: 'destructive',
          });
          setEntries([]);
          return;
        }
      }

      setEntries(filteredEntries);

      const uniqueProjects = [...new Set(filteredEntries.map(e => e.projectName))];
      const uniqueUsers = [...new Set(filteredEntries.map(e => e.userName))];

      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, full_name, email, deleted_at');

      // Store all DB projects for manual mapping
      setAllDbProjects(projects || []);

      const projectMatchResults: ProjectMatch[] = uniqueProjects.map(projectName => {
        // If projectId is provided, force match to that project
        if (projectId) {
          return {
            projectName,
            projectId: projectId,
            matched: true
          };
        }
        const match = projects?.find(p => 
          p.name.toLowerCase().trim() === projectName.toLowerCase().trim()
        );
        return {
          projectName,
          projectId: match?.id || null,
          matched: !!match
        };
      });

      const userMatchResults: UserMatch[] = uniqueUsers.map(userName => {
        // Find any email associated with this userName in parsed entries
        const associatedEmail = parsedEntries.find(e => e.userName === userName)?.userEmail;
        const match = profiles?.find(p => {
          const fullName = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
          if (fullName.toLowerCase() === userName.toLowerCase()) return true;
          // Also match by email if available
          if (associatedEmail && p.email && p.email.toLowerCase() === associatedEmail.toLowerCase()) return true;
          // Partial match: if userName is a single word, match against first_name
          const userNameLower = userName.toLowerCase().trim();
          if (userNameLower && !userNameLower.includes(' ') && p.first_name && p.first_name.toLowerCase() === userNameLower) return true;
          return false;
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

      // Load budget items if single project import
      if (projectId) {
        const { data: budgetItemsData } = await supabase
          .from('budget_items')
          .select('id, activity_name, category')
          .eq('project_id', projectId)
          .order('display_order', { ascending: true });
        
        setBudgetItems(budgetItemsData || []);
        setSelectedBudgetItemId(CREATE_NEW_ACTIVITY_VALUE);
      }

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
    setImportProgress(0);
    const results: ImportResult[] = [];
    let importedCount = 0;
    let skippedCount = 0;
    let usersCreatedCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create map of project names to IDs
      const projectMap = new Map<string, string>();
      for (const pm of projectMatches) {
        if (pm.matched && pm.projectId) {
          projectMap.set(pm.projectName.toLowerCase(), pm.projectId);
        }
      }

      // Create map of user names to IDs
      const userMap = new Map<string, string>();
      
      for (const um of userMatches) {
        if (um.matched && um.userId) {
          userMap.set(um.userName.toLowerCase(), um.userId);
        }
      }

      // Create missing users as deleted profiles via edge function
      setImportProgress(5);
      for (const um of userMatches) {
        if (um.toCreate && !um.userId) {
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

      setImportProgress(15);

      // Get or create dedicated "Ore importate" budget items for each project
      // IMPORTANT: Never modify existing planned activities - only use or create the dedicated import activity
      const budgetItemMap = new Map<string, string>();

      for (const [projectNameLower, currentProjectId] of projectMap) {
        // If single project import and user selected an existing activity, use it for time tracking only
        // This does NOT modify the activity itself, just links time entries to it
        if (projectId && selectedBudgetItemId !== CREATE_NEW_ACTIVITY_VALUE) {
          budgetItemMap.set(currentProjectId, selectedBudgetItemId);
          continue;
        }

        // Otherwise, get or create dedicated "Ore importate" activity
        // This activity is specifically for imported hours and won't affect other planned activities
        const { data: existingItem } = await supabase
          .from('budget_items')
          .select('id')
          .eq('project_id', currentProjectId)
          .eq('activity_name', 'Ore importate')
          .eq('is_custom_activity', true)
          .maybeSingle();

        if (existingItem) {
          budgetItemMap.set(currentProjectId, existingItem.id);
        } else {
          const { data: maxOrderData } = await supabase
            .from('budget_items')
            .select('display_order')
            .eq('project_id', currentProjectId)
            .order('display_order', { ascending: false })
            .limit(1);

          const maxOrder = maxOrderData?.[0]?.display_order || 0;

          const { data: newItem, error: itemError } = await supabase
            .from('budget_items')
            .insert({
              project_id: currentProjectId,
              activity_name: 'Ore importate',
              category: 'Import',
              hourly_rate: 0,
              hours_worked: 0,
              total_cost: 0,
              display_order: maxOrder + 1,
              is_custom_activity: true,
              created_from: 'project' // Mark as created from project to distinguish from budget activities
            })
            .select()
            .single();

          if (itemError) {
            console.error('Error creating budget item:', itemError);
            continue;
          }

          if (newItem) {
            budgetItemMap.set(currentProjectId, newItem.id);
          }
        }
      }

      setImportProgress(25);

      // Fetch work day start from user's calendar settings
      const { data: calSettings } = await supabase
        .from('user_calendar_settings')
        .select('work_day_start')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const workDayStart = calSettings?.work_day_start || '08:00';
      const [defaultStartHour, defaultStartMinute] = workDayStart.split(':').map(Number);

      // Track next available time per user+date for stacking (fallback only)
      const nextAvailableTime = new Map<string, { hour: number; minute: number }>();

      // Process entries and track results
      const entriesToInsert: Array<{
        budget_item_id: string;
        user_id: string;
        scheduled_date: string;
        scheduled_start_time: string;
        scheduled_end_time: string;
        actual_start_time: string;
        actual_end_time: string;
        notes: string;
        originalEntry: TimesheetEntry;
      }> = [];

      // Log maps for debugging
      console.log('[Import] projectMap entries:', Array.from(projectMap.entries()));
      console.log('[Import] userMap entries:', Array.from(userMap.entries()));
      console.log('[Import] budgetItemMap entries:', Array.from(budgetItemMap.entries()));
      console.log('[Import] Total entries to process:', entries.length);
      console.log('[Import] Excluded entries:', excludedEntries.size);

      const skipReasons: Record<string, number> = {};

      for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
        const entry = entries[entryIndex];
        
        // Skip manually excluded entries
        if (excludedEntries.has(entryIndex)) {
          results.push({
            entry,
            status: 'skipped',
            reason: 'Escluso manualmente'
          });
          skippedCount++;
          skipReasons['Escluso manualmente'] = (skipReasons['Escluso manualmente'] || 0) + 1;
          continue;
        }

        const projectId = projectMap.get(entry.projectName.toLowerCase());
        const userId = userMap.get(entry.userName.toLowerCase());

        if (!projectId) {
          results.push({
            entry,
            status: 'skipped',
            reason: 'Progetto non trovato nella piattaforma'
          });
          skippedCount++;
          skipReasons['Progetto non trovato'] = (skipReasons['Progetto non trovato'] || 0) + 1;
          continue;
        }

        if (!userId) {
          if (entryIndex < 5) {
            console.log(`[Import] User not found for entry ${entryIndex}: "${entry.userName}" (lowercase: "${entry.userName.toLowerCase()}")`);
          }
          results.push({
            entry,
            status: 'skipped',
            reason: 'Utente non trovato nella piattaforma'
          });
          skippedCount++;
          skipReasons['Utente non trovato'] = (skipReasons['Utente non trovato'] || 0) + 1;
          continue;
        }

        const budgetItemId = budgetItemMap.get(projectId);
        if (!budgetItemId) {
          results.push({
            entry,
            status: 'error',
            reason: 'Impossibile creare attività per il progetto'
          });
          skippedCount++;
          skipReasons['No budget item'] = (skipReasons['No budget item'] || 0) + 1;
          continue;
        }

        // Use times from CSV if available, otherwise stack sequentially per user+date
        let startTime: string;
        let endTime: string;
        
        if (entry.startTime && entry.endTime) {
          // Use actual times from CSV (format: HH:MM)
          startTime = `${entry.startTime}:00`;
          endTime = `${entry.endTime}:00`;
        } else {
          // Stack activities sequentially per user+date starting from workDayStart
          const stackKey = `${userId}|${entry.date}`;
          const current = nextAvailableTime.get(stackKey) || { hour: defaultStartHour, minute: defaultStartMinute };
          
          const startH = current.hour;
          const startM = current.minute;
          
          // Calculate end time
          const totalStartMinutes = startH * 60 + startM;
          const durationMinutes = Math.round(entry.hours * 60);
          const totalEndMinutes = totalStartMinutes + durationMinutes;
          const endH = Math.floor(totalEndMinutes / 60);
          const endM = totalEndMinutes % 60;
          
          startTime = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}:00`;
          endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}:00`;
          
          // Update next available time for this user+date
          nextAvailableTime.set(stackKey, { hour: endH, minute: endM });
        }

        const actualStartTime = `${entry.date}T${startTime}`;
        const actualEndTime = `${entry.date}T${endTime}`;

        // Build notes with available info
        const noteParts = [`Importato da CSV - ${entry.hours.toFixed(2)}`];
        if (entry.title && entry.title !== '--') noteParts.push(`Titolo: ${entry.title}`);
        if (entry.category) noteParts.push(`Categoria: ${entry.category}`);

        entriesToInsert.push({
          budget_item_id: budgetItemId,
          user_id: userId,
          scheduled_date: entry.date,
          scheduled_start_time: startTime,
          scheduled_end_time: endTime,
          actual_start_time: actualStartTime,
          actual_end_time: actualEndTime,
          notes: noteParts.join(' | '),
          originalEntry: entry
        });
      }

      console.log('[Import] Skip reasons summary:', skipReasons);
      console.log('[Import] Entries ready to insert:', entriesToInsert.length);

      setImportProgress(50);

      // Batch insert entries with duplicate check
      if (entriesToInsert.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < entriesToInsert.length; i += batchSize) {
          const batch = entriesToInsert.slice(i, i + batchSize);
          
          // Check for existing entries to avoid duplicates
          // Include start/end time to allow multiple entries on same day
          for (const item of batch) {
            const { data: existing } = await supabase
              .from('activity_time_tracking')
              .select('id')
              .eq('user_id', item.user_id)
              .eq('budget_item_id', item.budget_item_id)
              .eq('scheduled_date', item.scheduled_date)
              .eq('scheduled_start_time', item.scheduled_start_time)
              .eq('scheduled_end_time', item.scheduled_end_time)
              .maybeSingle();

            const { originalEntry, ...insertData } = item;

            if (existing) {
              // Update existing entry (upsert)
              const { error: updateError } = await supabase
                .from('activity_time_tracking')
                .update({
                  actual_start_time: insertData.actual_start_time,
                  actual_end_time: insertData.actual_end_time,
                  notes: insertData.notes,
                })
                .eq('id', existing.id);

              if (updateError) {
                console.error('Error updating entry:', updateError);
                results.push({
                  entry: originalEntry,
                  status: 'error',
                  reason: `Errore aggiornamento: ${updateError.message}`
                });
                skippedCount++;
              } else {
                results.push({
                  entry: originalEntry,
                  status: 'success',
                  reason: 'Aggiornata (esistente)'
                });
                importedCount++;
              }
            } else {
              const { error: insertError } = await supabase
                .from('activity_time_tracking')
                .insert(insertData);

              if (insertError) {
                console.error('Error inserting entry:', insertError);
                results.push({
                  entry: originalEntry,
                  status: 'error',
                  reason: `Errore database: ${insertError.message}`
                });
                skippedCount++;
              } else {
                results.push({
                  entry: originalEntry,
                  status: 'success'
                });
                importedCount++;
              }
            }
          }

          // Update progress
          const progressPercent = 50 + ((i + batchSize) / entriesToInsert.length) * 50;
          setImportProgress(Math.min(progressPercent, 100));
        }
      }

      // Build skip reasons summary for report
      const skipReasonsSummary: Record<string, number> = {};
      for (const r of results) {
        if (r.status === 'skipped' && r.reason) {
          skipReasonsSummary[r.reason] = (skipReasonsSummary[r.reason] || 0) + 1;
        }
      }
      console.log('[Import] Final skip reasons:', skipReasonsSummary);
      console.log('[Import] Total results:', results.length, 'imported:', importedCount, 'skipped:', skippedCount);

      setImportResults(results);
      setStats({
        total: entries.length,
        matched: importedCount,
        skipped: skippedCount,
        usersCreated: usersCreatedCount
      });
      setShowReport(true);

      // Save last import date
      const now = new Date().toISOString();
      localStorage.setItem('lastTimesheetImportDate', now);
      setLastImportDate(now);

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
      setImportProgress(100);
    }
  };

  const resetImport = () => {
    setFile(null);
    setEntries([]);
    setProjectMatches([]);
    setUserMatches([]);
    setStats(null);
    setImportResults([]);
    setShowReport(false);
    setImportProgress(0);
    setBudgetItems([]);
    setSelectedBudgetItemId(CREATE_NEW_ACTIVITY_VALUE);
    setExcludedEntries(new Set());
    setPreviewFilter('all');
    setDuplicateEntries(new Set());
    setAllDbProjects([]);
  };

  // Check for duplicates in the database
  const checkDuplicates = async () => {
    if (entries.length === 0 || projectMatches.length === 0 || userMatches.length === 0) return;

    setCheckingDuplicates(true);
    const duplicates = new Set<number>();

    try {
      // Create maps for quick lookups
      const projectMap = new Map<string, string>();
      for (const pm of projectMatches) {
        if (pm.matched && pm.projectId) {
          projectMap.set(pm.projectName.toLowerCase(), pm.projectId);
        }
      }

      const userMap = new Map<string, string>();
      for (const um of userMatches) {
        if (um.matched && um.userId) {
          userMap.set(um.userName.toLowerCase(), um.userId);
        }
      }

      // Get all budget items for matched projects to check duplicates
      const matchedProjectIds = Array.from(projectMap.values());
      if (matchedProjectIds.length === 0) {
        setDuplicateEntries(duplicates);
        setCheckingDuplicates(false);
        return;
      }

      // Get ALL budget items for matched projects to check for duplicates across all activities
      const { data: allBudgetItems } = await supabase
        .from('budget_items')
        .select('id, project_id')
        .in('project_id', matchedProjectIds);

      const budgetItemIds = allBudgetItems?.map(bi => bi.id) || [];

      if (budgetItemIds.length === 0) {
        // No existing budget items means no duplicates possible
        setDuplicateEntries(duplicates);
        setCheckingDuplicates(false);
        return;
      }

      // Fetch ALL existing time tracking entries with batching + pagination
      let allExistingEntries: any[] = [];
      const idBatchSize = 100;
      const pageSize = 1000;

      for (let b = 0; b < budgetItemIds.length; b += idBatchSize) {
        const idsBatch = budgetItemIds.slice(b, b + idBatchSize);
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data: page } = await supabase
            .from('activity_time_tracking')
            .select('user_id, scheduled_date, scheduled_start_time, scheduled_end_time, budget_item_id')
            .in('budget_item_id', idsBatch)
            .range(offset, offset + pageSize - 1);

          if (page && page.length > 0) {
            allExistingEntries = [...allExistingEntries, ...page];
            offset += pageSize;
            hasMore = page.length === pageSize;
          } else {
            hasMore = false;
          }
        }
      }

      if (allExistingEntries.length === 0) {
        setDuplicateEntries(duplicates);
        setCheckingDuplicates(false);
        return;
      }

      // Create a lookup set for existing entries
      const existingSet = new Set(
        allExistingEntries.map(e => 
          `${e.user_id}|${e.scheduled_date}|${e.scheduled_start_time}|${e.scheduled_end_time}`
        )
      );

      // Check each entry for duplicates
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const userId = userMap.get(entry.userName.toLowerCase());
        if (!userId) continue;

        // Calculate times same as import logic
        let startTime: string;
        let endTime: string;
        
        if (entry.startTime && entry.endTime) {
          startTime = `${entry.startTime}:00`;
          endTime = `${entry.endTime}:00`;
        } else {
          // Fallback: stack from workDayStart (08:00 default) - same logic as import
          const startHour = 8;
          const endHour = startHour + Math.floor(entry.hours);
          const endMinutes = Math.round((entry.hours % 1) * 60);
          startTime = `${startHour.toString().padStart(2, '0')}:00:00`;
          endTime = `${endHour.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00`;
        }

        const key = `${userId}|${entry.date}|${startTime}|${endTime}`;
        if (existingSet.has(key)) {
          duplicates.add(i);
        }
      }

      setDuplicateEntries(duplicates);

      if (duplicates.size > 0) {
        toast({
          title: 'Duplicati trovati',
          description: `${duplicates.size} entry sono già presenti nel database e verranno aggiornate`,
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const exportReport = () => {
    const successEntries = importResults.filter(r => r.status === 'success');
    const errorEntries = importResults.filter(r => r.status === 'error');
    const skippedEntries = importResults.filter(r => r.status === 'skipped');

    let csvContent = "Status;Utente;Data;Ore;Progetto;Motivo\n";
    
    for (const result of importResults) {
      const status = result.status === 'success' ? 'Importato' : 
                     result.status === 'error' ? 'Errore' : 'Ignorato';
      csvContent += `${status};${result.entry.userName};${result.entry.date};${result.entry.hours};${result.entry.projectName};${result.reason || ''}\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report-importazione-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const successResults = importResults.filter(r => r.status === 'success');
  const errorResults = importResults.filter(r => r.status === 'error');
  const skippedResults = importResults.filter(r => r.status === 'skipped');

  // Helper functions for preview filtering
  const getEntryStatus = (entry: TimesheetEntry, index: number) => {
    const pm = projectMatches.find(p => p.projectName === entry.projectName);
    const um = userMatches.find(u => u.userName === entry.userName);
    const canImport = pm?.matched && (um?.matched || um?.toCreate);
    const isExcluded = excludedEntries.has(index);
    const isDuplicate = duplicateEntries.has(index);
    return { canImport, isExcluded, isDuplicate, willImport: canImport && !isExcluded };
  };

  const toggleEntryExclusion = (index: number) => {
    setExcludedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const filteredPreviewEntries = entries.map((entry, index) => ({ entry, index, ...getEntryStatus(entry, index) }))
    .filter(item => {
      if (previewFilter === 'toImport') return item.willImport;
      if (previewFilter === 'toSkip') return !item.willImport;
      if (previewFilter === 'duplicates') return item.isDuplicate;
      return true;
    });

  const entriesToImportCount = entries.filter((e, i) => getEntryStatus(e, i).willImport).length;
  const entriesToSkipCount = entries.length - entriesToImportCount;
  const duplicatesCount = duplicateEntries.size;

  const selectAllVisible = () => {
    // Remove exclusions for all visible entries that can be imported
    setExcludedEntries(prev => {
      const newSet = new Set(prev);
      filteredPreviewEntries.forEach(item => {
        if (item.canImport) {
          newSet.delete(item.index);
        }
      });
      return newSet;
    });
  };

  const deselectAllVisible = () => {
    // Add exclusions for all visible entries that can be imported
    setExcludedEntries(prev => {
      const newSet = new Set(prev);
      filteredPreviewEntries.forEach(item => {
        if (item.canImport) {
          newSet.add(item.index);
        }
      });
      return newSet;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Importa Timesheet da CSV</CardTitle>
            <CardDescription>
              Carica un file CSV con colonne: UTENTE;DATA;GIORNO;ORE;PROGETTO;CLIENTE. 
              Le entry di progetti non presenti verranno ignorate. Gli utenti mancanti verranno creati come eliminati.
            </CardDescription>
          </div>
          {lastImportDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
              <Clock className="h-4 w-4" />
              <span>
                Ultimo import: {format(new Date(lastImportDate), "dd MMM yyyy 'alle' HH:mm", { locale: it })}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showReport ? (
          <>
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

            {importing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Importazione in corso...</span>
                  <span>{Math.round(importProgress)}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            )}

            {entries.length > 0 && !importing && (
              <>
                {/* Project Matches */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Progetti ({projectMatches.filter(p => p.matched).length}/{projectMatches.length} matchati)</h4>
                    {projectMatches.some(pm => !pm.matched && !pm.manuallyMapped) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          setProjectMatches(prev => prev.map(pm => {
                            if (pm.matched || pm.manuallyMapped) return pm;
                            const best = findBestMatch(pm.projectName, allDbProjects);
                            if (best) {
                              return { ...pm, projectId: best.id, matched: true, manuallyMapped: true };
                            }
                            return pm;
                          }));
                        }}
                      >
                        <Wand2 className="h-3 w-3" />
                        Auto-mappa tutti
                      </Button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto border rounded-lg p-2">
                    <div className="space-y-2">
                      {projectMatches.map((pm, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          {pm.matched ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                          )}
                          <span className={cn("shrink-0", pm.matched && !pm.manuallyMapped ? '' : 'text-muted-foreground')}>
                            {pm.projectName}
                          </span>
                          {pm.manuallyMapped && (
                            <span className="text-xs text-muted-foreground">→</span>
                          )}
                          {pm.manuallyMapped && (
                            <Badge variant="secondary" className="text-xs">
                              {allDbProjects.find(p => p.id === pm.projectId)?.name || ''}
                            </Badge>
                          )}
                          {!pm.matched && !pm.manuallyMapped && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 w-[250px] justify-between text-xs font-normal">
                                  <span className="text-muted-foreground">Mappa a progetto...</span>
                                  <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[350px] p-0 z-50" align="start">
                                <Command>
                                  <CommandInput placeholder="Cerca progetto..." className="text-xs" />
                                  <CommandList>
                                    <CommandEmpty>Nessun progetto trovato.</CommandEmpty>
                                    <CommandGroup>
                                      {allDbProjects.map(p => (
                                        <CommandItem
                                          key={p.id}
                                          value={p.name}
                                          className="text-xs"
                                          onSelect={() => {
                                            setProjectMatches(prev => prev.map((pm2, i) => 
                                              i === idx ? { ...pm2, projectId: p.id, matched: true, manuallyMapped: true } : pm2
                                            ));
                                          }}
                                        >
                                          {p.name}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          )}
                          {pm.manuallyMapped && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setProjectMatches(prev => prev.map((p, i) => 
                                  i === idx ? { ...p, projectId: null, matched: false, manuallyMapped: false } : p
                                ));
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
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

                {/* Budget Activity Selector - only for single project import */}
                {projectId && budgetItems.length >= 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Assegna ore a:</Label>
                    <Select
                      value={selectedBudgetItemId}
                      onValueChange={setSelectedBudgetItemId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleziona attività..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CREATE_NEW_ACTIVITY_VALUE}>
                          <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            <span>Crea nuova attività "Ore importate"</span>
                          </div>
                        </SelectItem>
                        {budgetItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {item.category}
                              </Badge>
                              <span>{item.activity_name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {selectedBudgetItemId === CREATE_NEW_ACTIVITY_VALUE 
                        ? 'Verrà creata una nuova attività "Ore importate" nel budget'
                        : `Le ore verranno assegnate all'attività selezionata`}
                    </p>
                  </div>
                )}

                {/* Entry Preview with status and filters */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-medium text-sm">Anteprima entry ({entries.length} totali)</h4>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="default" className="bg-primary">
                        {entriesToImportCount} da importare
                      </Badge>
                      <Badge variant="secondary">
                        {entriesToSkipCount} da ignorare
                      </Badge>
                      {duplicatesCount > 0 && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          <Copy className="h-3 w-3 mr-1" />
                          {duplicatesCount} duplicati
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Duplicate check button */}
                  <div className="flex items-center gap-3 p-3 bg-muted/50 border border-dashed rounded-lg">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={checkDuplicates}
                      disabled={checkingDuplicates || entries.length === 0}
                    >
                      {checkingDuplicates ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Controllo...
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Controlla duplicati
                        </>
                      )}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Verifica quali entry esistono già nel database prima di importare
                    </span>
                  </div>

                  {/* Filter and selection controls */}
                  <div className="flex items-center justify-between flex-wrap gap-2 p-2 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <Select value={previewFilter} onValueChange={(v) => setPreviewFilter(v as 'all' | 'toImport' | 'toSkip' | 'duplicates')}>
                        <SelectTrigger className="w-[180px] h-8">
                          <SelectValue placeholder="Filtra..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutte ({entries.length})</SelectItem>
                          <SelectItem value="toImport">Da importare ({entriesToImportCount})</SelectItem>
                          <SelectItem value="toSkip">Da ignorare ({entriesToSkipCount})</SelectItem>
                          <SelectItem value="duplicates">Solo duplicati ({duplicatesCount})</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={selectAllVisible}
                        className="h-8"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Seleziona visibili
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={deselectAllVisible}
                        className="h-8"
                      >
                        <EyeOff className="h-3 w-3 mr-1" />
                        Deseleziona visibili
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-lg max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px] sticky top-0 bg-background">Incl.</TableHead>
                          <TableHead className="w-[60px] sticky top-0 bg-background">Stato</TableHead>
                          <TableHead className="sticky top-0 bg-background">Utente</TableHead>
                          <TableHead className="sticky top-0 bg-background">Data</TableHead>
                          <TableHead className="sticky top-0 bg-background">Ore</TableHead>
                          <TableHead className="sticky top-0 bg-background">Progetto</TableHead>
                          <TableHead className="sticky top-0 bg-background">Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPreviewEntries.map((item) => {
                          const { entry, index, canImport, isExcluded, isDuplicate, willImport } = item;
                          
                          let reason = '';
                          const projectMatch = projectMatches.find(p => p.projectName === entry.projectName);
                          const userMatch = userMatches.find(u => u.userName === entry.userName);
                          
                          if (!projectMatch?.matched) {
                            reason = 'Progetto non trovato';
                          } else if (!userMatch?.matched && !userMatch?.toCreate) {
                            reason = 'Utente non trovato';
                          } else if (isDuplicate && isExcluded) {
                            reason = 'Duplicato (già nel DB)';
                          } else if (isExcluded) {
                            reason = 'Escluso manualmente';
                          }
                          
                          return (
                            <TableRow 
                              key={index}
                              className={cn(
                                willImport ? 'bg-primary/5' : 'bg-muted/30 opacity-70',
                                isDuplicate && 'bg-amber-50 dark:bg-amber-950/20'
                              )}
                            >
                              <TableCell>
                                <Checkbox 
                                  checked={canImport ? !isExcluded : false}
                                  disabled={!canImport}
                                  onCheckedChange={() => toggleEntryExclusion(index)}
                                />
                              </TableCell>
                              <TableCell>
                                {isDuplicate ? (
                                  <Copy className="h-4 w-4 text-amber-500" />
                                ) : willImport ? (
                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                ) : isExcluded && canImport ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{entry.userName}</TableCell>
                              <TableCell>{entry.date}</TableCell>
                              <TableCell>{entry.hours}h</TableCell>
                              <TableCell className="max-w-[200px] truncate">{entry.projectName}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{reason}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleImport}
                    disabled={importing || entriesToImportCount === 0}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {importing ? 'Importazione...' : `Importa ${entriesToImportCount} entry`}
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
          </>
        ) : (
          /* Import Report */
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-2">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{stats?.total || 0}</div>
                    <div className="text-sm text-muted-foreground">Totali</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{successResults.length}</div>
                    <div className="text-sm text-muted-foreground">Importate</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">{errorResults.length}</div>
                    <div className="text-sm text-muted-foreground">Errori</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-600">{skippedResults.length}</div>
                    <div className="text-sm text-muted-foreground">Ignorate</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {stats?.usersCreated && stats.usersCreated > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-blue-600" />
                  <span><strong>{stats.usersCreated}</strong> utenti creati come eliminati</span>
                </div>
              </div>
            )}

            {/* Skip reasons breakdown */}
            {skippedResults.length > 0 && (() => {
              const reasonCounts: Record<string, number> = {};
              skippedResults.forEach(r => {
                const reason = r.reason || 'Motivo sconosciuto';
                reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
              });
              return (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg text-sm space-y-1">
                  <div className="font-medium text-amber-800 dark:text-amber-300 mb-1">Dettaglio entry ignorate:</div>
                  {Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                    <div key={reason} className="flex justify-between text-amber-700 dark:text-amber-400">
                      <span>{reason}</span>
                      <span className="font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Detailed Results Tabs */}
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">
                  Tutte ({importResults.length})
                </TabsTrigger>
                <TabsTrigger value="success" className="text-green-600">
                  Importate ({successResults.length})
                </TabsTrigger>
                <TabsTrigger value="errors" className="text-red-600">
                  Errori ({errorResults.length})
                </TabsTrigger>
                <TabsTrigger value="skipped" className="text-amber-600">
                  Ignorate ({skippedResults.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <ScrollArea className="h-80 border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead>Utente</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ore</TableHead>
                        <TableHead>Progetto</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResults.map((result, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            {result.status === 'success' && (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                OK
                              </Badge>
                            )}
                            {result.status === 'error' && (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Errore
                              </Badge>
                            )}
                            {result.status === 'skipped' && (
                              <Badge variant="secondary">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Ignorato
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{result.entry.userName}</TableCell>
                          <TableCell>{result.entry.date}</TableCell>
                          <TableCell>{result.entry.hours}h</TableCell>
                          <TableCell className="max-w-[150px] truncate">{result.entry.projectName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {result.reason || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="success" className="mt-4">
                <ScrollArea className="h-80 border rounded-lg">
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
                      {successResults.map((result, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{result.entry.userName}</TableCell>
                          <TableCell>{result.entry.date}</TableCell>
                          <TableCell>{result.entry.hours}h</TableCell>
                          <TableCell className="max-w-[200px] truncate">{result.entry.projectName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="errors" className="mt-4">
                <ScrollArea className="h-80 border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Utente</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ore</TableHead>
                        <TableHead>Progetto</TableHead>
                        <TableHead>Errore</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errorResults.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Nessun errore durante l'importazione
                          </TableCell>
                        </TableRow>
                      ) : (
                        errorResults.map((result, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{result.entry.userName}</TableCell>
                            <TableCell>{result.entry.date}</TableCell>
                            <TableCell>{result.entry.hours}h</TableCell>
                            <TableCell className="max-w-[150px] truncate">{result.entry.projectName}</TableCell>
                            <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                              {result.reason}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="skipped" className="mt-4">
                <ScrollArea className="h-80 border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Utente</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ore</TableHead>
                        <TableHead>Progetto</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {skippedResults.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Nessuna entry ignorata
                          </TableCell>
                        </TableRow>
                      ) : (
                        skippedResults.map((result, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{result.entry.userName}</TableCell>
                            <TableCell>{result.entry.date}</TableCell>
                            <TableCell>{result.entry.hours}h</TableCell>
                            <TableCell className="max-w-[150px] truncate">{result.entry.projectName}</TableCell>
                            <TableCell className="text-sm text-amber-600 max-w-[200px] truncate">
                              {result.reason}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button onClick={exportReport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Esporta Report CSV
              </Button>
              <Button onClick={resetImport}>
                <FileText className="h-4 w-4 mr-2" />
                Nuova Importazione
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

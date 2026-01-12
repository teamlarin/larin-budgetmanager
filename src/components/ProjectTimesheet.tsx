import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Clock, CheckCircle, Download, Filter, X, Percent, Calculator, Settings, Share2, Copy, Link2, Upload, Trash2 } from 'lucide-react';
import { TimesheetImport } from './TimesheetImport';

interface ProjectTimesheetProps {
  projectId: string;
}

interface TimeEntry {
  id: string;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  notes: string | null;
  user_id: string;
  budget_item_id: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  };
  budget_items?: {
    activity_name: string;
    category: string;
  };
}

// Percentage adjustments by user and category
interface PercentageAdjustment {
  userAdjustments: Record<string, number>; // userId -> percentage
  categoryAdjustments: Record<string, number>; // category -> percentage
}

export const ProjectTimesheet = ({ projectId }: ProjectTimesheetProps) => {
  const queryClient = useQueryClient();
  const [userFilter, setUserFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  // Percentage adjustments state
  const [adjustments, setAdjustments] = useState<PercentageAdjustment>({
    userAdjustments: {},
    categoryAdjustments: {}
  });
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [tempUserPercentage, setTempUserPercentage] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [tempCategoryPercentage, setTempCategoryPercentage] = useState<string>('');
  
  // Selection state for bulk delete
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Check if current user is admin
  useEffect(() => {
    const checkAdminRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      setIsAdmin(roles?.some(r => r.role === 'admin') || false);
    };
    checkAdminRole();
  }, []);

  // Fetch project data (share token and name)
  const { data: projectData } = useQuery({
    queryKey: ['project-data', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('timesheet_share_token, name')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    }
  });

  // Generate share token mutation
  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const token = crypto.randomUUID();
      const { error } = await supabase
        .from('projects')
        .update({ 
          timesheet_share_token: token,
          timesheet_token_created_at: new Date().toISOString()
        } as any)
        .eq('id', projectId);
      if (error) throw error;
      return token;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-data', projectId] });
      toast.success('Link condivisibile generato (valido per 30 giorni)');
    },
    onError: () => {
      toast.error('Errore nella generazione del link');
    }
  });

  // Delete single entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('activity_time_tracking')
        .delete()
        .eq('id', entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-timesheet', projectId] });
      toast.success('Registrazione eliminata');
    },
    onError: () => {
      toast.error('Errore durante l\'eliminazione');
    }
  });

  // Delete multiple entries mutation
  const deleteEntriesMutation = useMutation({
    mutationFn: async (entryIds: string[]) => {
      const { error } = await supabase
        .from('activity_time_tracking')
        .delete()
        .in('id', entryIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-timesheet', projectId] });
      setSelectedEntries(new Set());
      toast.success('Registrazioni eliminate');
    },
    onError: () => {
      toast.error('Errore durante l\'eliminazione');
    }
  });

  const shareUrl = projectData?.timesheet_share_token 
    ? `${window.location.origin}/timesheet/public?token=${projectData.timesheet_share_token}`
    : null;

  const copyShareLink = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copiato negli appunti');
    }
  };

  // Selection helpers
  const toggleEntrySelection = (entryId: string) => {
    setSelectedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const toggleAllEntries = () => {
    if (selectedEntries.size === filteredEntries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(filteredEntries.map(e => e.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedEntries.size > 0) {
      deleteEntriesMutation.mutate(Array.from(selectedEntries));
    }
  };

  const { data: timeEntries, isLoading } = useQuery({
    queryKey: ['project-timesheet', projectId],
    queryFn: async () => {
      // First get all budget items for this project
      const { data: budgetItems, error: budgetError } = await supabase
        .from('budget_items')
        .select('id, activity_name, category')
        .eq('project_id', projectId);

      if (budgetError) throw budgetError;
      if (!budgetItems?.length) return [];

      const budgetItemIds = budgetItems.map(bi => bi.id);

      // Get all time tracking entries for these budget items
      const { data: timeData, error: timeError } = await supabase
        .from('activity_time_tracking')
        .select('*')
        .in('budget_item_id', budgetItemIds)
        .order('scheduled_date', { ascending: false });

      if (timeError) throw timeError;
      if (!timeData?.length) return [];

      // Get unique user IDs
      const userIds = [...new Set(timeData.map(t => t.user_id))];

      // Get user profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);

      const profilesMap = new Map(
        profiles?.map(p => [p.id, { first_name: p.first_name, last_name: p.last_name }]) || []
      );

      const budgetItemsMap = new Map(
        budgetItems.map(bi => [bi.id, { activity_name: bi.activity_name, category: bi.category }])
      );

      // Combine data
      return timeData.map(entry => ({
        ...entry,
        profiles: profilesMap.get(entry.user_id),
        budget_items: budgetItemsMap.get(entry.budget_item_id)
      })) as TimeEntry[];
    },
    enabled: !!projectId
  });

  const calculateScheduledHours = (startTime: string | null, endTime: string | null): number => {
    if (!startTime || !endTime) return 0;
    
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    
    return (endMinutes - startMinutes) / 60;
  };

  const calculateActualHours = (actualStart: string | null, actualEnd: string | null): number => {
    if (!actualStart || !actualEnd) return 0;
    
    const start = new Date(actualStart);
    const end = new Date(actualEnd);
    return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
  };

  const isConfirmed = (entry: TimeEntry): boolean => {
    return !!(entry.actual_start_time && entry.actual_end_time);
  };

  const getUserName = (entry: TimeEntry): string => {
    return entry.profiles 
      ? `${entry.profiles.first_name || ''} ${entry.profiles.last_name || ''}`.trim() 
      : 'N/A';
  };

  // Get unique users for filter dropdown
  const uniqueUsers = useMemo(() => {
    if (!timeEntries) return [];
    const usersMap = new Map<string, string>();
    timeEntries.forEach(entry => {
      if (!usersMap.has(entry.user_id)) {
        usersMap.set(entry.user_id, getUserName(entry));
      }
    });
    return Array.from(usersMap.entries()).map(([id, name]) => ({ id, name }));
  }, [timeEntries]);

  // Get unique categories
  const uniqueCategories = useMemo(() => {
    if (!timeEntries) return [];
    const categories = new Set<string>();
    timeEntries.forEach(entry => {
      if (entry.budget_items?.category) {
        categories.add(entry.budget_items.category);
      }
    });
    return Array.from(categories);
  }, [timeEntries]);

  // Calculate accounting hours with percentage adjustment (only for confirmed entries)
  // Uses actual times to match ProjectBudgetStats calculation
  const calculateAccountingHours = (entry: TimeEntry): number => {
    // Only calculate accounting hours for confirmed entries
    if (!isConfirmed(entry)) return 0;
    
    const baseHours = calculateActualHours(entry.actual_start_time, entry.actual_end_time);
    const userAdjustment = adjustments.userAdjustments[entry.user_id] || 0;
    const categoryAdjustment = adjustments.categoryAdjustments[entry.budget_items?.category || ''] || 0;
    
    // Apply both adjustments (cumulative)
    const totalAdjustment = userAdjustment + categoryAdjustment;
    return baseHours * (1 + totalAdjustment / 100);
  };

  // Apply percentage adjustment
  const applyUserAdjustment = (userId: string, percentage: number) => {
    setAdjustments(prev => ({
      ...prev,
      userAdjustments: {
        ...prev.userAdjustments,
        [userId]: percentage
      }
    }));
  };

  const applyCategoryAdjustment = (category: string, percentage: number) => {
    setAdjustments(prev => ({
      ...prev,
      categoryAdjustments: {
        ...prev.categoryAdjustments,
        [category]: percentage
      }
    }));
  };

  const clearAdjustments = () => {
    setAdjustments({
      userAdjustments: {},
      categoryAdjustments: {}
    });
  };

  const hasAdjustments = Object.keys(adjustments.userAdjustments).length > 0 || 
                          Object.keys(adjustments.categoryAdjustments).length > 0;

  // Filter entries
  const filteredEntries = useMemo(() => {
    if (!timeEntries) return [];
    
    return timeEntries.filter(entry => {
      // User filter
      if (userFilter !== 'all' && entry.user_id !== userFilter) {
        return false;
      }
      
      // Status filter
      if (statusFilter !== 'all') {
        const confirmed = isConfirmed(entry);
        if (statusFilter === 'confirmed' && !confirmed) return false;
        if (statusFilter === 'planned' && confirmed) return false;
      }
      
      // Date range filter
      if (dateFrom && entry.scheduled_date) {
        if (entry.scheduled_date < dateFrom) return false;
      }
      if (dateTo && entry.scheduled_date) {
        if (entry.scheduled_date > dateTo) return false;
      }
      
      return true;
    });
  }, [timeEntries, userFilter, statusFilter, dateFrom, dateTo]);

  // Calculate totals based on filtered entries
  const totalPlannedHours = filteredEntries.reduce((acc, entry) => {
    return acc + calculateScheduledHours(entry.scheduled_start_time, entry.scheduled_end_time);
  }, 0);

  // Confirmed hours use actual_start_time/actual_end_time to match ProjectBudgetStats
  const totalConfirmedHours = filteredEntries.reduce((acc, entry) => {
    if (isConfirmed(entry)) {
      return acc + calculateActualHours(entry.actual_start_time, entry.actual_end_time);
    }
    return acc;
  }, 0);

  // Calculate accounting totals
  const totalAccountingHours = filteredEntries.reduce((acc, entry) => {
    return acc + calculateAccountingHours(entry);
  }, 0);

  const clearFilters = () => {
    setUserFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = userFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo;

  const exportToExcel = () => {
    const data = filteredEntries.map(entry => {
      const hours = isConfirmed(entry) ? calculateActualHours(entry.actual_start_time, entry.actual_end_time) : calculateScheduledHours(entry.scheduled_start_time, entry.scheduled_end_time);
      const accountingHours = calculateAccountingHours(entry);
      return {
        'Data': entry.scheduled_date 
          ? format(new Date(entry.scheduled_date), 'dd/MM/yyyy', { locale: it })
          : 'N/A',
        'Utente': getUserName(entry),
        'Attività': entry.budget_items?.activity_name || 'N/A',
        'Categoria': entry.budget_items?.category || 'N/A',
        'Ora Inizio': entry.scheduled_start_time?.slice(0, 5) || 'N/A',
        'Ora Fine': entry.scheduled_end_time?.slice(0, 5) || 'N/A',
        'Ore': hours.toFixed(1),
        'Ore Contabili': accountingHours.toFixed(1),
        'Stato': isConfirmed(entry) ? 'Confermata' : 'Pianificata',
        'Note': entry.notes || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheet');
    XLSX.writeFile(wb, `timesheet_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Utente', 'Attività', 'Categoria', 'Ora Inizio', 'Ora Fine', 'Ore', 'Ore Contabili', 'Stato', 'Note'];
    const rows = filteredEntries.map(entry => {
      const hours = isConfirmed(entry) ? calculateActualHours(entry.actual_start_time, entry.actual_end_time) : calculateScheduledHours(entry.scheduled_start_time, entry.scheduled_end_time);
      const accountingHours = calculateAccountingHours(entry);
      return [
        entry.scheduled_date 
          ? format(new Date(entry.scheduled_date), 'dd/MM/yyyy', { locale: it })
          : 'N/A',
        getUserName(entry),
        entry.budget_items?.activity_name || 'N/A',
        entry.budget_items?.category || 'N/A',
        entry.scheduled_start_time?.slice(0, 5) || 'N/A',
        entry.scheduled_end_time?.slice(0, 5) || 'N/A',
        hours.toFixed(1),
        accountingHours.toFixed(1),
        isConfirmed(entry) ? 'Confermata' : 'Pianificata',
        entry.notes || ''
      ];
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `timesheet_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ore Pianificate</p>
                <p className="text-2xl font-bold">{totalPlannedHours.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ore Confermate</p>
                <p className="text-2xl font-bold">{totalConfirmedHours.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Calculator className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ore Contabili</p>
                <p className="text-2xl font-bold">{totalAccountingHours.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtri
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Rimuovi filtri
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Utente</Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti gli utenti" />
                </SelectTrigger>
                <SelectContent className="bg-background border">
                  <SelectItem value="all">Tutti gli utenti</SelectItem>
                  {uniqueUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Stato</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti gli stati" />
                </SelectTrigger>
                <SelectContent className="bg-background border">
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  <SelectItem value="confirmed">Confermata</SelectItem>
                  <SelectItem value="planned">Pianificata</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data da</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Data a</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Entries Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Registrazioni Tempo</CardTitle>
              {isAdmin && selectedEntries.size > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Elimina ({selectedEntries.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                      <AlertDialogDescription>
                        Stai per eliminare {selectedEntries.size} registrazioni di tempo. 
                        Questa azione non può essere annullata.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleBulkDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Elimina
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <div className="flex gap-2">
              {/* Share Dialog */}
              <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Share2 className="h-4 w-4 mr-1" />
                    Condividi
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Link2 className="h-5 w-5" />
                      Condividi Timesheet
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">
                      Genera un link pubblico per condividere il timesheet con le ore contabili confermate.
                    </p>
                    {shareUrl ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input 
                            value={shareUrl} 
                            readOnly 
                            className="flex-1 text-sm"
                          />
                          <Button onClick={copyShareLink} size="sm">
                            <Copy className="h-4 w-4 mr-1" />
                            Copia
                          </Button>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => generateTokenMutation.mutate()}
                          disabled={generateTokenMutation.isPending}
                        >
                          Rigenera link
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        onClick={() => generateTokenMutation.mutate()}
                        disabled={generateTokenMutation.isPending}
                      >
                        <Link2 className="h-4 w-4 mr-1" />
                        {generateTokenMutation.isPending ? 'Generazione...' : 'Genera link condivisibile'}
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Adjustments Dialog */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className={hasAdjustments ? 'border-amber-500 text-amber-600' : ''}>
                    <Settings className="h-4 w-4 mr-1" />
                    Maggiorazioni
                    {hasAdjustments && <span className="ml-1 text-xs">({Object.keys(adjustments.userAdjustments).length + Object.keys(adjustments.categoryAdjustments).length})</span>}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Percent className="h-5 w-5" />
                      Maggiorazioni Percentuali
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    {hasAdjustments && (
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" onClick={clearAdjustments}>
                          <X className="h-4 w-4 mr-1" />
                          Rimuovi tutte
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* User adjustments */}
                      <div className="space-y-3">
                        <Label className="text-base font-medium">Per Utente</Label>
                        <div className="flex gap-2">
                          <Select 
                            value={selectedUserId}
                            onValueChange={setSelectedUserId}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Seleziona utente" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border">
                              {uniqueUsers.map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            placeholder="%"
                            className="w-24"
                            value={tempUserPercentage}
                            onChange={(e) => setTempUserPercentage(e.target.value)}
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              const percentage = parseFloat(tempUserPercentage);
                              if (!isNaN(percentage) && selectedUserId) {
                                applyUserAdjustment(selectedUserId, percentage);
                                setTempUserPercentage('');
                                setSelectedUserId('');
                              }
                            }}
                            disabled={!selectedUserId || !tempUserPercentage}
                          >
                            Applica
                          </Button>
                        </div>
                        {Object.entries(adjustments.userAdjustments).length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Object.entries(adjustments.userAdjustments).map(([userId, percentage]) => {
                              const user = uniqueUsers.find(u => u.id === userId);
                              return (
                                <Badge key={userId} variant="secondary" className="gap-1">
                                  {user?.name}: +{percentage}%
                                  <button
                                    className="ml-1 hover:text-destructive"
                                    onClick={() => {
                                      const newAdjustments = { ...adjustments.userAdjustments };
                                      delete newAdjustments[userId];
                                      setAdjustments(prev => ({ ...prev, userAdjustments: newAdjustments }));
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Category adjustments */}
                      <div className="space-y-3">
                        <Label className="text-base font-medium">Per Categoria</Label>
                        <div className="flex gap-2">
                          <Select 
                            value={selectedCategory}
                            onValueChange={setSelectedCategory}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Seleziona categoria" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border">
                              {uniqueCategories.map(category => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            placeholder="%"
                            className="w-24"
                            value={tempCategoryPercentage}
                            onChange={(e) => setTempCategoryPercentage(e.target.value)}
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              const percentage = parseFloat(tempCategoryPercentage);
                              if (!isNaN(percentage) && selectedCategory) {
                                applyCategoryAdjustment(selectedCategory, percentage);
                                setTempCategoryPercentage('');
                                setSelectedCategory('');
                              }
                            }}
                            disabled={!selectedCategory || !tempCategoryPercentage}
                          >
                            Applica
                          </Button>
                        </div>
                        {Object.entries(adjustments.categoryAdjustments).length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Object.entries(adjustments.categoryAdjustments).map(([category, percentage]) => (
                              <Badge key={category} variant="secondary" className="gap-1">
                                {category}: +{percentage}%
                                <button
                                  className="ml-1 hover:text-destructive"
                                  onClick={() => {
                                    const newAdjustments = { ...adjustments.categoryAdjustments };
                                    delete newAdjustments[category];
                                    setAdjustments(prev => ({ ...prev, categoryAdjustments: newAdjustments }));
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Import Dialog */}
              <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-1" />
                    Importa
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Importa Timesheet
                    </DialogTitle>
                  </DialogHeader>
                  <TimesheetImport 
                    projectId={projectId}
                    projectName={projectData?.name}
                    onImportComplete={() => {
                      setImportDialogOpen(false);
                      queryClient.invalidateQueries({ queryKey: ['project-timesheet', projectId] });
                    }}
                  />
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!filteredEntries.length}>
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!filteredEntries.length}>
                <Download className="h-4 w-4 mr-1" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!filteredEntries.length ? (
            <div className="text-center py-12 text-muted-foreground">
              {timeEntries?.length 
                ? 'Nessun inserimento corrisponde ai filtri selezionati.'
                : 'Nessun inserimento di tempo trovato per questo progetto.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedEntries.size === filteredEntries.length && filteredEntries.length > 0}
                        onCheckedChange={toggleAllEntries}
                      />
                    </TableHead>
                  )}
                  <TableHead>Data</TableHead>
                  <TableHead>Utente</TableHead>
                  <TableHead>Attività</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Orario</TableHead>
                  <TableHead>Ore</TableHead>
                  <TableHead>Ore Contabili</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Note</TableHead>
                  {isAdmin && <TableHead className="w-10">Azioni</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => {
                  const hours = isConfirmed(entry) ? calculateActualHours(entry.actual_start_time, entry.actual_end_time) : calculateScheduledHours(entry.scheduled_start_time, entry.scheduled_end_time);
                  const accountingHours = calculateAccountingHours(entry);
                  const confirmed = isConfirmed(entry);
                  const userName = getUserName(entry);
                  const hasAdjustment = hours !== accountingHours;

                  return (
                    <TableRow key={entry.id} className={selectedEntries.has(entry.id) ? 'bg-muted/50' : ''}>
                      {isAdmin && (
                        <TableCell>
                          <Checkbox
                            checked={selectedEntries.has(entry.id)}
                            onCheckedChange={() => toggleEntrySelection(entry.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        {entry.scheduled_date 
                          ? format(new Date(entry.scheduled_date), 'dd/MM/yyyy', { locale: it })
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium">{userName}</TableCell>
                      <TableCell>{entry.budget_items?.activity_name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.budget_items?.category || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>
                        {entry.scheduled_start_time && entry.scheduled_end_time
                          ? `${entry.scheduled_start_time.slice(0, 5)} - ${entry.scheduled_end_time.slice(0, 5)}`
                          : 'N/A'}
                      </TableCell>
                      <TableCell>{hours.toFixed(1)}h</TableCell>
                      <TableCell>
                        {confirmed ? (
                          <>
                            <span className={hasAdjustment ? 'font-semibold text-amber-600' : ''}>
                              {accountingHours.toFixed(1)}h
                            </span>
                            {hasAdjustment && (
                              <span className="text-xs text-muted-foreground ml-1">
                                (+{((accountingHours - hours) / hours * 100).toFixed(0)}%)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {confirmed ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Confermata
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            Pianificata
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {entry.notes || '-'}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Stai per eliminare questa registrazione di tempo. 
                                  Questa azione non può essere annullata.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteEntryMutation.mutate(entry.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Elimina
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

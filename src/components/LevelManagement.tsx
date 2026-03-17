import { useState, useMemo } from 'react';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { AREA_LABELS, getAreaColor, getAreaLabel } from '@/lib/areaColors';

const levelSchema = z.object({
  name: z.string().trim().min(1, 'Il nome è obbligatorio').max(100, 'Il nome deve essere meno di 100 caratteri'),
  hourly_rate: z.number().min(0, 'Il costo deve essere maggiore o uguale a 0').max(9999, 'Il costo deve essere meno di 10000'),
  areas: z.array(z.enum(['marketing', 'tech', 'branding', 'sales', 'interno'])).min(1, 'Seleziona almeno un\'area'),
});

type LevelFormData = z.infer<typeof levelSchema>;

type Level = {
  id: string;
  name: string;
  hourly_rate: number;
  areas: ('marketing' | 'tech' | 'branding' | 'sales' | 'interno')[];
  created_at: string;
};

type LevelArea = 'marketing' | 'tech' | 'branding' | 'sales' | 'interno';

type SortField = 'name' | 'hourly_rate';
type SortDirection = 'asc' | 'desc' | null;

export const LevelManagement = () => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<Level | null>(null);
  const [formData, setFormData] = useState<LevelFormData>({
    name: '',
    hourly_rate: 0,
    areas: [],
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof LevelFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [areaFilter, setAreaFilter] = useState<LevelArea | 'all'>('all');
  const ITEMS_PER_PAGE = 20;

  const { data: allLevels = [], isLoading, refetch } = useQuery({
    queryKey: ['levels'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('levels')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Level[];
    },
  });

  const filteredLevels = useMemo(() => {
    if (areaFilter === 'all') return allLevels;
    return allLevels.filter(level => level.areas.includes(areaFilter));
  }, [allLevels, areaFilter]);

  const sortedLevels = useMemo(() => {
    if (!sortField || !sortDirection) return filteredLevels;

    return [...filteredLevels].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [filteredLevels, sortField, sortDirection]);

  const paginatedLevels = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedLevels.slice(startIndex, endIndex);
  }, [sortedLevels, currentPage]);

  const totalPages = Math.ceil(sortedLevels.length / ITEMS_PER_PAGE);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-2" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 ml-2" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-4 w-4 ml-2" />;
    }
    return <ArrowUpDown className="h-4 w-4 ml-2" />;
  };

  const handleOpenDialog = (level?: Level) => {
    if (level) {
      setEditingLevel(level);
      setFormData({
        name: level.name,
        hourly_rate: level.hourly_rate,
        areas: level.areas,
      });
    } else {
      setEditingLevel(null);
      setFormData({
        name: '',
        hourly_rate: 0,
        areas: [],
      });
    }
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingLevel(null);
    setFormData({
      name: '',
      hourly_rate: 0,
      areas: [],
    });
    setFormErrors({});
  };

  const handleAreaToggle = (area: LevelArea) => {
    setFormData(prev => ({
      ...prev,
      areas: prev.areas.includes(area)
        ? prev.areas.filter(a => a !== area)
        : [...prev.areas, area]
    }));
  };

  const validateForm = (): boolean => {
    try {
      levelSchema.parse(formData);
      setFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Partial<Record<keyof LevelFormData, string>> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as keyof LevelFormData] = err.message;
          }
        });
        setFormErrors(errors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (editingLevel) {
        const { error } = await supabase
          .from('levels')
          .update({
            name: formData.name,
            hourly_rate: formData.hourly_rate,
            areas: formData.areas,
          })
          .eq('id', editingLevel.id);

        if (error) throw error;

        toast({
          title: 'Livello aggiornato',
          description: 'Il livello è stato aggiornato con successo.',
        });
      } else {
        const { error } = await supabase
          .from('levels')
          .insert({
            user_id: user.id,
            name: formData.name,
            hourly_rate: formData.hourly_rate,
            areas: formData.areas,
          } as any);

        if (error) throw error;

        toast({
          title: 'Livello creato',
          description: 'Il livello è stato creato con successo.',
        });
      }

      refetch();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving level:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante il salvataggio.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo livello?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('levels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Livello eliminato',
        description: 'Il livello è stato eliminato con successo.',
      });
      refetch();
    } catch (error) {
      console.error('Error deleting level:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante l\'eliminazione.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Livelli</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Gestione Livelli</h2>
              <p className="text-sm text-muted-foreground">Totale: {filteredLevels.length} {filteredLevels.length === 1 ? 'livello' : 'livelli'}</p>
            </div>
            <Select value={areaFilter} onValueChange={(value) => setAreaFilter(value as LevelArea | 'all')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtra per area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le aree</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="tech">Tech</SelectItem>
                <SelectItem value="branding">Branding</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="struttura">Struttura</SelectItem>
                <SelectItem value="ai">Jarvis</SelectItem>
                <SelectItem value="interno">Interno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Nuovo livello
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleSort('name')}>
                    Nome
                    {getSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead className="w-[300px]">
                  Aree
                </TableHead>
                <TableHead className="w-[200px]">
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleSort('hourly_rate')}>
                    Costo orario
                    {getSortIcon('hourly_rate')}
                  </div>
                </TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLevels.map((level) => (
                <TableRow key={level.id}>
                  <TableCell>{level.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {level.areas.map(area => (
                        <Badge key={area} variant="outline" className={getAreaColor(area as any)}>
                          {getAreaLabel(area as any)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>€ {level.hourly_rate.toFixed(2)}/h</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog(level)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(level.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNum)}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLevel ? 'Modifica livello' : 'Nuovo livello'}
            </DialogTitle>
            <DialogDescription>
              {editingLevel 
                ? 'Modifica i dettagli del livello.'
                : 'Inserisci i dettagli del nuovo livello.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="es. Junior Designer"
                />
                {formErrors.name && (
                  <p className="text-sm text-destructive">{formErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourly_rate">Costo orario (€) *</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.hourly_rate || ''}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
                {formErrors.hourly_rate && (
                  <p className="text-sm text-destructive">{formErrors.hourly_rate}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Aree *</Label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(AREA_LABELS).map(([value, label]) => (
                    <div key={value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`area-${value}`}
                        checked={formData.areas.includes(value as LevelArea)}
                        onChange={() => handleAreaToggle(value as LevelArea)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <Label htmlFor={`area-${value}`} className="font-normal cursor-pointer">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
                {formErrors.areas && (
                  <p className="text-sm text-destructive">{formErrors.areas}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Annulla
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvataggio...' : editingLevel ? 'Salva' : 'Crea'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

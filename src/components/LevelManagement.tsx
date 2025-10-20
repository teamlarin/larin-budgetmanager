import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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

const levelSchema = z.object({
  name: z.string().trim().min(1, 'Il nome è obbligatorio').max(100, 'Il nome deve essere meno di 100 caratteri'),
  hourly_rate: z.number().min(0, 'Il costo deve essere maggiore o uguale a 0').max(9999, 'Il costo deve essere meno di 10000'),
  area: z.enum(['marketing', 'tech', 'branding', 'sales'], {
    required_error: 'Seleziona un\'area',
  }),
});

type LevelFormData = z.infer<typeof levelSchema>;

type Level = {
  id: string;
  name: string;
  hourly_rate: number;
  area: 'marketing' | 'tech' | 'branding' | 'sales';
  created_at: string;
};

const areaLabels: Record<string, string> = {
  marketing: 'Marketing',
  tech: 'Tech',
  branding: 'Branding',
  sales: 'Sales',
};

const areaColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  marketing: 'default',
  tech: 'secondary',
  branding: 'outline',
  sales: 'destructive',
};

export const LevelManagement = () => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<Level | null>(null);
  const [formData, setFormData] = useState<LevelFormData>({
    name: '',
    hourly_rate: 0,
    area: 'marketing',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof LevelFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: levels = [], isLoading, refetch } = useQuery({
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
      return data as Level[];
    },
  });

  const handleOpenDialog = (level?: Level) => {
    if (level) {
      setEditingLevel(level);
      setFormData({
        name: level.name,
        hourly_rate: level.hourly_rate,
        area: level.area,
      });
    } else {
      setEditingLevel(null);
      setFormData({
        name: '',
        hourly_rate: 0,
        area: 'marketing',
      });
    }
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingLevel(null);
    setFormData({ name: '', hourly_rate: 0, area: 'marketing' });
    setFormErrors({});
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
            area: formData.area,
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
            area: formData.area,
          });

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
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Livelli</CardTitle>
              <CardDescription>
                Gestisci i livelli professionali con i relativi costi orari
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Livello
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {levels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nessun livello trovato</p>
              <p className="text-sm mt-1">Inizia creando il tuo primo livello</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Costo Orario</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map((level) => (
                  <TableRow key={level.id}>
                    <TableCell className="font-medium">{level.name}</TableCell>
                    <TableCell>
                      <Badge variant={areaColors[level.area]}>
                        {areaLabels[level.area]}
                      </Badge>
                    </TableCell>
                    <TableCell>€{level.hourly_rate.toFixed(2)}/h</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingLevel ? 'Modifica Livello' : 'Nuovo Livello'}
              </DialogTitle>
              <DialogDescription>
                Inserisci i dettagli del livello professionale
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="es. Senior Developer, Junior Designer"
                  maxLength={100}
                />
                {formErrors.name && (
                  <p className="text-sm text-destructive">{formErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="area">Area *</Label>
                <Select
                  value={formData.area}
                  onValueChange={(value: 'marketing' | 'tech' | 'branding' | 'sales') =>
                    setFormData({ ...formData, area: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="tech">Tech</SelectItem>
                    <SelectItem value="branding">Branding</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.area && (
                  <p className="text-sm text-destructive">{formErrors.area}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourly_rate">Costo Orario (€) *</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="9999"
                  value={formData.hourly_rate}
                  onChange={(e) =>
                    setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="es. 45.00"
                />
                {formErrors.hourly_rate && (
                  <p className="text-sm text-destructive">{formErrors.hourly_rate}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Annulla
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvataggio...' : editingLevel ? 'Aggiorna' : 'Crea'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

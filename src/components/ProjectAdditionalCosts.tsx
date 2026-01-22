import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectAdditionalCostsProps {
  projectId: string;
  onTotalChange?: (total: number) => void;
  readOnly?: boolean;
}

interface AdditionalCost {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  supplier_id: string | null;
  created_at: string;
  suppliers?: { id: string; name: string } | null;
}

interface Supplier {
  id: string;
  name: string;
}

export const ProjectAdditionalCosts = ({ projectId, onTotalChange, readOnly = false }: ProjectAdditionalCostsProps) => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<AdditionalCost | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    supplier_id: ''
  });

  const { data: costs = [], isLoading } = useQuery({
    queryKey: ['project-additional-costs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_additional_costs')
        .select('*, suppliers(id, name)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AdditionalCost[];
    },
    enabled: !!projectId
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data as Supplier[];
    }
  });

  // Calculate total and notify parent
  const totalCosts = costs.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
  
  // Notify parent of total change
  useState(() => {
    onTotalChange?.(totalCosts);
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; amount: number; supplier_id: string | null }) => {
      const { error } = await supabase
        .from('project_additional_costs')
        .insert({
          project_id: projectId,
          user_id: currentUser?.id,
          name: data.name,
          description: data.description || null,
          amount: data.amount,
          supplier_id: data.supplier_id
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-additional-costs', projectId] });
      toast.success('Spesa aggiunta');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      console.error('Error creating cost:', error);
      toast.error('Errore durante il salvataggio');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description: string; amount: number; supplier_id: string | null }) => {
      const { error } = await supabase
        .from('project_additional_costs')
        .update({
          name: data.name,
          description: data.description || null,
          amount: data.amount,
          supplier_id: data.supplier_id
        })
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-additional-costs', projectId] });
      toast.success('Spesa aggiornata');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      console.error('Error updating cost:', error);
      toast.error('Errore durante l\'aggiornamento');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_additional_costs')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-additional-costs', projectId] });
      toast.success('Spesa eliminata');
    },
    onError: (error) => {
      console.error('Error deleting cost:', error);
      toast.error('Errore durante l\'eliminazione');
    }
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', amount: '', supplier_id: '' });
    setEditingCost(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    
    if (!formData.name.trim()) {
      toast.error('Inserisci un nome per la spesa');
      return;
    }
    
    if (isNaN(amount) || amount <= 0) {
      toast.error('Inserisci un importo valido');
      return;
    }

    const supplierIdValue = formData.supplier_id === 'none' || formData.supplier_id === '' ? null : formData.supplier_id;

    if (editingCost) {
      updateMutation.mutate({
        id: editingCost.id,
        name: formData.name.trim(),
        description: formData.description.trim(),
        amount,
        supplier_id: supplierIdValue
      });
    } else {
      createMutation.mutate({
        name: formData.name.trim(),
        description: formData.description.trim(),
        amount,
        supplier_id: supplierIdValue
      });
    }
  };

  const handleEdit = (cost: AdditionalCost) => {
    setEditingCost(cost);
    setFormData({
      name: cost.name,
      description: cost.description || '',
      amount: cost.amount.toString(),
      supplier_id: cost.supplier_id || ''
    });
    setIsDialogOpen(true);
  };

  const formatCurrency = (value: number) => 
    `€${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Spese Aggiuntive</h4>
          {costs.length > 0 && (
            <span className="text-sm text-muted-foreground">
              (Totale: {formatCurrency(totalCosts)})
            </span>
          )}
        </div>
        {!readOnly && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Aggiungi
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCost ? 'Modifica Spesa' : 'Nuova Spesa Aggiuntiva'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Es. Consulenza esterna, Software license..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrizione opzionale..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Importo (€) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier">Fornitore</Label>
                <Select
                  value={formData.supplier_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona fornitore (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessun fornitore</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingCost ? 'Salva' : 'Aggiungi'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Caricamento...</div>
      ) : costs.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          Nessuna spesa aggiuntiva inserita
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Fornitore</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="text-right">Importo</TableHead>
              {!readOnly && <TableHead className="w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {costs.map((cost) => (
              <TableRow key={cost.id}>
                <TableCell className="font-medium">{cost.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {cost.suppliers?.name || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate">
                  {cost.description || '-'}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(cost.amount)}</TableCell>
                {!readOnly && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(cost)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Modifica
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(cost.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

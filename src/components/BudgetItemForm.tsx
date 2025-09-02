import { useState, useEffect } from 'react';
import { BudgetItem, Category } from '@/types/budget';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface BudgetItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (item: Omit<BudgetItem, 'id'> | BudgetItem) => void;
  initialData?: BudgetItem;
  isEditing?: boolean;
}

const categories: Category[] = ['Management', 'Design', 'Dev', 'Content', 'Support'];

export const BudgetItemForm = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing = false
}: BudgetItemFormProps) => {
  const [formData, setFormData] = useState({
    category: 'Dev' as Category,
    activityName: '',
    assignee: '',
    hourlyRate: 0,
    hoursWorked: 0,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        category: initialData.category,
        activityName: initialData.activityName,
        assignee: initialData.assignee,
        hourlyRate: initialData.hourlyRate,
        hoursWorked: initialData.hoursWorked,
      });
    } else {
      setFormData({
        category: 'Dev',
        activityName: '',
        assignee: '',
        hourlyRate: 0,
        hoursWorked: 0,
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const totalCost = formData.hourlyRate * formData.hoursWorked;
    
    if (isEditing && initialData) {
      onSubmit({
        ...initialData,
        ...formData,
        totalCost,
      });
    } else {
      onSubmit({
        ...formData,
        totalCost,
      });
    }
  };

  const isValid = formData.activityName.trim() && formData.assignee.trim() && formData.hourlyRate > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gradient-card shadow-medium">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEditing ? 'Modifica Attività' : 'Nuova Attività'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select
              value={formData.category}
              onValueChange={(value: Category) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona una categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="activityName">Nome Attività</Label>
            <Textarea
              id="activityName"
              value={formData.activityName}
              onChange={(e) => setFormData(prev => ({ ...prev, activityName: e.target.value }))}
              placeholder="Descrivi l'attività da svolgere..."
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignee">Assegnatario</Label>
            <Input
              id="assignee"
              value={formData.assignee}
              onChange={(e) => setFormData(prev => ({ ...prev, assignee: e.target.value }))}
              placeholder="Chi si occuperà di questa attività?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Costo Orario (€)</Label>
              <Input
                id="hourlyRate"
                type="number"
                min="0"
                step="0.01"
                value={formData.hourlyRate || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hoursWorked">Ore Previste</Label>
              <Input
                id="hoursWorked"
                type="number"
                min="0"
                step="0.5"
                value={formData.hoursWorked || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, hoursWorked: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
          </div>

          {formData.hourlyRate > 0 && formData.hoursWorked > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex justify-between items-center">
                <span className="font-medium text-foreground">Costo Totale Previsto:</span>
                <span className="text-xl font-bold text-primary">
                  €{(formData.hourlyRate * formData.hoursWorked).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={!isValid}
              className="bg-gradient-primary"
            >
              {isEditing ? 'Aggiorna' : 'Aggiungi'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
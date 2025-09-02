import { useState, useEffect } from 'react';
import { BudgetItem, Category, ProjectType, PredefinedActivity } from '@/types/budget';
import { assignees } from '@/data/assignees';
import { projectTypes } from '@/data/projectTypes';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BudgetItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (item: Omit<BudgetItem, 'id'> | BudgetItem) => void;
  initialData?: BudgetItem;
  isEditing?: boolean;
}

export const BudgetItemForm = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing = false
}: BudgetItemFormProps) => {
  const [selectedProjectType, setSelectedProjectType] = useState<ProjectType | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<PredefinedActivity | null>(null);
  const [formData, setFormData] = useState({
    category: 'Dev' as Category,
    activityName: '',
    assigneeId: '',
    assigneeName: '',
    hourlyRate: 0,
    hoursWorked: 0,
    isCustomActivity: false,
  });

  useEffect(() => {
    if (initialData) {
      const assignee = assignees.find(a => a.id === initialData.assigneeId);
      setFormData({
        category: initialData.category,
        activityName: initialData.activityName,
        assigneeId: initialData.assigneeId,
        assigneeName: initialData.assigneeName,
        hourlyRate: initialData.hourlyRate,
        hoursWorked: initialData.hoursWorked,
        isCustomActivity: initialData.isCustomActivity || false,
      });
    } else {
      setFormData({
        category: 'Dev',
        activityName: '',
        assigneeId: '',
        assigneeName: '',
        hourlyRate: 0,
        hoursWorked: 0,
        isCustomActivity: false,
      });
      setSelectedProjectType(null);
      setSelectedActivity(null);
    }
  }, [initialData, isOpen]);

  const handleAssigneeChange = (assigneeId: string) => {
    const assignee = assignees.find(a => a.id === assigneeId);
    if (assignee) {
      setFormData(prev => ({
        ...prev,
        assigneeId: assignee.id,
        assigneeName: assignee.name,
        hourlyRate: assignee.hourlyRate,
      }));
    }
  };

  const handleActivitySelect = (activity: PredefinedActivity) => {
    setSelectedActivity(activity);
    setFormData(prev => ({
      ...prev,
      category: activity.category,
      activityName: activity.name,
      hoursWorked: activity.estimatedHours,
      isCustomActivity: false,
    }));
  };

  const handleCustomActivity = () => {
    setSelectedActivity(null);
    setFormData(prev => ({
      ...prev,
      isCustomActivity: true,
    }));
  };

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
    onClose();
  };

  const isValid = formData.activityName.trim() && formData.assigneeId && formData.hourlyRate > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-gradient-card shadow-medium max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEditing ? 'Modifica Attività' : 'Nuova Attività'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {!isEditing && (
            <Tabs defaultValue="predefined" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="predefined">Attività Predefinite</TabsTrigger>
                <TabsTrigger value="custom" onClick={handleCustomActivity}>Attività Personalizzata</TabsTrigger>
              </TabsList>
              
              <TabsContent value="predefined" className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo Progetto</Label>
                  <Select
                    value={selectedProjectType?.id || ''}
                    onValueChange={(value) => {
                      const projectType = projectTypes.find(p => p.id === value);
                      setSelectedProjectType(projectType || null);
                      setSelectedActivity(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona il tipo di progetto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectTypes.map(projectType => (
                        <SelectItem key={projectType.id} value={projectType.id}>
                          {projectType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProjectType && (
                  <div className="space-y-2">
                    <Label>Attività</Label>
                    <Select
                      value={selectedActivity?.id || ''}
                      onValueChange={(value) => {
                        const activity = selectedProjectType.activities.find(a => a.id === value);
                        if (activity) handleActivitySelect(activity);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona un'attività" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedProjectType.activities.map(activity => (
                          <SelectItem key={activity.id} value={activity.id}>
                            <div className="flex flex-col">
                              <span>{activity.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {activity.category} • {activity.estimatedHours}h
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedActivity && (
                  <div className="bg-muted/50 rounded-lg p-4 border">
                    <h4 className="font-medium mb-2">{selectedActivity.name}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{selectedActivity.description}</p>
                    <div className="flex gap-4 text-sm">
                      <span><strong>Categoria:</strong> {selectedActivity.category}</span>
                      <span><strong>Ore stimate:</strong> {selectedActivity.estimatedHours}</span>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="custom" className="space-y-4">
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
                      {['Management', 'Design', 'Dev', 'Content', 'Support'].map(category => (
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
              </TabsContent>
            </Tabs>
          )}

          {(isEditing || formData.isCustomActivity || selectedActivity) && (
            <>
              <div className="space-y-2">
                <Label>Assegnatario *</Label>
                <Select
                  value={formData.assigneeId}
                  onValueChange={handleAssigneeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona chi si occuperà di questa attività" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignees.map(assignee => (
                      <SelectItem key={assignee.id} value={assignee.id}>
                        <div className="flex flex-col">
                          <span>{assignee.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {assignee.role} • €{assignee.hourlyRate}/h
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isEditing && (
                <>
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
                        {['Management', 'Design', 'Dev', 'Content', 'Support'].map(category => (
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
                </>
              )}

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
                    disabled={!!formData.assigneeId}
                  />
                  {formData.assigneeId && (
                    <p className="text-sm text-muted-foreground">
                      Tariffa fissa per questo assegnatario
                    </p>
                  )}
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
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};
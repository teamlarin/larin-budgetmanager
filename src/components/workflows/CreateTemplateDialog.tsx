import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WorkflowTemplate, WorkflowTaskTemplate } from '@/types/workflow';

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: WorkflowTemplate | null;
  onSave: (template: WorkflowTemplate) => void;
}

const emptyTask = (order: number): WorkflowTaskTemplate => ({
  id: `task-${Date.now()}-${order}`,
  title: '',
  order,
  dependsOn: null,
  description: '',
});

interface SortableTaskProps {
  task: WorkflowTaskTemplate;
  index: number;
  tasks: WorkflowTaskTemplate[];
  onUpdate: (index: number, field: keyof WorkflowTaskTemplate, value: string | null) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

const SortableTask = ({ task, index, tasks, onUpdate, onRemove, canRemove }: SortableTaskProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 p-3 rounded-lg border border-border bg-muted/30">
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center h-8 w-6 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <span className="flex items-center justify-center h-8 w-5 text-xs font-medium text-muted-foreground shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 space-y-2">
        <Input
          value={task.title}
          onChange={(e) => onUpdate(index, 'title', e.target.value)}
          placeholder="Titolo del task..."
          className="h-8 text-sm"
        />
        <Input
          value={task.description || ''}
          onChange={(e) => onUpdate(index, 'description', e.target.value)}
          placeholder="Descrizione (opzionale)..."
          className="h-8 text-sm"
        />
        {index > 0 && (
          <Select
            value={task.dependsOn || 'none'}
            onValueChange={(v) => onUpdate(index, 'dependsOn', v === 'none' ? null : v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Dipende da..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nessuna dipendenza</SelectItem>
              {tasks.filter((_, i) => i < index).map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.order}. {t.title || '(senza titolo)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {canRemove && (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onRemove(index)}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      )}
    </div>
  );
};

export const CreateTemplateDialog = ({ open, onOpenChange, template, onSave }: CreateTemplateDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tasks, setTasks] = useState<WorkflowTaskTemplate[]>([emptyTask(1)]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    if (open) {
      if (template) {
        setName(template.name);
        setDescription(template.description);
        setTasks([...template.tasks].sort((a, b) => a.order - b.order));
      } else {
        setName('');
        setDescription('');
        setTasks([emptyTask(1)]);
      }
    }
  }, [open, template]);

  const addTask = () => {
    setTasks(prev => [...prev, emptyTask(prev.length + 1)]);
  };

  const removeTask = (index: number) => {
    const removedId = tasks[index].id;
    setTasks(prev => {
      const updated = prev.filter((_, i) => i !== index)
        .map((t, i) => ({
          ...t,
          order: i + 1,
          dependsOn: t.dependsOn === removedId ? null : t.dependsOn,
        }));
      return updated;
    });
  };

  const updateTask = (index: number, field: keyof WorkflowTaskTemplate, value: string | null) => {
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setTasks(prev => {
      const oldIndex = prev.findIndex(t => t.id === active.id);
      const newIndex = prev.findIndex(t => t.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      return reordered.map((t, i) => ({
        ...t,
        order: i + 1,
        dependsOn: t.dependsOn
          ? (reordered.findIndex(x => x.id === t.dependsOn) < i ? t.dependsOn : null)
          : null,
      }));
    });
  };

  const handleSave = () => {
    if (!name.trim() || tasks.some(t => !t.title.trim())) return;
    const now = new Date().toISOString();
    const saved: WorkflowTemplate = {
      id: template?.id || `tpl-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      tasks: tasks.map((t, i) => ({ ...t, order: i + 1 })),
      createdAt: template?.createdAt || now,
      updatedAt: now,
    };
    onSave(saved);
    onOpenChange(false);
  };

  const isEditing = !!template;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Modifica Modello' : 'Nuovo Modello'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome del modello</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Onboarding Nuova Risorsa" />
          </div>
          <div className="space-y-2">
            <Label>Descrizione</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrivi il flusso..." rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Task</Label>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
              <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {tasks.map((task, index) => (
                    <SortableTask
                      key={task.id}
                      task={task}
                      index={index}
                      tasks={tasks}
                      onUpdate={updateTask}
                      onRemove={removeTask}
                      canRemove={tasks.length > 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <Button variant="outline" size="sm" onClick={addTask} className="mt-2">
              <Plus className="h-3.5 w-3.5 mr-1" /> Aggiungi Task
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSave} disabled={!name.trim() || tasks.some(t => !t.title.trim())}>
            {isEditing ? 'Salva Modifiche' : 'Crea Modello'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

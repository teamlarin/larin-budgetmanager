import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BudgetTemplate {
  id: string;
  name: string;
  description: string | null;
  area: string;
  template_data: any[];
}

interface Level {
  id: string;
  name: string;
  hourly_rate: number;
}

const formSchema = z.object({
  name: z.string().min(1, 'Il nome del budget è obbligatorio'),
  description: z.string().optional(),
  template_id: z.string().min(1, 'Il modello di budget è obbligatorio'),
});

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: () => void;
}

export const CreateProjectDialog = ({
  open,
  onOpenChange,
  onProjectCreated,
}: CreateProjectDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [budgetTemplates, setBudgetTemplates] = useState<BudgetTemplate[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      template_id: '',
    },
  });

  useEffect(() => {
    if (open) {
      fetchBudgetTemplates();
      fetchLevels();
    }
  }, [open]);

  const fetchBudgetTemplates = async () => {
    const { data, error } = await supabase
      .from('budget_templates')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching templates:', error);
      return;
    }

    setBudgetTemplates((data || []).map(t => ({
      ...t,
      template_data: (t.template_data as any) || []
    })));
  };

  const fetchLevels = async () => {
    const { data, error } = await supabase
      .from('levels')
      .select('*');

    if (error) {
      console.error('Error fetching levels:', error);
      return;
    }

    setLevels(data || []);
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Errore di autenticazione',
          description: 'Devi essere loggato per creare un budget.',
          variant: 'destructive',
        });
        return;
      }

      // Find selected template
      const selectedTemplate = budgetTemplates.find(t => t.id === data.template_id);
      if (!selectedTemplate) {
        toast({
          title: 'Errore',
          description: 'Modello di budget non trovato.',
          variant: 'destructive',
        });
        return;
      }

      // Create project
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert([
          {
            name: data.name,
            description: data.description,
            project_type: selectedTemplate.name,
            user_id: user.id,
          }
        ])
        .select()
        .single();

      if (projectError) throw projectError;

      // Create budget items from template
      if (selectedTemplate.template_data && selectedTemplate.template_data.length > 0) {
        const budgetItems = selectedTemplate.template_data.map((activity: any, index: number) => {
          const level = levels.find(l => l.id === activity.levelId);
          const hourlyRate = level?.hourly_rate || 0;
          const totalCost = hourlyRate * activity.hours;

          return {
            project_id: newProject.id,
            category: activity.category,
            activity_name: activity.activityName,
            assignee_id: activity.levelId,
            assignee_name: activity.levelName,
            hourly_rate: hourlyRate,
            hours_worked: activity.hours,
            total_cost: totalCost,
            is_custom_activity: false,
            display_order: index + 1,
          };
        });

        const { error: itemsError } = await supabase
          .from('budget_items')
          .insert(budgetItems);

        if (itemsError) throw itemsError;
      }

      toast({
        title: 'Budget creato',
        description: 'Il nuovo budget è stato creato con successo.',
      });
      
      form.reset();
      onProjectCreated();
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante la creazione del budget.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crea Nuovo Budget</DialogTitle>
          <DialogDescription>
            Inserisci i dettagli per creare un nuovo budget.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Budget</FormLabel>
                  <FormControl>
                    <Input placeholder="Es. Sito Web Aziendale" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="template_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modello di Budget</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona modello di budget" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {budgetTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex flex-col">
                            <span>{template.name}</span>
                            {template.description && (
                              <span className="text-xs text-muted-foreground">{template.description}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrizione (opzionale)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descrivi brevemente il budget..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Annulla
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creazione...' : 'Crea Budget'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
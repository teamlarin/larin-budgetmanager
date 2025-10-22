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

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const formSchema = z.object({
  name: z.string().min(1, 'Il nome del budget è obbligatorio'),
  description: z.string().optional(),
  template_id: z.string().min(1, 'Il modello di budget è obbligatorio'),
  client_id: z.string().optional(),
  account_user_id: z.string().optional(),
  new_client_name: z.string().optional(),
  new_client_email: z.string().email('Email non valida').optional().or(z.literal('')),
  new_client_phone: z.string().optional(),
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
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [calculatedBudget, setCalculatedBudget] = useState<{ total: number; hours: number } | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      template_id: '',
      client_id: '',
      account_user_id: '',
      new_client_name: '',
      new_client_email: '',
      new_client_phone: '',
    },
  });

  useEffect(() => {
    if (open) {
      fetchBudgetTemplates();
      fetchLevels();
      fetchClients();
      fetchUsers();
      setCalculatedBudget(null);
    }
  }, [open]);

  // Calculate budget when template changes
  useEffect(() => {
    const templateId = form.watch('template_id');
    if (templateId && budgetTemplates.length > 0 && levels.length > 0) {
      const selectedTemplate = budgetTemplates.find(t => t.id === templateId);
      if (selectedTemplate?.template_data && selectedTemplate.template_data.length > 0) {
        let totalBudget = 0;
        let totalHours = 0;
        
        selectedTemplate.template_data.forEach((activity: any) => {
          const level = levels.find(l => l.id === activity.levelId);
          const hourlyRate = level?.hourly_rate || 0;
          const hours = activity.hours || 0;
          totalBudget += hourlyRate * hours;
          totalHours += hours;
        });
        
        setCalculatedBudget({ total: totalBudget, hours: totalHours });
      } else {
        setCalculatedBudget({ total: 0, hours: 0 });
      }
    } else {
      setCalculatedBudget(null);
    }
  }, [form.watch('template_id'), budgetTemplates, levels]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, approved')
      .eq('approved', true)
      .order('first_name');

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    setUsers(data || []);
  };

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching clients:', error);
      return;
    }

    setClients(data || []);
  };

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

      let clientId = data.client_id;

      // Create new client if needed
      if (showNewClientForm && data.new_client_name) {
        if (data.new_client_name.trim().length === 0) {
          toast({
            title: 'Errore',
            description: 'Il nome del cliente è obbligatorio.',
            variant: 'destructive',
          });
          return;
        }

        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert([
            {
              name: data.new_client_name.trim(),
              email: data.new_client_email?.trim() || null,
              phone: data.new_client_phone?.trim() || null,
              user_id: user.id,
            }
          ])
          .select()
          .single();

        if (clientError) {
          console.error('Error creating client:', clientError);
          toast({
            title: 'Errore',
            description: 'Si è verificato un errore durante la creazione del cliente.',
            variant: 'destructive',
          });
          return;
        }

        clientId = newClient.id;
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
      const totalBudget = calculatedBudget?.total || 0;
      const totalHours = calculatedBudget?.hours || 0;
      
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert([
          {
            name: data.name,
            description: data.description,
            project_type: selectedTemplate.name,
            client_id: clientId || null,
            account_user_id: data.account_user_id || null,
            user_id: user.id,
            total_budget: totalBudget,
            total_hours: totalHours,
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
      setShowNewClientForm(false);
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
              name="account_user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account (opzionale)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona utente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex flex-col">
                            <span>{user.first_name} {user.last_name}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel>Cliente (opzionale)</FormLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNewClientForm(!showNewClientForm);
                    if (!showNewClientForm) {
                      form.setValue('client_id', '');
                    }
                  }}
                >
                  {showNewClientForm ? 'Seleziona esistente' : 'Nuovo cliente'}
                </Button>
              </div>

              {showNewClientForm ? (
                <div className="space-y-4 border rounded-lg p-4">
                  <FormField
                    control={form.control}
                    name="new_client_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ragione Sociale</FormLabel>
                        <FormControl>
                          <Input placeholder="Es. Acme Corporation" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="new_client_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (opzionale)</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="cliente@esempio.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="new_client_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefono (opzionale)</FormLabel>
                        <FormControl>
                          <Input placeholder="+39 123 456 7890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona cliente esistente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              <div className="flex flex-col">
                                <span>{client.name}</span>
                                {client.email && (
                                  <span className="text-xs text-muted-foreground">{client.email}</span>
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
              )}
            </div>

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

            {calculatedBudget && (
              <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Anteprima Budget</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ore totali:</span>
                  <span className="font-medium">{calculatedBudget.hours.toFixed(2)} h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Importo totale:</span>
                  <span className="font-semibold text-lg">€{calculatedBudget.total.toFixed(2)}</span>
                </div>
              </div>
            )}

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
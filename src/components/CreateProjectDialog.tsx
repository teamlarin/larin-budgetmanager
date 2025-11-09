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
import { Search } from 'lucide-react';

interface BudgetTemplate {
  id: string;
  name: string;
  description: string | null;
  discipline: string;
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
  template_ids: z.array(z.string()).optional(),
  objective: z.string().min(1, 'L\'obiettivo è obbligatorio'),
  client_id: z.string().optional(),
  account_user_id: z.string().min(1, 'L\'account è obbligatorio'),
  new_client_name: z.string().optional(),
  new_client_email: z.string().email('Email non valida').optional().or(z.literal('')),
  new_client_phone: z.string().optional(),
}).refine(
  (data) => {
    // Either client_id or new_client_name must be provided
    return data.client_id || data.new_client_name;
  },
  {
    message: 'Il cliente è obbligatorio',
    path: ['client_id'],
  }
);

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
  const [currentStep, setCurrentStep] = useState(1);
  const [budgetTemplates, setBudgetTemplates] = useState<BudgetTemplate[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [calculatedBudget, setCalculatedBudget] = useState<{ total: number; hours: number } | null>(null);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      template_ids: [],
      objective: '',
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
      setCurrentStep(1);
      setTemplateSearchQuery("");
    }
  }, [open]);

  // Calculate budget when templates change
  useEffect(() => {
    const templateIds = form.watch('template_ids');
    if (templateIds && templateIds.length > 0 && budgetTemplates.length > 0 && levels.length > 0) {
      let totalBudget = 0;
      let totalHours = 0;
      
      templateIds.forEach(templateId => {
        const selectedTemplate = budgetTemplates.find(t => t.id === templateId);
        if (selectedTemplate?.template_data && selectedTemplate.template_data.length > 0) {
          selectedTemplate.template_data.forEach((activity: any) => {
            const level = levels.find(l => l.id === activity.levelId);
            const hourlyRate = level?.hourly_rate || 0;
            const hours = activity.hours || 0;
            totalBudget += hourlyRate * hours;
            totalHours += hours;
          });
        }
      });
      
      setCalculatedBudget({ total: totalBudget, hours: totalHours });
    } else {
      setCalculatedBudget(null);
    }
  }, [form.watch('template_ids'), budgetTemplates, levels]);

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

      // Find selected templates (if provided)
      const selectedTemplates = data.template_ids && data.template_ids.length > 0
        ? budgetTemplates.filter(t => data.template_ids!.includes(t.id))
        : [];

      // Create project
      const totalBudget = calculatedBudget?.total || 0;
      const totalHours = calculatedBudget?.hours || 0;
      
      const projectType = selectedTemplates.length > 0
        ? selectedTemplates.map(t => t.name).join(', ')
        : 'Personalizzato';
      
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert([
          {
            name: data.name,
            description: data.description,
            project_type: projectType,
            budget_template_id: selectedTemplates.length > 0 ? selectedTemplates[0].id : null,
            objective: data.objective || null,
            client_id: clientId || null,
            account_user_id: data.account_user_id,
            user_id: user.id,
            total_budget: totalBudget,
            total_hours: totalHours,
          }
        ])
        .select()
        .single();

      if (projectError) throw projectError;

      // Get client name
      let clientName = 'Non specificato';
      if (clientId) {
        const client = clients.find(c => c.id === clientId);
        if (client) {
          clientName = client.name;
        } else if (showNewClientForm && data.new_client_name) {
          clientName = data.new_client_name;
        }
      }

      // Get creator name
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();
      
      const creatorName = creatorProfile 
        ? `${creatorProfile.first_name} ${creatorProfile.last_name}`.trim()
        : user.email || 'Utente';

      // Send notification email
      try {
        await supabase.functions.invoke('send-budget-notification', {
          body: {
            projectId: newProject.id,
            projectName: data.name,
            status: 'nuovo_budget',
            clientName,
            creatorName,
            totalBudget,
          },
        });
        console.log('Budget creation notification sent successfully');
      } catch (emailError) {
        console.error('Error sending notification email:', emailError);
        // Don't fail the whole operation if email fails
      }

      // Create budget items from templates (only if templates are selected)
      if (selectedTemplates.length > 0) {
        const budgetItems: any[] = [];
        let displayOrder = 1;
        
        selectedTemplates.forEach((template) => {
          if (template.template_data && template.template_data.length > 0) {
            template.template_data.forEach((activity: any) => {
              const level = levels.find(l => l.id === activity.levelId);
              const hourlyRate = level?.hourly_rate || 0;
              const totalCost = hourlyRate * activity.hours;

              budgetItems.push({
                project_id: newProject.id,
                category: activity.category,
                activity_name: activity.activityName,
                assignee_id: activity.levelId,
                assignee_name: activity.levelName,
                hourly_rate: hourlyRate,
                hours_worked: activity.hours,
                total_cost: totalCost,
                is_custom_activity: false,
                display_order: displayOrder++,
              });
            });
          }
        });

        if (budgetItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('budget_items')
            .insert(budgetItems);

          if (itemsError) throw itemsError;
        }
      }

      toast({
        title: 'Budget creato',
        description: 'Il nuovo budget è stato creato con successo.',
      });
      
      form.reset();
      setShowNewClientForm(false);
      setCurrentStep(1);
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

  const handleNextStep = async () => {
    // Validate step 1 fields
    const step1Fields: (keyof z.infer<typeof formSchema>)[] = [
      'name',
      'objective',
      'account_user_id',
      showNewClientForm ? 'new_client_name' : 'client_id'
    ];
    
    const isValid = await form.trigger(step1Fields as any);
    
    if (isValid) {
      setCurrentStep(2);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crea Nuovo Budget - Step {currentStep} di 2</DialogTitle>
          <DialogDescription>
            {currentStep === 1 
              ? 'Inserisci le informazioni principali del budget.' 
              : 'Aggiungi dettagli e seleziona i modelli di budget.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {currentStep === 1 && (
              <>
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

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <FormLabel>Cliente</FormLabel>
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
                  name="objective"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Obiettivo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona obiettivo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Brand positioning & Awareness">Brand positioning & Awareness</SelectItem>
                      <SelectItem value="Lead generation & Acquisition">Lead generation & Acquisition</SelectItem>
                      <SelectItem value="Customer experience & Digital Transformation">Customer experience & Digital Transformation</SelectItem>
                      <SelectItem value="Customer retention & Loyalty">Customer retention & Loyalty</SelectItem>
                      <SelectItem value="Sales enablement & Conversion">Sales enablement & Conversion</SelectItem>
                      <SelectItem value="Operational efficiency & AI Adoption">Operational efficiency & AI Adoption</SelectItem>
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
                      <FormLabel>Account</FormLabel>
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

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isLoading}
                  >
                    Annulla
                  </Button>
                  <Button type="button" onClick={handleNextStep}>
                    Avanti
                  </Button>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
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
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="template_ids"
                  render={({ field }) => {
                    // Filter templates based on search query
                    const filteredTemplates = budgetTemplates.filter(template =>
                      template.name.toLowerCase().includes(templateSearchQuery.toLowerCase())
                    );
                    
                    return (
                      <FormItem>
                        <FormLabel>Modelli di Budget (opzionale)</FormLabel>
                        <div className="space-y-3">
                          <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Cerca modello..."
                              value={templateSearchQuery}
                              onChange={(e) => setTemplateSearchQuery(e.target.value)}
                              className="pl-8"
                            />
                          </div>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {filteredTemplates.length === 0 ? (
                              <div className="text-sm text-muted-foreground text-center py-4">
                                Nessun modello trovato
                              </div>
                            ) : (
                              filteredTemplates.map((template) => {
                                // Calculate template budget
                                let templateHours = 0;
                                let templateCost = 0;
                                
                                if (template.template_data && template.template_data.length > 0) {
                                  template.template_data.forEach((activity: any) => {
                                    const level = levels.find(l => l.id === activity.levelId);
                                    const hourlyRate = level?.hourly_rate || 0;
                                    const hours = activity.hours || 0;
                                    templateCost += hourlyRate * hours;
                                    templateHours += hours;
                                  });
                                }
                                
                                const isSelected = field.value?.includes(template.id);
                                
                                return (
                                  <div
                                    key={template.id}
                                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                                      isSelected 
                                        ? 'bg-primary/10 border-primary' 
                                        : 'hover:bg-accent'
                                    }`}
                                    onClick={() => {
                                      const currentValues = field.value || [];
                                      const newValues = isSelected
                                        ? currentValues.filter(id => id !== template.id)
                                        : [...currentValues, template.id];
                                      field.onChange(newValues);
                                    }}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="font-medium">{template.name}</div>
                                        <div className="text-sm text-muted-foreground">
                                          {templateHours}h • €{Math.round(templateCost).toLocaleString()}
                                        </div>
                                      </div>
                                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                        isSelected 
                                          ? 'bg-primary border-primary' 
                                          : 'border-muted-foreground'
                                      }`}>
                                        {isSelected && (
                                          <svg className="w-3 h-3 text-primary-foreground" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M5 13l4 4L19 7"></path>
                                          </svg>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
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
                    onClick={() => setCurrentStep(1)}
                    disabled={isLoading}
                  >
                    Indietro
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Creazione...' : 'Crea Budget'}
                  </Button>
                </div>
              </>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
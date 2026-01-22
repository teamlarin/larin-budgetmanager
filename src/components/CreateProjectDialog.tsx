import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { formatHours } from '@/lib/utils';
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
import { Search, Check, ChevronsUpDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { fetchDisciplineMappings } from '@/lib/areaMapping';
import { objectiveOptions } from '@/lib/constants';

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
  drive_folder_id?: string | null;
  drive_folder_name?: string | null;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Service {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  net_price: number;
  gross_price: number;
  budget_template_id: string | null;
  discipline: string | null;
}

interface ClientContact {
  id: string;
  first_name: string;
  last_name: string;
  role: string | null;
}

const formSchema = z.object({
  name: z.string().min(1, 'Il nome del budget è obbligatorio'),
  description: z.string().optional(),
  template_ids: z.array(z.string()).optional(),
  service_ids: z.array(z.string()).min(1, 'Seleziona almeno un servizio'),
  objective: z.string().min(1, 'L\'obiettivo è obbligatorio'),
  secondary_objective: z.string().optional(),
  client_id: z.string().optional(),
  client_contact_id: z.string().optional(),
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
  const [services, setServices] = useState<Service[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [calculatedBudget, setCalculatedBudget] = useState<{ total: number; hours: number } | null>(null);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [serviceSearchQuery, setServiceSearchQuery] = useState("");
  const [clientContacts, setClientContacts] = useState<ClientContact[]>([]);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      template_ids: [],
      service_ids: [],
      objective: '',
      secondary_objective: '',
      client_id: '',
      client_contact_id: '',
      account_user_id: '',
      new_client_name: '',
      new_client_email: '',
      new_client_phone: '',
    },
  });

  const selectedClientId = form.watch('client_id');

  // Fetch contacts when client changes
  useEffect(() => {
    if (selectedClientId && !showNewClientForm) {
      fetchClientContacts(selectedClientId);
    } else {
      setClientContacts([]);
      form.setValue('client_contact_id', '');
    }
  }, [selectedClientId, showNewClientForm]);

  useEffect(() => {
    if (open) {
      fetchBudgetTemplates();
      fetchServices();
      fetchLevels();
      fetchClients();
      fetchUsers();
      setCalculatedBudget(null);
      setCurrentStep(1);
      setTemplateSearchQuery("");
      setServiceSearchQuery("");
    }
  }, [open]);

  // Calculate budget and auto-populate discipline/area when templates change
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

      // Auto-populate discipline and area from first selected template
      if (templateIds.length > 0) {
        const firstTemplate = budgetTemplates.find(t => t.id === templateIds[0]);
        if (firstTemplate?.discipline) {
          // Set discipline from template
          const disciplineValue = firstTemplate.discipline;
          
          // Fetch area mapping and set area
          fetchDisciplineMappings().then(mappings => {
            const areas = mappings[disciplineValue] || [];
            if (areas.length > 0) {
              // If template has a specific discipline, use the first mapped area
              // This will be stored in the project
            }
          });
        }
      }
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

  const fetchClientContacts = async (clientId: string) => {
    const { data, error } = await supabase
      .from('client_contacts')
      .select('id, first_name, last_name, role')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
      .order('first_name');

    if (error) {
      console.error('Error fetching client contacts:', error);
      return;
    }

    setClientContacts(data || []);
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

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching services:', error);
      return;
    }

    setServices(data || []);
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

      const totalBudget = calculatedBudget?.total || 0;
      const totalHours = calculatedBudget?.hours || 0;
      
      const projectType = selectedTemplates.length > 0
        ? selectedTemplates.map(t => t.name).join(', ')
        : 'Personalizzato';

      // Auto-populate discipline and area from first selected template
      let discipline = null;
      let area = null;
      
      if (selectedTemplates.length > 0 && selectedTemplates[0].discipline) {
        discipline = selectedTemplates[0].discipline;
        
        // Get area from discipline mapping
        const mappings = await fetchDisciplineMappings();
        const areas = mappings[discipline] || [];
        if (areas.length > 0) {
          area = areas[0]; // Use the first mapped area
        }
      }
      
      // Create budget first (preventivo)
      const { data: newBudget, error: budgetError } = await supabase
        .from('budgets')
        .insert([
          {
            name: data.name,
            description: data.description,
            project_type: projectType,
            budget_template_id: selectedTemplates.length > 0 ? selectedTemplates[0].id : null,
            objective: data.objective || null,
            secondary_objective: data.secondary_objective || null,
            client_id: clientId || null,
            client_contact_id: data.client_contact_id || null,
            account_user_id: data.account_user_id,
            user_id: user.id,
            total_budget: totalBudget,
            total_hours: totalHours,
            discipline: discipline,
            area: area,
            status: 'in_attesa',
          }
        ])
        .select()
        .single();

      if (budgetError) throw budgetError;
      
      // Use the budget ID as reference for budget items
      const newProject = { id: newBudget.id, ...newBudget };

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
        const budgetItemsToInsert: any[] = [];
        let displayOrder = 1;
        
        selectedTemplates.forEach((template) => {
          if (template.template_data && template.template_data.length > 0) {
            template.template_data.forEach((activity: any) => {
              const level = levels.find(l => l.id === activity.levelId);
              const hourlyRate = level?.hourly_rate || 0;
              const totalCost = hourlyRate * activity.hours;

              budgetItemsToInsert.push({
                budget_id: newBudget.id,
                // project_id is NULL for budgets - will be set when budget is approved and becomes a project
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

        if (budgetItemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from('budget_items')
            .insert(budgetItemsToInsert);

          if (itemsError) throw itemsError;
        }
      }

      // Save selected services to budget_services table
      // When budget is approved, a trigger will copy them to project_services
      if (data.service_ids && data.service_ids.length > 0) {
        const budgetServices = data.service_ids.map(serviceId => ({
          budget_id: newBudget.id,
          service_id: serviceId,
        }));

        const { error: servicesError } = await supabase
          .from('budget_services')
          .insert(budgetServices);

        if (servicesError) {
          console.error('Error saving budget services:', servicesError);
          // Don't fail the whole operation, just log the error
        }
      }

      // Budget created successfully - show success toast first
      toast({
        title: 'Budget creato',
        description: 'Il nuovo budget è stato creato con successo.',
      });
      
      form.reset();
      setShowNewClientForm(false);
      setCurrentStep(1);
      onProjectCreated();

      // Create Drive folder if client has a linked Drive folder (async, non-blocking)
      const selectedClient = clientId ? clients.find(c => c.id === clientId) : null;
      if (selectedClient?.drive_folder_id) {
        try {
          // Generate sequential budget number for this year
          const currentYear = new Date().getFullYear();
          const { count } = await supabase
            .from('budgets')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', `${currentYear}-01-01`)
            .lte('created_at', `${currentYear}-12-31`);
          
          const budgetNumber = (count || 0);
          const folderName = `${budgetNumber}/${currentYear} - ${data.name}`;

          console.log('Creating Drive folder:', folderName, 'in:', selectedClient.drive_folder_id);

          const { data: driveResponse, error: driveError } = await supabase.functions.invoke('google-drive-folders', {
            body: {
              action: 'create-folder',
              parentFolderId: selectedClient.drive_folder_id,
              folderName: folderName,
            },
          });

          if (driveError) {
            console.error('Error creating Drive folder:', driveError);
          } else if (driveResponse?.folder) {
            console.log('Drive folder created:', driveResponse.folder.id);
            // Save the folder ID to the budget
            await supabase
              .from('budgets')
              .update({ 
                drive_folder_id: driveResponse.folder.id,
                drive_folder_name: folderName 
              })
              .eq('id', newBudget.id);
          }
        } catch (driveErr) {
          console.error('Error creating Drive folder:', driveErr);
        }
      }
    } catch (error) {
      console.error('Error creating budget:', error);
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
          <DialogTitle>Crea nuovo budget - Step {currentStep} di 2</DialogTitle>
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
                      <FormLabel>Nome budget</FormLabel>
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
                        <FormItem className="flex flex-col">
                          <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={clientPopoverOpen}
                                  className={cn(
                                    "w-full justify-between",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value
                                    ? clients.find((client) => client.id === field.value)?.name
                                    : "Seleziona cliente esistente"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Cerca cliente..." />
                                <CommandList>
                                  <CommandEmpty>Nessun cliente trovato.</CommandEmpty>
                                  <CommandGroup>
                                    {clients.map((client) => (
                                      <CommandItem
                                        key={client.id}
                                        value={client.name}
                                        onSelect={() => {
                                          field.onChange(client.id);
                                          setClientPopoverOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value === client.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex flex-col">
                                          <span>{client.name}</span>
                                          {client.email && (
                                            <span className="text-xs text-muted-foreground">{client.email}</span>
                                          )}
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {!showNewClientForm && selectedClientId && clientContacts.length > 0 && (
                  <FormField
                    control={form.control}
                    name="client_contact_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contatto di riferimento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona contatto (opzionale)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clientContacts.map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.first_name} {contact.last_name}
                                {contact.role && ` - ${contact.role}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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
                          {objectiveOptions.map((objective) => (
                            <SelectItem key={objective} value={objective}>
                              {objective}
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
                  name="secondary_objective"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Obiettivo secondario (opzionale)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona obiettivo secondario" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {objectiveOptions.map((objective) => (
                            <SelectItem key={objective} value={objective}>
                              {objective}
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
                    <FormItem className="flex flex-col">
                      <FormLabel>Account</FormLabel>
                      <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={accountPopoverOpen}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? (() => {
                                    const user = users.find((u) => u.id === field.value);
                                    return user ? `${user.first_name} ${user.last_name}` : "Seleziona utente";
                                  })()
                                : "Seleziona utente"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Cerca utente..." />
                            <CommandList>
                              <CommandEmpty>Nessun utente trovato.</CommandEmpty>
                              <CommandGroup>
                                {users.map((user) => (
                                  <CommandItem
                                    key={user.id}
                                    value={`${user.first_name} ${user.last_name} ${user.email}`}
                                    onSelect={() => {
                                      field.onChange(user.id);
                                      setAccountPopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === user.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span>{user.first_name} {user.last_name}</span>
                                      <span className="text-xs text-muted-foreground">{user.email}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="service_ids"
                  render={({ field }) => {
                    const selectedServices = services.filter(s => field.value?.includes(s.id));
                    
                    return (
                      <FormItem className="flex flex-col">
                        <div className="flex items-center justify-between">
                          <FormLabel>Servizi *</FormLabel>
                          {selectedServices.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-auto py-0 px-1 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => field.onChange([])}
                            >
                              Pulisci
                            </Button>
                          )}
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between",
                                  !field.value?.length && "text-muted-foreground"
                                )}
                              >
                                {selectedServices.length > 0
                                  ? `${selectedServices.length} servizi selezionati`
                                  : "Seleziona servizi"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Cerca servizio..." />
                              <CommandList className="max-h-[200px]">
                                <CommandEmpty>Nessun servizio trovato.</CommandEmpty>
                                <CommandGroup>
                                  {services.map((service) => {
                                    const isSelected = field.value?.includes(service.id);
                                    return (
                                      <CommandItem
                                        key={service.id}
                                        value={`${service.code} ${service.name}`}
                                        onSelect={() => {
                                          const currentValues = field.value || [];
                                          const newValues = isSelected
                                            ? currentValues.filter(id => id !== service.id)
                                            : [...currentValues, service.id];
                                          field.onChange(newValues);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            isSelected ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex flex-col flex-1 min-w-0">
                                          <span className="truncate">{service.code} - {service.name}</span>
                                          <span className="text-xs text-muted-foreground">{service.category} • €{service.net_price.toLocaleString()}</span>
                                        </div>
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {selectedServices.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {selectedServices.map(service => (
                              <span
                                key={service.id}
                                className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-md"
                              >
                                {service.code}
                                <button
                                  type="button"
                                  onClick={() => {
                                    field.onChange(field.value?.filter(id => id !== service.id));
                                  }}
                                  className="hover:text-destructive"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="template_ids"
                  render={({ field }) => {
                    const selectedTemplates = budgetTemplates.filter(t => field.value?.includes(t.id));
                    
                    return (
                      <FormItem className="flex flex-col">
                        <div className="flex items-center justify-between">
                          <FormLabel>Modelli di Budget (opzionale)</FormLabel>
                          {selectedTemplates.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-auto py-0 px-1 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => field.onChange([])}
                            >
                              Pulisci
                            </Button>
                          )}
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between",
                                  !field.value?.length && "text-muted-foreground"
                                )}
                              >
                                {selectedTemplates.length > 0
                                  ? `${selectedTemplates.length} modelli selezionati`
                                  : "Seleziona modelli"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Cerca modello..." />
                              <CommandList className="max-h-[200px]">
                                <CommandEmpty>Nessun modello trovato.</CommandEmpty>
                                <CommandGroup>
                                  {budgetTemplates.map((template) => {
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
                                      <CommandItem
                                        key={template.id}
                                        value={template.name}
                                        onSelect={() => {
                                          const currentValues = field.value || [];
                                          const newValues = isSelected
                                            ? currentValues.filter(id => id !== template.id)
                                            : [...currentValues, template.id];
                                          field.onChange(newValues);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            isSelected ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex flex-col flex-1 min-w-0">
                                          <span className="truncate">{template.name}</span>
                                          <span className="text-xs text-muted-foreground">{formatHours(templateHours)} • €{Math.round(templateCost).toLocaleString()}</span>
                                        </div>
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {selectedTemplates.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {selectedTemplates.map(template => (
                              <span
                                key={template.id}
                                className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-md"
                              >
                                {template.name}
                                <button
                                  type="button"
                                  onClick={() => {
                                    field.onChange(field.value?.filter(id => id !== template.id));
                                  }}
                                  className="hover:text-destructive"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
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
                      <span className="font-medium">{formatHours(calculatedBudget.hours)}</span>
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
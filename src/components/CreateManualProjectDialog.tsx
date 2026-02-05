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
import { ClientSelector } from '@/components/ClientSelector';
import { ClientContactSelector } from '@/components/ClientContactSelector';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Constants } from '@/integrations/supabase/types';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Client {
  id: string;
  name: string;
}

interface ClientContact {
  id: string;
  first_name: string;
  last_name: string;
  role: string | null;
  email: string | null;
}

import { billingTypes, areaOptions, disciplineLabels, objectiveOptions } from '@/lib/constants';

const formSchema = z.object({
  name: z.string().min(1, 'Il nome del progetto è obbligatorio'),
  description: z.string().optional(),
  objective: z.string().optional(),
  client_id: z.string().optional(),
  client_contact_id: z.string().optional(),
  account_user_id: z.string().min(1, 'L\'account è obbligatorio'),
  project_leader_id: z.string().optional(),
  total_budget: z.number().min(0).optional(),
  margin_percentage: z.number().min(0).max(100).optional(),
  billing_type: z.string().optional(),
  area: z.string().optional(),
  discipline: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
}).refine(
  (data) => {
    // If a client is selected, a contact must be selected
    if (data.client_id && !data.client_contact_id) {
      return false;
    }
    return true;
  },
  {
    message: 'Il contatto di riferimento è obbligatorio quando è selezionato un cliente',
    path: ['client_contact_id'],
  }
);

interface CreateManualProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: () => void;
}

export const CreateManualProjectDialog = ({
  open,
  onOpenChange,
  onProjectCreated,
}: CreateManualProjectDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientContacts, setClientContacts] = useState<ClientContact[]>([]);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      objective: '',
      client_id: '',
      client_contact_id: '',
      account_user_id: '',
      project_leader_id: '',
      total_budget: 0,
      margin_percentage: 0,
      billing_type: 'one_shot',
      area: '',
      discipline: '',
      start_date: '',
      end_date: '',
    },
  });

  const selectedClientId = form.watch('client_id');

  // Fetch contacts when client changes
  useEffect(() => {
    if (selectedClientId) {
      fetchClientContacts(selectedClientId);
    } else {
      setClientContacts([]);
      form.setValue('client_contact_id', '');
    }
  }, [selectedClientId]);

  useEffect(() => {
    if (open) {
      fetchUsers();
      fetchClients();
    }
  }, [open]);

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
      .select('id, name')
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
      .select('id, first_name, last_name, role, email')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
      .order('first_name');

    if (error) {
      console.error('Error fetching client contacts:', error);
      return;
    }

    setClientContacts(data || []);
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Errore di autenticazione',
          description: 'Devi essere loggato per creare un progetto.',
          variant: 'destructive',
        });
        return;
      }

      const disciplineValue = data.discipline && data.discipline.length > 0 ? data.discipline as any : null;

      const { error: projectError } = await supabase
        .from('projects')
        .insert([
          {
            name: data.name,
            description: data.description || null,
            project_type: 'Manuale',
            objective: data.objective || null,
            client_id: data.client_id || null,
            client_contact_id: data.client_contact_id || null,
            account_user_id: data.account_user_id,
            project_leader_id: data.project_leader_id || null,
            user_id: user.id,
            total_budget: data.total_budget || 0,
            margin_percentage: data.margin_percentage || 0,
            billing_type: data.billing_type || 'one_shot',
            area: data.area || null,
            discipline: disciplineValue,
            start_date: data.start_date || null,
            end_date: data.end_date || null,
            status: 'approvato',
            project_status: 'in_partenza',
          }
        ]);

      if (projectError) throw projectError;

      toast({
        title: 'Progetto creato',
        description: 'Il nuovo progetto è stato creato con successo.',
      });
      
      form.reset();
      onOpenChange(false);
      onProjectCreated();
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante la creazione del progetto.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crea nuovo progetto</DialogTitle>
          <DialogDescription>
            Crea un progetto manuale senza collegarlo a un budget esistente.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome progetto *</FormLabel>
                  <FormControl>
                    <Input placeholder="Es. Campagna Marketing Q1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <FormControl>
                    <ClientSelector
                      clients={clients}
                      value={field.value || undefined}
                      onValueChange={(clientId) => field.onChange(clientId || '')}
                      onClientCreated={fetchClients}
                      triggerClassName="w-full h-10"
                      showCancelButton={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedClientId && (
              <FormField
                control={form.control}
                name="client_contact_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contatto di riferimento *</FormLabel>
                    <FormControl>
                      <ClientContactSelector
                        clientId={selectedClientId}
                        value={field.value}
                        onValueChange={field.onChange}
                        contacts={clientContacts}
                        onContactCreated={() => fetchClientContacts(selectedClientId)}
                        placeholder="Seleziona o crea contatto"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="account_user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
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
              name="project_leader_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Leader</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona project leader" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrizione</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descrizione del progetto..." 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="total_budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget Totale (€)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0"
                        placeholder="0" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="margin_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Margine (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0"
                        max="100"
                        placeholder="0" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="billing_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipologia Progetto</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona tipologia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {billingTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
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
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona area" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {areaOptions.map((area) => (
                          <SelectItem key={area} value={area}>
                            {area.charAt(0).toUpperCase() + area.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="discipline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Disciplina</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona disciplina" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Constants.public.Enums.discipline.map((disc) => (
                        <SelectItem key={disc} value={disc}>
                          {disciplineLabels[disc] || disc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Inizio</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Fine</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annulla
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creazione...' : 'Crea progetto'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

import { useState, useMemo } from 'react';
import { Plus, Building2, Search, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  CommandSeparator,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface ClientSelectorProps {
  value?: string;
  onValueChange: (clientId: string) => void;
  onCancel?: () => void;
  clients: Client[];
  onClientCreated?: () => void;
  triggerClassName?: string;
  placeholder?: string;
  showCancelButton?: boolean;
}

export const ClientSelector = ({
  value,
  onValueChange,
  onCancel,
  clients,
  onClientCreated,
  triggerClassName = 'h-7 w-[200px]',
  placeholder = 'Seleziona cliente',
  showCancelButton = true,
}: ClientSelectorProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const selectedClient = useMemo(() => 
    clients.find((client) => client.id === value),
    [clients, value]
  );

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      toast({
        title: 'Errore',
        description: 'Il nome del cliente è obbligatorio.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: newClientName.trim(),
          email: newClientEmail.trim() || null,
          phone: newClientPhone.trim() || null,
          address: newClientAddress.trim() || null,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Cliente creato',
        description: 'Il nuovo cliente è stato creato con successo.',
      });

      // Clear form
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientAddress('');
      setIsCreateDialogOpen(false);

      // Notify parent to refresh clients list
      onClientCreated?.();

      // Select the newly created client
      if (data?.id) {
        onValueChange(data.id);
      }
    } catch (error) {
      console.error('Error creating client:', error);
      toast({
        title: 'Errore',
        description: 'Errore durante la creazione del cliente.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn('justify-between', triggerClassName)}
            >
              <span className="truncate">
                {selectedClient?.name || placeholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0 bg-popover z-50" align="start">
            <Command>
              <CommandInput placeholder="Cerca cliente..." />
              <CommandList>
                <CommandEmpty>Nessun cliente trovato.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      setIsCreateDialogOpen(true);
                    }}
                    className="text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nuovo cliente
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Clienti">
                  {clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={client.name}
                      onSelect={() => {
                        onValueChange(client.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === client.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {client.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {showCancelButton && onCancel && (
          <Button
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
          >
            ×
          </Button>
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Nuovo Cliente
            </DialogTitle>
            <DialogDescription>
              Inserisci i dati del nuovo cliente. Solo il nome è obbligatorio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="client-name">Nome *</Label>
              <Input
                id="client-name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Nome del cliente"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-email">Email</Label>
              <Input
                id="client-email"
                type="email"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                placeholder="email@esempio.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-phone">Telefono</Label>
              <Input
                id="client-phone"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="+39 123 456 7890"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-address">Indirizzo</Label>
              <Input
                id="client-address"
                value={newClientAddress}
                onChange={(e) => setNewClientAddress(e.target.value)}
                placeholder="Via Example 123, Città"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isCreating}
            >
              Annulla
            </Button>
            <Button onClick={handleCreateClient} disabled={isCreating}>
              {isCreating ? 'Creazione...' : 'Crea Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
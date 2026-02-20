import { useState, useMemo } from 'react';
import { Plus, User, Check, ChevronsUpDown } from 'lucide-react';
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

interface ClientContact {
  id: string;
  first_name: string;
  last_name: string;
  role: string | null;
  email?: string | null;
  phone?: string | null;
}

interface ClientContactSelectorProps {
  clientId: string | undefined;
  value?: string;
  onValueChange: (contactId: string) => void;
  contacts: ClientContact[];
  onContactCreated?: () => void;
  triggerClassName?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const ClientContactSelector = ({
  clientId,
  value,
  onValueChange,
  contacts,
  onContactCreated,
  triggerClassName = 'w-full',
  placeholder = 'Seleziona contatto',
  disabled = false,
}: ClientContactSelectorProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newContactFirstName, setNewContactFirstName] = useState('');
  const [newContactLastName, setNewContactLastName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const selectedContact = useMemo(() => 
    contacts.find((contact) => contact.id === value),
    [contacts, value]
  );

  const handleCreateContact = async () => {
    if (!newContactFirstName.trim() || !newContactLastName.trim()) {
      toast({
        title: 'Errore',
        description: 'Nome e cognome sono obbligatori.',
        variant: 'destructive',
      });
      return;
    }

    if (!clientId) {
      toast({
        title: 'Errore',
        description: 'Seleziona prima un cliente.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('client_contacts')
        .insert({
          client_id: clientId,
          first_name: newContactFirstName.trim(),
          last_name: newContactLastName.trim(),
          email: newContactEmail.trim() || null,
          phone: newContactPhone.trim() || null,
          role: newContactRole.trim() || null,
          is_primary: contacts.length === 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Also insert into junction table
      await (supabase as any)
        .from('client_contact_clients')
        .insert({
          contact_id: data.id,
          client_id: clientId,
          is_primary: contacts.length === 0,
        });

      toast({
        title: 'Contatto creato',
        description: 'Il nuovo contatto è stato creato con successo.',
      });

      // Clear form
      setNewContactFirstName('');
      setNewContactLastName('');
      setNewContactEmail('');
      setNewContactPhone('');
      setNewContactRole('');
      setIsCreateDialogOpen(false);

      // Notify parent to refresh contacts list
      onContactCreated?.();

      // Select the newly created contact
      if (data?.id) {
        onValueChange(data.id);
      }
    } catch (error) {
      console.error('Error creating contact:', error);
      toast({
        title: 'Errore',
        description: 'Errore durante la creazione del contatto.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getContactDisplayName = (contact: ClientContact) => {
    const name = `${contact.first_name} ${contact.last_name}`;
    return contact.role ? `${name} - ${contact.role}` : name;
  };

  if (!clientId) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn('justify-between text-muted-foreground', triggerClassName)}
      >
        <span>Prima seleziona un cliente</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('justify-between', triggerClassName)}
          >
            <span className="truncate">
              {selectedContact ? getContactDisplayName(selectedContact) : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 bg-popover z-50" align="start">
          <Command>
            <CommandInput placeholder="Cerca contatto..." />
            <CommandList>
              <CommandEmpty>Nessun contatto trovato.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setIsCreateDialogOpen(true);
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nuovo contatto
                </CommandItem>
              </CommandGroup>
              {contacts.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Contatti">
                    {contacts.map((contact) => (
                      <CommandItem
                        key={contact.id}
                        value={`${contact.first_name} ${contact.last_name}`}
                        onSelect={() => {
                          onValueChange(contact.id);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            value === contact.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {getContactDisplayName(contact)}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Nuovo Contatto
            </DialogTitle>
            <DialogDescription>
              Inserisci i dati del nuovo contatto. Nome e cognome sono obbligatori.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact-first-name">Nome *</Label>
                <Input
                  id="contact-first-name"
                  value={newContactFirstName}
                  onChange={(e) => setNewContactFirstName(e.target.value)}
                  placeholder="Nome"
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-last-name">Cognome *</Label>
                <Input
                  id="contact-last-name"
                  value={newContactLastName}
                  onChange={(e) => setNewContactLastName(e.target.value)}
                  placeholder="Cognome"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={newContactEmail}
                onChange={(e) => setNewContactEmail(e.target.value)}
                placeholder="email@esempio.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-phone">Telefono</Label>
              <Input
                id="contact-phone"
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                placeholder="+39 123 456 7890"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-role">Ruolo</Label>
              <Input
                id="contact-role"
                value={newContactRole}
                onChange={(e) => setNewContactRole(e.target.value)}
                placeholder="es. Marketing Manager"
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
            <Button onClick={handleCreateContact} disabled={isCreating}>
              {isCreating ? 'Creazione...' : 'Crea Contatto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

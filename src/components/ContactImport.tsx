import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ContactData {
  hubspotId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  companyName: string;
  companyHubspotId: string;
}

export const ContactImport = ({ onImportComplete }: { onImportComplete: () => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [contactsData, setContactsData] = useState<ContactData[]>([]);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      toast({
        title: 'Errore',
        description: 'Seleziona un file Excel (.xlsx o .xls)',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Column mapping based on the file structure:
      // 0: ID record - Contact
      // 1: Nome
      // 2: Cognome
      // 3: E-mail
      // 4: Numero di telefono
      // 5: Qualifica (role)
      // 6: Nome azienda (from contact)
      // 7: ID record - Company
      // 8: Nome azienda (from company)
      
      const contacts: ContactData[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        const hubspotId = row[0]?.toString().trim() || '';
        const firstName = row[1]?.toString().trim() || '';
        const lastName = row[2]?.toString().trim() || '';
        const email = row[3]?.toString().trim() || '';
        const phone = row[4]?.toString().trim() || '';
        const role = row[5]?.toString().trim() || '';
        const companyName = row[8]?.toString().trim() || row[6]?.toString().trim() || '';
        const companyHubspotId = row[7]?.toString().trim() || '';

        // Skip rows without a valid name
        if (firstName || lastName) {
          contacts.push({
            hubspotId,
            firstName,
            lastName,
            email,
            phone,
            role,
            companyName,
            companyHubspotId
          });
        }
      }

      setContactsData(contacts);
      toast({
        title: 'File caricato',
        description: `${contacts.length} contatti trovati nel file`,
      });
    } catch (error) {
      console.error('Error parsing Excel:', error);
      toast({
        title: 'Errore',
        description: 'Errore durante la lettura del file Excel',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    if (contactsData.length === 0) {
      toast({
        title: 'Errore',
        description: 'Nessun contatto da importare',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    try {
      // Get all clients to match by hubspot_id or name
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, hubspot_id');

      if (!clients || clients.length === 0) {
        toast({
          title: 'Errore',
          description: 'Nessun cliente trovato. Importa prima i clienti.',
          variant: 'destructive',
        });
        setImporting(false);
        return;
      }

      // Create lookup maps
      const clientByHubspotId = new Map<string, string>();
      const clientByName = new Map<string, string>();
      
      clients.forEach(c => {
        if (c.hubspot_id) {
          clientByHubspotId.set(c.hubspot_id, c.id);
        }
        clientByName.set(c.name.toLowerCase().trim(), c.id);
      });

      // Get existing contacts to avoid duplicates (by email within same client)
      const { data: existingContacts } = await supabase
        .from('client_contacts')
        .select('email, client_id');

      const existingContactKeys = new Set(
        existingContacts?.map(c => `${c.client_id}-${(c.email || '').toLowerCase()}`) || []
      );

      // Process contacts
      const contactsToInsert: {
        client_id: string;
        first_name: string;
        last_name: string;
        email: string | null;
        phone: string | null;
        role: string | null;
        is_primary: boolean;
      }[] = [];

      let skipped = 0;
      let noClientMatch = 0;

      for (const contact of contactsData) {
        // Find matching client by hubspot_id first, then by name
        let clientId = clientByHubspotId.get(contact.companyHubspotId);
        if (!clientId && contact.companyName) {
          clientId = clientByName.get(contact.companyName.toLowerCase().trim());
        }

        if (!clientId) {
          noClientMatch++;
          continue;
        }

        // Check for duplicates
        const contactKey = `${clientId}-${(contact.email || '').toLowerCase()}`;
        if (contact.email && existingContactKeys.has(contactKey)) {
          skipped++;
          continue;
        }

        contactsToInsert.push({
          client_id: clientId,
          first_name: contact.firstName,
          last_name: contact.lastName,
          email: contact.email || null,
          phone: contact.phone || null,
          role: contact.role || null,
          is_primary: false,
        });

        // Add to existing set to avoid duplicates within same import
        if (contact.email) {
          existingContactKeys.add(contactKey);
        }
      }

      if (contactsToInsert.length === 0) {
        toast({
          title: 'Nessun contatto da importare',
          description: `${skipped} duplicati, ${noClientMatch} senza cliente associato`,
        });
        setImporting(false);
        return;
      }

      // Insert contacts in batches
      const batchSize = 100;
      let inserted = 0;
      
      for (let i = 0; i < contactsToInsert.length; i += batchSize) {
        const batch = contactsToInsert.slice(i, i + batchSize);
        const { error } = await supabase
          .from('client_contacts')
          .insert(batch);

        if (error) {
          console.error('Error inserting batch:', error);
          throw error;
        }
        inserted += batch.length;
      }

      toast({
        title: 'Importazione completata',
        description: `${inserted} contatti importati. ${skipped} duplicati ignorati. ${noClientMatch} senza cliente.`,
      });

      setFile(null);
      setContactsData([]);
      onImportComplete();
    } catch (error) {
      console.error('Error importing contacts:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante l\'importazione',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Importa Contatti</CardTitle>
            <CardDescription className="text-xs">
              File Excel HubSpot
            </CardDescription>
          </div>
          <Input
            id="excel-contacts-file"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={importing}
            className="w-auto max-w-[200px] h-8 text-xs"
          />
        </div>
      </CardHeader>
      {contactsData.length > 0 && (
        <CardContent className="py-3 px-4 pt-0 space-y-3">
          <div className="border rounded-lg max-h-48 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs py-2">Nome</TableHead>
                  <TableHead className="text-xs py-2">Email</TableHead>
                  <TableHead className="text-xs py-2">Azienda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contactsData.slice(0, 5).map((contact, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-xs py-1.5">{contact.firstName} {contact.lastName}</TableCell>
                    <TableCell className="text-xs py-1.5">{contact.email || '-'}</TableCell>
                    <TableCell className="text-xs py-1.5">{contact.companyName || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {contactsData.length > 5 && (
            <p className="text-xs text-muted-foreground">
              +{contactsData.length - 5} altri contatti...
            </p>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleImport}
              disabled={importing}
              className="h-7 text-xs"
            >
              <Upload className="h-3 w-3 mr-1" />
              {importing ? 'Importazione...' : `Importa ${contactsData.length}`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFile(null);
                setContactsData([]);
              }}
              disabled={importing}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Annulla
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X } from 'lucide-react';
import { readExcelAsArrays } from '@/lib/excelUtils';

interface ClientData {
  hubspotId: string;
  name: string;
  email: string;
  accountOwner: string;
  strategicLevel: string;
}

export const ClientImport = ({ onImportComplete }: { onImportComplete: () => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [clientsData, setClientsData] = useState<ClientData[]>([]);
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

    // Parse Excel file
    try {
      const jsonData = await readExcelAsArrays(selectedFile);

      // Skip header row and extract data
      const clients: ClientData[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        // ID record is column 0, Nome azienda is column 1, Proprietario azienda is column 2, Livello di Strategia is column 3, Email azienda is column 5
        const hubspotId = row[0]?.toString().trim() || '';
        const name = row[1]?.toString().trim();
        const email = row[5]?.toString().trim() || '';
        const accountOwner = row[2]?.toString().trim() || '';
        const strategicLevelRaw = row[3]?.toString().trim() || '';
        
        // Map strategic level text to number
        let strategicLevel = '';
        if (strategicLevelRaw.includes('Alto') || strategicLevelRaw.includes('1')) {
          strategicLevel = '1';
        } else if (strategicLevelRaw.includes('Medio') || strategicLevelRaw.includes('2')) {
          strategicLevel = '2';
        } else if (strategicLevelRaw.includes('Basso') || strategicLevelRaw.includes('3')) {
          strategicLevel = '3';
        }

        if (name) {
          clients.push({ hubspotId, name, email, accountOwner, strategicLevel });
        }
      }

      setClientsData(clients);
      toast({
        title: 'File caricato',
        description: `${clients.length} clienti trovati nel file`,
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
    if (clientsData.length === 0) {
      toast({
        title: 'Errore',
        description: 'Nessun cliente da importare',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get existing clients to avoid duplicates (check all clients by name)
      const { data: existingClients } = await supabase
        .from('clients')
        .select('name');

      const existingNames = new Set(existingClients?.map(c => c.name.toLowerCase()) || []);

      // Filter out duplicates
      const newClients = clientsData.filter(
        client => !existingNames.has(client.name.toLowerCase())
      );

      if (newClients.length === 0) {
        toast({
          title: 'Nessun nuovo cliente',
          description: 'Tutti i clienti sono già presenti nel database',
        });
        setImporting(false);
        return;
      }

      // Get all active profiles to map account owners
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name')
        .eq('approved', true)
        .is('deleted_at', null);
      
      const findAccountUserId = (ownerName: string): string | null => {
        if (!ownerName || !profiles) return null;
        const normalizedOwner = ownerName.toLowerCase().trim();
        const match = profiles.find(p => {
          const fullName = (p.full_name || `${p.first_name || ''} ${p.last_name || ''}`).toLowerCase().trim();
          return fullName === normalizedOwner || fullName.includes(normalizedOwner) || normalizedOwner.includes(fullName);
        });
        return match?.id || null;
      };

      // Insert new clients
      const { error } = await supabase
        .from('clients')
        .insert(
          newClients.map(client => ({
            name: client.name,
            email: client.email || null,
            user_id: user.id,
            account_user_id: findAccountUserId(client.accountOwner),
            strategic_level: client.strategicLevel ? parseInt(client.strategicLevel) : null,
            hubspot_id: client.hubspotId || null,
          }))
        );

      if (error) throw error;

      toast({
        title: 'Importazione completata',
        description: `${newClients.length} clienti importati con successo. ${clientsData.length - newClients.length} duplicati ignorati.`,
      });

      // Reset state
      setFile(null);
      setClientsData([]);
      onImportComplete();
    } catch (error) {
      console.error('Error importing clients:', error);
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
            <CardTitle className="text-sm font-medium">Importa Clienti</CardTitle>
            <CardDescription className="text-xs">
              File Excel HubSpot
            </CardDescription>
          </div>
          <Input
            id="excel-file"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={importing}
            className="w-auto max-w-[200px] h-8 text-xs"
          />
        </div>
      </CardHeader>
      {clientsData.length > 0 && (
        <CardContent className="py-3 px-4 pt-0 space-y-3">
          <div className="border rounded-lg max-h-48 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs py-2">Azienda</TableHead>
                  <TableHead className="text-xs py-2">Email</TableHead>
                  <TableHead className="text-xs py-2">Proprietario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsData.slice(0, 5).map((client, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-xs py-1.5">{client.name}</TableCell>
                    <TableCell className="text-xs py-1.5">{client.email || '-'}</TableCell>
                    <TableCell className="text-xs py-1.5">{client.accountOwner || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {clientsData.length > 5 && (
            <p className="text-xs text-muted-foreground">
              +{clientsData.length - 5} altri clienti...
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
              {importing ? 'Importazione...' : `Importa ${clientsData.length}`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFile(null);
                setClientsData([]);
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
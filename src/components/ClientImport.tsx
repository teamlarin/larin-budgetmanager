import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Check, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ClientData {
  name: string;
  email: string;
  phone: string;
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
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Skip header row and extract data
      const clients: ClientData[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        // Denominazione is column 0, Indirizzo e-mail is column 8, Telefono is column 10
        const name = row[0]?.toString().trim();
        const email = row[8]?.toString().trim() || '';
        const phone = row[10]?.toString().trim() || '';

        if (name) {
          clients.push({ name, email, phone });
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

      // Get existing clients to avoid duplicates
      const { data: existingClients } = await supabase
        .from('clients')
        .select('name')
        .eq('user_id', user.id);

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

      // Insert new clients
      const { error } = await supabase
        .from('clients')
        .insert(
          newClients.map(client => ({
            name: client.name,
            email: client.email || null,
            phone: client.phone || null,
            user_id: user.id,
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
    <Card>
      <CardHeader>
        <CardTitle>Importa Clienti da Excel</CardTitle>
        <CardDescription>
          Carica un file Excel con le colonne: Denominazione (Ragione Sociale), E-MAIL (Email), TELEFONO (opzionale)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="excel-file">File Excel</Label>
          <Input
            id="excel-file"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={importing}
          />
        </div>

        {clientsData.length > 0 && (
          <>
            <div className="border rounded-lg max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ragione Sociale</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefono</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientsData.slice(0, 10).map((client, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="text-sm">{client.email || '-'}</TableCell>
                      <TableCell className="text-sm">{client.phone || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {clientsData.length > 10 && (
              <p className="text-sm text-muted-foreground">
                Mostrando 10 di {clientsData.length} clienti...
              </p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {importing ? 'Importazione...' : `Importa ${clientsData.length} clienti`}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setClientsData([]);
                }}
                disabled={importing}
              >
                <X className="h-4 w-4 mr-2" />
                Annulla
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
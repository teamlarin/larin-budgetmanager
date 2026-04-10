import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Package } from 'lucide-react';

interface BudgetLinkedServicesProps {
  budgetId: string;
}

export const BudgetLinkedServices = ({ budgetId }: BudgetLinkedServicesProps) => {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch linked services via budget_services
  const { data: linkedServices = [], refetch } = useQuery({
    queryKey: ['budget-linked-services', budgetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_services')
        .select('id, service_id, services:service_id(id, code, name, category, description, net_price, gross_price, vat_rate)')
        .eq('budget_id', budgetId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!budgetId,
  });

  // Fetch all available services
  const { data: allServices = [] } = useQuery({
    queryKey: ['all-services-for-budget'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const linkedServiceIds = linkedServices.map((ls: any) => ls.service_id);

  const handleAddService = async () => {
    if (!selectedServiceId) return;
    try {
      const { error } = await supabase
        .from('budget_services')
        .insert({ budget_id: budgetId, service_id: selectedServiceId });
      if (error) throw error;
      toast({ title: 'Servizio collegato', description: 'Il servizio è stato collegato al budget.' });
      setShowAddDialog(false);
      setSelectedServiceId('');
      setSearchQuery('');
      refetch();
    } catch (error) {
      console.error('Error linking service:', error);
      toast({ title: 'Errore', description: 'Errore durante il collegamento del servizio.', variant: 'destructive' });
    }
  };

  const handleRemoveService = async (budgetServiceId: string) => {
    if (!confirm('Sei sicuro di voler scollegare questo servizio?')) return;
    try {
      const { error } = await supabase
        .from('budget_services')
        .delete()
        .eq('id', budgetServiceId);
      if (error) throw error;
      toast({ title: 'Servizio scollegato', description: 'Il servizio è stato rimosso dal budget.' });
      refetch();
    } catch (error) {
      console.error('Error unlinking service:', error);
      toast({ title: 'Errore', description: 'Errore durante la rimozione del servizio.', variant: 'destructive' });
    }
  };

  const filteredAvailableServices = allServices.filter((s: any) => {
    if (linkedServiceIds.includes(s.id)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q);
  });

  return (
    <>
      <Card variant="static">
        <CardHeader variant="compact">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Servizi collegati
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Aggiungi servizio
            </Button>
          </div>
        </CardHeader>
        <CardContent variant="compact">
          {linkedServices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessun servizio collegato. Aggiungi un servizio per includerlo nei preventivi.
            </p>
          ) : (
            <div className="space-y-2">
              {linkedServices.map((ls: any) => {
                const service = ls.services;
                if (!service) return null;
                return (
                  <div key={ls.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{service.name}</span>
                        {service.code && (
                          <Badge variant="outline" className="text-xs">{service.code}</Badge>
                        )}
                        {service.category && (
                          <Badge variant="secondary" className="text-xs">{service.category}</Badge>
                        )}
                      </div>
                      {service.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{service.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-sm font-medium">€{Number(service.net_price || 0).toFixed(2)}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveService(ls.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) { setSelectedServiceId(''); setSearchQuery(''); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi servizio al budget</DialogTitle>
            <DialogDescription>Cerca e seleziona un servizio dal catalogo per collegarlo a questo budget.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cerca servizio</Label>
              <Input
                placeholder="Cerca per nome, codice o categoria..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div>
              <Label>Servizio</Label>
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger><SelectValue placeholder="Seleziona servizio" /></SelectTrigger>
                <SelectContent>
                  {filteredAvailableServices.map((service: any) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.code ? `${service.code} - ` : ''}{service.name} - €{Number(service.net_price || 0).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setSearchQuery(''); setSelectedServiceId(''); }}>Annulla</Button>
            <Button onClick={handleAddService} disabled={!selectedServiceId}>Aggiungi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

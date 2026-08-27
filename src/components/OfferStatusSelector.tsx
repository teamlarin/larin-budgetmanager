import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { type Database } from '@/integrations/supabase/types';
import { createProjectFromOffer } from '@/lib/createProjectFromOffer';

type OfferStatus = Database['public']['Enums']['offer_status'];

export const offerStatusConfig: Record<OfferStatus, { label: string; variant: BadgeProps['variant'] }> = {
  bozza: { label: 'Bozza', variant: 'secondary' },
  in_approvazione: { label: 'In approvazione', variant: 'yellow' },
  inviata: { label: 'Inviata', variant: 'blue' },
  vista: { label: 'Vista', variant: 'purple' },
  accettata: { label: 'Accettata', variant: 'green' },
  rifiutata: { label: 'Rifiutata', variant: 'destructive' },
  scaduta: { label: 'Scaduta', variant: 'gray' },
  superata: { label: 'Superata', variant: 'outline' },
  sostituita: { label: 'Sostituita', variant: 'outline' },
};

/**
 * Transizioni realmente accettate dal database per un utente interno
 * (vedi `set_offer_version_status` e `assert_offer_transition_*`):
 * - vista/accettata/rifiutata le determina il cliente dal link pubblico
 *   (oppure la registrazione manuale dedicata);
 * - scaduta/superata/sostituita le scrive solo il sistema.
 */
const getAllowedTransitions = (current: OfferStatus, isAdmin: boolean): OfferStatus[] => {
  switch (current) {
    case 'bozza':
      return ['inviata'];
    case 'in_approvazione':
      return isAdmin ? ['inviata', 'bozza'] : [];
    default:
      return [];
  }
};

const getBlockedHint = (current: OfferStatus): string | null => {
  switch (current) {
    case 'in_approvazione':
      return 'Solo un admin diverso da chi ha composto l\'offerta può approvarla o respingerla.';
    case 'inviata':
    case 'vista':
      return 'L\'esito lo registra il cliente dal link pubblico; per un\'offerta firmata a mano usa "Registra esito manuale".';
    default:
      return 'Questo stato non è modificabile manualmente.';
  }
};

interface OfferStatusSelectorProps {
  offerVersionId: string;
  currentStatus: OfferStatus;
  onStatusChange?: () => void;
  readOnly?: boolean;
  /** Necessario per l'automazione "accettata → crea progetto". */
  offerId?: string;
  /** Ruolo dell'utente: le transizioni da "in approvazione" sono riservate agli admin. */
  userRole?: string | null;
}

export const OfferStatusSelector = ({
  offerVersionId,
  currentStatus,
  onStatusChange,
  readOnly = false,
  offerId,
  userRole,
}: OfferStatusSelectorProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const { toast } = useToast();

  const config = offerStatusConfig[currentStatus];
  const allowed = getAllowedTransitions(currentStatus, userRole === 'admin');

  if (readOnly || allowed.length === 0) {
    const hint = readOnly ? null : getBlockedHint(currentStatus);
    return (
      <Badge variant={config.variant} title={hint ?? undefined}>
        {config.label}
      </Badge>
    );
  }

  const applyStatusChange = async (newStatus: OfferStatus, note?: string) => {
    setIsUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      // event_type coincide con il valore di new_status per tutte le
      // transizioni manuali qui esposte (vedi CHECK su offer_events.event_type);
      // il database lo riscrive in "respinta" quando si torna in bozza.
      const { error } = await supabase.rpc('set_offer_version_status', {
        _offer_version_id: offerVersionId,
        _new_status: newStatus,
        _event_type: newStatus,
        _actor_type: 'user',
        _actor_user_id: user.id,
        ...(note ? { _note: note } : {}),
      });

      if (error) throw error;

      toast({
        title: 'Stato aggiornato',
        description: `L'offerta è ora "${offerStatusConfig[newStatus].label}" (oppure "In approvazione" se sono scattate le soglie).`,
      });

      // Automazione: all'accettazione crea il progetto dal budget di origine,
      // copia le attività e genera la cartella Drive.
      if (newStatus === 'accettata' && offerId) {
        try {
          const result = await createProjectFromOffer(offerId);
          if (result.created) {
            toast({
              title: 'Progetto creato',
              description: result.driveFolderCreated
                ? 'Progetto creato con stato "In partenza", attività copiate e cartella Drive generata.'
                : 'Progetto creato con stato "In partenza" e attività copiate (cartella Drive non generata).',
            });
          }
        } catch (automationError) {
          console.error('Offer acceptance automation failed:', automationError);
          toast({
            title: 'Attenzione',
            description: 'Offerta accettata, ma non è stato possibile creare il progetto automaticamente.',
            variant: 'destructive',
          });
        }
      }

      onStatusChange?.();
    } catch (error) {
      console.error('Error updating offer status:', error);
      toast({
        title: 'Errore',
        description:
          (error as { message?: string })?.message ||
          'Si è verificato un errore durante l\'aggiornamento dello stato.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    if (currentStatus === 'in_approvazione' && newStatus === 'bozza') {
      setRejectNote('');
      setRejectDialogOpen(true);
      return;
    }
    await applyStatusChange(newStatus as OfferStatus);
  };

  return (
    <>
      <Select value={currentStatus} onValueChange={handleStatusChange} disabled={isUpdating}>
        <SelectTrigger className="w-[170px]">
          <SelectValue>
            <Badge variant={config.variant}>{config.label}</Badge>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={currentStatus} disabled>
            <Badge variant={config.variant}>{config.label}</Badge>
          </SelectItem>
          {allowed.map((status) => (
            <SelectItem key={status} value={status}>
              <Badge variant={offerStatusConfig[status].variant}>
                {currentStatus === 'in_approvazione' && status === 'bozza'
                  ? 'Bozza (respingi)'
                  : offerStatusConfig[status].label}
              </Badge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={rejectDialogOpen} onOpenChange={(open) => { if (!isUpdating) setRejectDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Respingi l'offerta in approvazione</DialogTitle>
            <DialogDescription>
              La versione torna in bozza. Il motivo è obbligatorio e viene registrato nella cronologia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="offer-reject-note">Motivo *</Label>
            <Textarea
              id="offer-reject-note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="Es. sconto troppo alto rispetto al margine target"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={isUpdating}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={isUpdating || !rejectNote.trim()}
              onClick={async () => {
                await applyStatusChange('bozza', rejectNote.trim());
                setRejectDialogOpen(false);
              }}
            >
              Respingi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

import { useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createProjectFromOffer } from '@/lib/createProjectFromOffer';

type Decision = 'accettata' | 'rifiutata';

interface RecordManualDecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerVersionId: string;
  offerId: string;
  onRecorded?: () => void;
}

export const RecordManualDecisionDialog = ({
  open,
  onOpenChange,
  offerVersionId,
  offerId,
  onRecorded,
}: RecordManualDecisionDialogProps) => {
  const { toast } = useToast();
  const [decision, setDecision] = useState<Decision>('accettata');
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signedAt, setSignedAt] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rejectReason, setRejectReason] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setDecision('accettata');
    setSignerName('');
    setSignerRole('');
    setSignerEmail('');
    setSignedAt(format(new Date(), 'yyyy-MM-dd'));
    setRejectReason('');
    setNote('');
  };

  const handleSubmit = async () => {
    if (!signerName.trim()) {
      toast({ title: 'Nome firmatario obbligatorio', variant: 'destructive' });
      return;
    }
    if (decision === 'rifiutata' && !rejectReason.trim()) {
      toast({ title: 'Motivo del rifiuto obbligatorio', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('record_offer_manual_decision', {
        _offer_version_id: offerVersionId,
        _decision: decision,
        _signer_name: signerName.trim(),
        _signer_role: signerRole.trim() || undefined,
        _signer_email: signerEmail.trim() || undefined,
        _signed_at: signedAt ? new Date(`${signedAt}T12:00:00`).toISOString() : undefined,
        _note: note.trim() || undefined,
        _reject_reason: decision === 'rifiutata' ? rejectReason.trim() : undefined,
      });
      if (error) throw error;

      toast({
        title: decision === 'accettata' ? 'Accettazione registrata' : 'Rifiuto registrato',
        description: `Esito registrato manualmente (firmatario: ${signerName.trim()}).`,
      });

      if (decision === 'accettata') {
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
            description: 'Esito registrato, ma non è stato possibile creare il progetto automaticamente.',
            variant: 'destructive',
          });
        }
      }

      reset();
      onOpenChange(false);
      onRecorded?.();
    } catch (error) {
      console.error('Error recording manual offer decision:', error);
      toast({
        title: 'Errore',
        description:
          (error as { message?: string })?.message ||
          "Non è stato possibile registrare l'esito manuale.",
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isSaving) onOpenChange(next); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registra esito manuale</DialogTitle>
          <DialogDescription>
            Per offerte accettate o rifiutate fuori dal link pubblico (firma su carta, email, PDF firmato).
            L'esito viene tracciato con il tuo nome nella cronologia dell'offerta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Esito</Label>
            <Select value={decision} onValueChange={(v) => setDecision(v as Decision)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accettata">Accettata</SelectItem>
                <SelectItem value="rifiutata">Rifiutata</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-signer-name">Nome firmatario *</Label>
              <Input
                id="manual-signer-name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Mario Rossi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-signer-role">Ruolo</Label>
              <Input
                id="manual-signer-role"
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value)}
                placeholder="Amministratore delegato"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-signer-email">Email</Label>
              <Input
                id="manual-signer-email"
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="mario.rossi@azienda.it"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-signed-at">Data della firma</Label>
              <Input
                id="manual-signed-at"
                type="date"
                value={signedAt}
                onChange={(e) => setSignedAt(e.target.value)}
              />
            </div>
          </div>

          {decision === 'rifiutata' && (
            <div className="space-y-2">
              <Label htmlFor="manual-reject-reason">Motivo del rifiuto *</Label>
              <Textarea
                id="manual-reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="manual-note">Note</Label>
            <Textarea
              id="manual-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Es. contratto firmato e archiviato su Drive"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Registrazione…' : 'Registra esito'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

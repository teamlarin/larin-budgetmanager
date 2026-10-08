import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';
import { Download, FileSignature } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SignedOfferCardProps {
  offerVersionId: string;
}

// Riquadro in evidenza con il PDF firmato della versione selezionata.
export const SignedOfferCard = ({ offerVersionId }: SignedOfferCardProps) => {
  const { data: signature } = useQuery({
    queryKey: ['offer-signed-pdf', offerVersionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offer_signatures')
        .select('id, signer_name, signer_role, signer_email, signed_at, created_at, signed_pdf_path, signature_source')
        .eq('offer_version_id', offerVersionId)
        .eq('decision', 'accettata')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!signature) return null;

  const openPdf = async () => {
    if (!signature.signed_pdf_path) return;
    const { data, error } = await supabase.storage
      .from('offer-documents')
      .createSignedUrl(signature.signed_pdf_path, 600);
    if (error || !data?.signedUrl) {
      toast.error('Impossibile aprire il PDF firmato', { description: error?.message });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const when = signature.signed_at ?? signature.created_at;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex items-start gap-3">
          <FileSignature className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium">Offerta firmata</p>
            <p className="text-sm text-muted-foreground">
              {signature.signer_name}
              {signature.signer_role ? ` · ${signature.signer_role}` : ''}
              {signature.signer_email ? ` · ${signature.signer_email}` : ''}
              {' · '}
              {format(new Date(when), "d MMM yyyy 'alle' HH:mm", { locale: it })}
            </p>
            {signature.signed_pdf_path ? (
              <p className="text-xs text-muted-foreground">Copia salvata anche nella cartella Drive del cliente.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Esito registrato manualmente: nessun PDF firmato generato.</p>
            )}
          </div>
        </div>
        {signature.signed_pdf_path && (
          <Button onClick={openPdf}>
            <Download className="h-4 w-4 mr-2" />
            PDF firmato
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

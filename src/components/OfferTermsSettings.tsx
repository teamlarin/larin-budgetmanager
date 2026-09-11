import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Save, Trash2 } from 'lucide-react';

export interface OfferTermsArticle {
  number: number;
  title: string;
  text: string;
}

export interface OfferTermsSettingsValue {
  articles: OfferTermsArticle[];
  text: string;
  payment_details: string;
  privacy_note: string;
}

const SETTING_KEY = 'offer_general_terms';

/** Il testo lineare resta la forma leggibile dalle offerte già congelate e dal PDF: si ricalcola sempre dagli articoli. */
export const buildTermsText = (articles: OfferTermsArticle[]) =>
  articles.map((a) => `${a.number}. ${a.title}\n${a.text}`).join('\n\n');

export const OfferTermsSettings = () => {
  const queryClient = useQueryClient();
  const [articles, setArticles] = useState<OfferTermsArticle[]>([]);
  const [paymentDetails, setPaymentDetails] = useState('');
  const [privacyNote, setPrivacyNote] = useState('');
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['offer-general-terms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      return (data?.setting_value ?? null) as unknown as OfferTermsSettingsValue | null;
    },
  });

  useEffect(() => {
    if (!data || dirty) return;
    setArticles(Array.isArray(data.articles) ? data.articles : []);
    setPaymentDetails(data.payment_details ?? '');
    setPrivacyNote(data.privacy_note ?? '');
  }, [data, dirty]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleaned = articles
        .map((a, idx) => ({ number: Number(a.number) || idx + 1, title: a.title.trim(), text: a.text.trim() }))
        .filter((a) => a.title || a.text);
      const payload: OfferTermsSettingsValue = {
        articles: cleaned,
        text: buildTermsText(cleaned),
        payment_details: paymentDetails.trim(),
        privacy_note: privacyNote.trim(),
      };
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          {
            setting_key: SETTING_KEY,
            setting_value: payload as unknown as never,
            description: 'Condizioni generali di vendita mostrate nelle offerte',
          },
          { onConflict: 'setting_key' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['offer-general-terms'] });
      toast.success('Condizioni aggiornate', {
        description: 'Le offerte create da adesso mostreranno il testo aggiornato.',
      });
    },
    onError: (error: Error) => {
      toast.error('Impossibile salvare le condizioni', { description: error.message });
    },
  });

  const updateArticle = (index: number, patch: Partial<OfferTermsArticle>) => {
    setDirty(true);
    setArticles((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  };

  const addArticle = () => {
    setDirty(true);
    setArticles((prev) => [...prev, { number: prev.length + 1, title: '', text: '' }]);
  };

  const removeArticle = (index: number) => {
    setDirty(true);
    setArticles((prev) => prev.filter((_, i) => i !== index));
  };

  const totalChars = useMemo(() => buildTermsText(articles).length, [articles]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Condizioni offerta</CardTitle>
        <CardDescription>
          Testo mostrato al cliente nella pagina dell'offerta e nel PDF. Le offerte già inviate mantengono il testo
          con cui sono state congelate: la modifica vale per quelle create da adesso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Condizioni generali di vendita</Label>
                <span className="text-xs text-muted-foreground">
                  {articles.length} articoli · {totalChars.toLocaleString('it-IT')} caratteri
                </span>
              </div>
              <Accordion type="multiple" className="rounded-md border">
                {articles.map((article, index) => (
                  <AccordionItem key={index} value={`article-${index}`} className="px-4">
                    <AccordionTrigger className="text-left text-sm">
                      {article.number}. {article.title || 'Articolo senza titolo'}
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-4">
                      <div className="flex gap-3">
                        <div className="w-24 space-y-1">
                          <Label htmlFor={`article-number-${index}`} className="text-xs">
                            Numero
                          </Label>
                          <Input
                            id={`article-number-${index}`}
                            type="number"
                            min={1}
                            value={article.number}
                            onChange={(e) => updateArticle(index, { number: Number(e.target.value) })}
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label htmlFor={`article-title-${index}`} className="text-xs">
                            Titolo
                          </Label>
                          <Input
                            id={`article-title-${index}`}
                            value={article.title}
                            onChange={(e) => updateArticle(index, { title: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`article-text-${index}`} className="text-xs">
                          Testo
                        </Label>
                        <Textarea
                          id={`article-text-${index}`}
                          value={article.text}
                          onChange={(e) => updateArticle(index, { text: e.target.value })}
                          rows={10}
                          className="font-mono text-xs"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeArticle(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Elimina articolo
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <Button variant="outline" size="sm" onClick={addArticle}>
                <Plus className="mr-2 h-4 w-4" />
                Aggiungi articolo
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="offer-payment-details">Dati di pagamento</Label>
              <Textarea
                id="offer-payment-details"
                value={paymentDetails}
                onChange={(e) => {
                  setDirty(true);
                  setPaymentDetails(e.target.value);
                }}
                rows={4}
                placeholder={'BONIFICO BANCARIO\nIBAN: ...'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="offer-privacy-note">Nota privacy per la firma</Label>
              <Textarea
                id="offer-privacy-note"
                value={privacyNote}
                onChange={(e) => {
                  setDirty(true);
                  setPrivacyNote(e.target.value);
                }}
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !dirty}>
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? 'Salvataggio...' : 'Salva condizioni'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

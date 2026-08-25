import { supabase } from '@/integrations/supabase/client';
import { logAction } from '@/hooks/useActionLogger';

interface ToastFn {
  (props: { title: string; description: string; variant?: 'default' | 'destructive' }): void;
}

export interface GenerateOfferResult {
  success: boolean;
  offerId?: string;
  offerNumber?: string;
}

/**
 * Genera un'offerta in bozza a partire da un budget approvato.
 *
 * Sostituisce il vecchio `generateQuoteForBudget`: la logica di calcolo è la
 * stessa (righe prodotto dal budget + riga residuale per la parte servizi, con
 * il margine già incluso nel totale del budget), ma il documento prodotto è
 * un'offerta versionata, che può essere inviata al cliente con link pubblico,
 * firmata e messa in coda di fatturazione.
 */
export const generateOfferFromBudget = async (
  budgetId: string,
  toast?: ToastFn
): Promise<GenerateOfferResult> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utente non autenticato');

    const { data: budgetData, error: budgetError } = await supabase
      .from('budgets')
      .select('*, clients(*)')
      .eq('id', budgetId)
      .single();
    if (budgetError) throw budgetError;

    if (!budgetData.client_id) {
      throw new Error('Il budget non ha un cliente collegato: impossibile creare l\'offerta.');
    }

    const { data: budgetItems, error: itemsError } = await supabase
      .from('budget_items')
      .select('*')
      .eq('budget_id', budgetId)
      .order('display_order');
    if (itemsError) throw itemsError;

    const productItems = (budgetItems || []).filter((item) => item.is_product);
    const productsTotal = productItems.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);

    // Il totale del budget include già il margine: la parte residuale è il
    // valore dei servizi/attività.
    const offeredTotal = Math.max(Number(budgetData.total_budget || 0), 0);
    const serviceAmount = Math.round((offeredTotal - productsTotal) * 100) / 100;

    // 1. Offerta
    const { data: newOffer, error: offerError } = await supabase
      .from('offers')
      .insert({
        client_id: budgetData.client_id,
        project_id: budgetData.project_id ?? null,
        origin: 'budget',
        budget_id: budgetId,
        created_by: user.id,
      } as never)
      .select('id, year, number')
      .single();
    if (offerError) throw offerError;

    // 2. Prima versione (diventa da sé la versione corrente)
    const { data: newVersion, error: versionError } = await supabase
      .from('offer_versions')
      .insert({
        offer_id: newOffer.id,
        created_by: user.id,
        list_total: offeredTotal,
        offered_total: offeredTotal,
      } as never)
      .select('id')
      .single();
    if (versionError) throw versionError;

    // 3. Righe
    const lines = productItems.map((item, index) => ({
      offer_version_id: newVersion.id,
      product_id: item.product_id ?? null,
      description: (item.activity_name || '').trim() || 'Prodotto',
      quantity: 1,
      unit_list_price: Math.max(Number(item.total_cost || 0), 0),
      discount_percentage: 0,
      vat_rate: Number(item.vat_rate ?? 22),
      line_total: Math.max(Number(item.total_cost || 0), 0),
      display_order: index,
    }));

    if (serviceAmount > 0.009) {
      lines.push({
        offer_version_id: newVersion.id,
        product_id: null,
        description: 'Servizi e attività',
        quantity: 1,
        unit_list_price: serviceAmount,
        discount_percentage: 0,
        vat_rate: 22,
        line_total: serviceAmount,
        display_order: lines.length,
      });
    }

    if (lines.length > 0) {
      const { error: linesError } = await supabase.from('offer_lines').insert(lines);
      if (linesError) throw linesError;
    }

    // 4. Piano di pagamento: priorità ai termini di default del cliente
    const { data: usableTerms } = await supabase
      .from('payment_terms')
      .select('id')
      .eq('is_active', true)
      .not('days', 'is', null)
      .not('due_basis', 'is', null)
      .order('display_order');
    const usableTermIds = new Set((usableTerms || []).map((t) => t.id));
    const fallbackTermId = usableTerms?.[0]?.id ?? null;

    if (fallbackTermId) {
      const { data: clientSplits } = await supabase
        .from('client_payment_splits')
        .select('*')
        .eq('client_id', budgetData.client_id)
        .order('display_order');

      if (clientSplits && clientSplits.length > 0) {
        const paymentTerms = clientSplits
          .filter((split) => Number(split.percentage || 0) > 0)
          .map((split, index) => ({
            offer_version_id: newVersion.id,
            percentage: Math.min(Number(split.percentage), 100),
            payment_term_id:
              split.payment_term_id && usableTermIds.has(split.payment_term_id)
                ? split.payment_term_id
                : fallbackTermId,
            maturity_event: 'firma' as const,
            display_order: index,
          }));

        if (paymentTerms.length > 0) {
          const { error: termsError } = await supabase
            .from('offer_payment_terms')
            .insert(paymentTerms);
          if (termsError) console.error('Errore nella copia del piano di pagamento:', termsError);
        }
      }
    }

    // 5. Registro attività applicativo


    const offerNumber = `${newOffer.number}/${newOffer.year}`;

    await logAction({
      actionType: 'create',
      actionDescription: `Offerta ${offerNumber} creata automaticamente dal budget approvato`,
      entityType: 'offer',
      entityId: newOffer.id,
      metadata: { budgetId, offerNumber },
    });

    toast?.({
      title: 'Offerta creata',
      description: `L'offerta ${offerNumber} è stata generata in bozza dal budget approvato.`,
    });

    return { success: true, offerId: newOffer.id, offerNumber };
  } catch (error) {
    console.error('Error generating offer from budget:', error);
    toast?.({
      title: 'Errore',
      description:
        error instanceof Error
          ? error.message
          : 'Si è verificato un errore durante la creazione dell\'offerta.',
      variant: 'destructive',
    });
    return { success: false };
  }
};

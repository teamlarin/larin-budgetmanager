import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateOfferFromBudget } from '@/lib/generateOfferFromBudget';

interface GenerateOfferParams {
  budgetId: string;
  showSuccessToast?: boolean;
}

interface GenerateOfferResult {
  success: boolean;
  offerId?: string;
  offerNumber?: string;
  error?: string;
}

export const useOfferGeneration = () => {
  const { toast } = useToast();

  const generateOffer = async ({
    budgetId,
    showSuccessToast = true,
  }: GenerateOfferParams): Promise<GenerateOfferResult> => {
    const result = await generateOfferFromBudget(
      budgetId,
      showSuccessToast ? toast : undefined
    );

    return {
      success: result.success,
      offerId: result.offerId,
      offerNumber: result.offerNumber,
      error: result.success ? undefined : "Impossibile generare l'offerta",
    };
  };

  /** Verifica se esiste già un'offerta (o un preventivo storico) per il budget */
  const checkExistingOffer = async (budgetId: string): Promise<boolean> => {
    const [{ data: offer }, { data: quote }] = await Promise.all([
      supabase.from('offers').select('id').eq('budget_id', budgetId).limit(1).maybeSingle(),
      supabase.from('quotes').select('id').eq('budget_id', budgetId).limit(1).maybeSingle(),
    ]);

    return !!offer || !!quote;
  };

  return { generateOffer, checkExistingOffer };
};

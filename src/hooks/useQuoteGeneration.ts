import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateQuoteForBudget } from '@/lib/generateQuoteForBudget';

interface GenerateQuoteParams {
  budgetId: string;
  showSuccessToast?: boolean;
}

interface GenerateQuoteResult {
  success: boolean;
  quoteId?: string;
  quoteNumber?: string;
  error?: string;
}

export const useQuoteGeneration = () => {
  const { toast } = useToast();

  const generateQuote = async ({
    budgetId,
    showSuccessToast = true,
  }: GenerateQuoteParams): Promise<GenerateQuoteResult> => {
    const result = await generateQuoteForBudget(
      budgetId,
      showSuccessToast ? toast : undefined
    );
    
    return {
      success: result.success,
      quoteId: result.quoteId,
      quoteNumber: result.quoteNumber,
      error: result.success ? undefined : 'Failed to generate quote',
    };
  };

  // Check if a quote already exists for a budget
  const checkExistingQuote = async (budgetId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('quotes')
      .select('id')
      .eq('budget_id', budgetId)
      .maybeSingle();
    
    return !!data;
  };

  return { generateQuote, checkExistingQuote };
};

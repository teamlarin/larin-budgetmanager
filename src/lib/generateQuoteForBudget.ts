import { supabase } from '@/integrations/supabase/client';
import { logAction } from '@/hooks/useActionLogger';

interface ToastFn {
  (props: { title: string; description: string; variant?: 'default' | 'destructive' }): void;
}

export const generateQuoteForBudget = async (
  budgetId: string,
  toast?: ToastFn
): Promise<{ success: boolean; quoteId?: string; quoteNumber?: string }> => {
  try {
    // Fetch budget data
    const { data: budgetData, error: budgetError } = await supabase
      .from('budgets')
      .select('*, clients(*)')
      .eq('id', budgetId)
      .single();

    if (budgetError) throw budgetError;

    // Fetch budget items
    const { data: budgetItems, error: itemsError } = await supabase
      .from('budget_items')
      .select('*')
      .eq('budget_id', budgetId);

    if (itemsError) throw itemsError;

    // Filter only products for quote
    const productItems = budgetItems?.filter(item => item.is_product) || [];

    // Fetch services linked to the budget template
    let serviceItems: any[] = [];
    if (budgetData.budget_template_id) {
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('budget_template_id', budgetData.budget_template_id);
      
      if (!servicesError && services) {
        serviceItems = services;
      }
    }

    // Calculate totals
    const productsTotal = productItems.reduce((sum, item) => sum + (item.total_cost || 0), 0);
    
    // Service price = total budget minus products
    const servicePrice = (budgetData.total_budget || 0) - productsTotal;
    
    // Override service price with calculated value
    serviceItems = serviceItems.map(service => ({
      ...service,
      gross_price: servicePrice,
      net_price: servicePrice / 1.22
    }));
    
    // Margin is already included in servicePrice (30% default from budget)
    const marginPercentage = budgetData.margin_percentage || 30;
    // servicePrice already includes the margin, no need to apply it again
    const servicesWithMargin = servicePrice;
    
    // Total before discount (products + services with margin already included)
    const totalAmount = productsTotal + servicesWithMargin;
    
    // No discount in quote generation from budget - set to 0
    const discountPercentage = 0;
    const discountedTotal = totalAmount;

    // Generate quote number (e.g., PREV-2025-001)
    const now = new Date();
    const year = now.getFullYear();
    const { data: existingQuotes } = await supabase
      .from('quotes')
      .select('quote_number')
      .like('quote_number', `PREV-${year}-%`)
      .order('created_at', { ascending: false })
      .limit(1);
    
    let quoteNumber = `PREV-${year}-001`;
    if (existingQuotes && existingQuotes.length > 0) {
      const lastNumber = parseInt(existingQuotes[0].quote_number.split('-')[2]);
      quoteNumber = `PREV-${year}-${String(lastNumber + 1).padStart(3, '0')}`;
    }

    // Save quote to database
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // In the new flow, project is created when quote is approved
    // So project_id can be null at quote creation time
    const projectId = budgetData.project_id || null;

    const { data: newQuote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        project_id: projectId,
        budget_id: budgetId,
        user_id: user.id,
        quote_number: quoteNumber,
        total_amount: totalAmount,
        discount_percentage: discountPercentage,
        margin_percentage: marginPercentage,
        discounted_total: discountedTotal,
        status: 'draft',
      })
      .select('id')
      .single();

    if (quoteError) throw quoteError;

    // Payment splits priority: client defaults first, then individual service/product splits
    if (newQuote?.id) {
      let usedClientDefaults = false;

      // 1. Try client payment splits first
      if (budgetData.client_id) {
        const { data: clientPaymentSplits } = await supabase
          .from('client_payment_splits')
          .select('*')
          .eq('client_id', budgetData.client_id)
          .order('display_order');

        if (clientPaymentSplits && clientPaymentSplits.length > 0) {
          usedClientDefaults = true;
          const quotePaymentSplits = clientPaymentSplits.map(split => ({
            quote_id: newQuote.id,
            payment_mode_id: split.payment_mode_id,
            payment_term_id: split.payment_term_id,
            percentage: split.percentage,
            display_order: split.display_order || 0,
          }));

          await supabase
            .from('quote_payment_splits')
            .insert(quotePaymentSplits);
        }
      }

      // 2. If no client defaults, fall back to individual product/service splits
      if (!usedClientDefaults) {
        // Copy product payment splits
        if (productItems.length > 0) {
          const productIds = productItems
            .filter(item => item.product_id)
            .map(item => item.product_id);

          if (productIds.length > 0) {
            const { data: productPaymentSplits } = await supabase
              .from('product_payment_splits')
              .select('*')
              .in('product_id', productIds)
              .order('display_order');

            if (productPaymentSplits && productPaymentSplits.length > 0) {
              let nextOrder = 0;
              const productQuoteSplits = productPaymentSplits.map(split => ({
                quote_id: newQuote.id,
                payment_mode_id: split.payment_mode_id,
                payment_term_id: split.payment_term_id,
                percentage: split.percentage,
                display_order: nextOrder++,
              }));

              await supabase
                .from('quote_payment_splits')
                .insert(productQuoteSplits);
            }
          }
        }

        // Copy service payment splits
        if (serviceItems.length > 0) {
          const serviceIds = serviceItems.map(service => service.id);

          if (serviceIds.length > 0) {
            const { data: servicePaymentSplits } = await supabase
              .from('service_payment_splits')
              .select('*')
              .in('service_id', serviceIds)
              .order('display_order');

            if (servicePaymentSplits && servicePaymentSplits.length > 0) {
              const { data: existingQuoteSplits } = await supabase
                .from('quote_payment_splits')
                .select('display_order')
                .eq('quote_id', newQuote.id)
                .order('display_order', { ascending: false })
                .limit(1);

              let nextOrder = existingQuoteSplits && existingQuoteSplits.length > 0
                ? (existingQuoteSplits[0].display_order || 0) + 1
                : 0;

              const serviceQuoteSplits = servicePaymentSplits.map(split => ({
                quote_id: newQuote.id,
                payment_mode_id: split.payment_mode_id,
                payment_term_id: split.payment_term_id,
                percentage: split.percentage,
                display_order: nextOrder++,
              }));

              await supabase
                .from('quote_payment_splits')
                .insert(serviceQuoteSplits);
            }
          }
        }
      }
    }

    // Log the action
    await logAction({
      actionType: 'create',
      actionDescription: `Preventivo ${quoteNumber} creato automaticamente per budget approvato`,
      entityType: 'quote',
      entityId: newQuote.id,
      metadata: { budgetId, quoteNumber }
    });

    if (toast) {
      toast({
        title: 'Preventivo creato',
        description: `Il preventivo ${quoteNumber} è stato generato automaticamente.`,
      });
    }

    return {
      success: true,
      quoteId: newQuote.id,
      quoteNumber,
    };
  } catch (error) {
    console.error('Error generating quote:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Si è verificato un errore durante la creazione del preventivo.';
    
    if (toast) {
      toast({
        title: 'Errore',
        description: errorMessage,
        variant: 'destructive',
      });
    }

    return {
      success: false,
    };
  }
};

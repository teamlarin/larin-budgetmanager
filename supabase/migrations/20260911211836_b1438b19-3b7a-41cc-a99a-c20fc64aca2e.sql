UPDATE public.payment_terms
SET days = 0, due_basis = 'data_documento', updated_at = now()
WHERE label = 'Pagamento immediato' AND days IS NULL;
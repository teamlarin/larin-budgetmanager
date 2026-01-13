-- Aggiorna i budget_items dei prodotti per usare il prezzo netto invece del lordo
UPDATE budget_items bi
SET 
  hourly_rate = p.net_price,
  total_cost = p.net_price * bi.hours_worked
FROM products p
WHERE bi.product_id = p.id
  AND bi.is_product = true
  AND bi.hourly_rate != p.net_price;
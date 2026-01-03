-- Update all existing product budget items to use gross_price instead of net_price
UPDATE budget_items bi
SET 
  hourly_rate = p.gross_price,
  total_cost = p.gross_price * bi.hours_worked
FROM products p
WHERE bi.is_product = true
  AND bi.product_id = p.id
  AND bi.hourly_rate = p.net_price;
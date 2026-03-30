INSERT INTO payment_modes (value, label, display_order, is_active)
VALUES ('avanzamento_lavori', 'Avanzamento lavori', 1, true);

UPDATE payment_modes SET display_order = 2 WHERE value = 'saldo consegna';
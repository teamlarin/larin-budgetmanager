ALTER TABLE quotes ADD COLUMN IF NOT EXISTS fic_document_id integer;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS fic_id integer;
-- Crea funzione per notificare cambio stato budget
CREATE OR REPLACE FUNCTION public.notify_budget_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_name TEXT;
  approver_id UUID;
  creator_id UUID;
  status_label TEXT;
BEGIN
  -- Ottieni il nome del progetto e l'id del creatore
  SELECT name, user_id INTO project_name, creator_id
  FROM projects
  WHERE id = NEW.id;

  -- Se lo stato è cambiato
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Se il budget è stato sottomesso per approvazione (in_attesa)
    IF NEW.status = 'in_attesa' THEN
      -- Notifica tutti gli admin e team_leader
      INSERT INTO public.notifications (user_id, type, title, message, project_id, read)
      SELECT 
        ur.user_id,
        'budget_pending',
        'Budget in attesa di approvazione',
        format('Il budget del progetto "%s" è in attesa di approvazione', project_name),
        NEW.id,
        false
      FROM user_roles ur
      JOIN profiles p ON p.id = ur.user_id
      WHERE ur.role IN ('admin', 'team_leader')
        AND p.approved = true
        AND p.deleted_at IS NULL
        AND ur.user_id != auth.uid(); -- Non notificare chi ha fatto l'azione
    
    -- Se il budget è stato approvato
    ELSIF NEW.status = 'approvato' THEN
      -- Notifica il creatore del progetto
      IF creator_id IS NOT NULL AND creator_id != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, project_id, read)
        VALUES (
          creator_id,
          'budget_approved',
          'Budget approvato',
          format('Il budget del progetto "%s" è stato approvato', project_name),
          NEW.id,
          false
        );
      END IF;
      
      -- Notifica anche l'account del progetto se diverso dal creatore
      IF NEW.account_user_id IS NOT NULL 
         AND NEW.account_user_id != creator_id 
         AND NEW.account_user_id != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, project_id, read)
        VALUES (
          NEW.account_user_id,
          'budget_approved',
          'Budget approvato',
          format('Il budget del progetto "%s" è stato approvato', project_name),
          NEW.id,
          false
        );
      END IF;
    
    -- Se il budget è stato rifiutato
    ELSIF NEW.status = 'rifiutato' THEN
      -- Notifica il creatore del progetto
      IF creator_id IS NOT NULL AND creator_id != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, project_id, read)
        VALUES (
          creator_id,
          'budget_rejected',
          'Budget rifiutato',
          format('Il budget del progetto "%s" è stato rifiutato', project_name),
          NEW.id,
          false
        );
      END IF;
      
      -- Notifica anche l'account del progetto se diverso dal creatore
      IF NEW.account_user_id IS NOT NULL 
         AND NEW.account_user_id != creator_id 
         AND NEW.account_user_id != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, project_id, read)
        VALUES (
          NEW.account_user_id,
          'budget_rejected',
          'Budget rifiutato',
          format('Il budget del progetto "%s" è stato rifiutato', project_name),
          NEW.id,
          false
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crea il trigger per il cambio stato budget
DROP TRIGGER IF EXISTS trigger_notify_budget_status_change ON projects;
CREATE TRIGGER trigger_notify_budget_status_change
  AFTER UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_budget_status_change();
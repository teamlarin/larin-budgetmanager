
-- Insert template
INSERT INTO public.workflow_templates (id, name, description, created_by)
VALUES (
  'a1b2c3d4-0001-4000-8000-000000000001',
  'Onboarding Nuova Risorsa',
  'Processo completo per l''inserimento di un nuovo membro del team',
  '7f687dd2-e685-4447-913f-82abc3befeb6'
);

-- Insert tasks
INSERT INTO public.workflow_task_templates (id, template_id, title, description, display_order, depends_on_task_id) VALUES
  ('b1b2c3d4-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'Creazione account email aziendale', 'Creare l''account Google Workspace per il nuovo membro', 1, NULL),
  ('b1b2c3d4-0001-4000-8000-000000000002', 'a1b2c3d4-0001-4000-8000-000000000001', 'Setup postazione di lavoro', 'Preparare scrivania, monitor e periferiche', 2, NULL),
  ('b1b2c3d4-0001-4000-8000-000000000003', 'a1b2c3d4-0001-4000-8000-000000000001', 'Accesso ai tool aziendali (Slack, Figma, ecc.)', 'Inviti a tutti i workspace necessari', 3, 'b1b2c3d4-0001-4000-8000-000000000001'),
  ('b1b2c3d4-0001-4000-8000-000000000004', 'a1b2c3d4-0001-4000-8000-000000000001', 'Meeting di benvenuto con il team', 'Presentazione al team e overview dei progetti attivi', 4, 'b1b2c3d4-0001-4000-8000-000000000003'),
  ('b1b2c3d4-0001-4000-8000-000000000005', 'a1b2c3d4-0001-4000-8000-000000000001', 'Assegnazione primo progetto di prova', 'Progetto guidato per familiarizzare con i processi interni', 5, 'b1b2c3d4-0001-4000-8000-000000000004'),
  ('b1b2c3d4-0001-4000-8000-000000000006', 'a1b2c3d4-0001-4000-8000-000000000001', 'Review primo mese', 'Feedback a 30 giorni con il team leader', 6, 'b1b2c3d4-0001-4000-8000-000000000005');

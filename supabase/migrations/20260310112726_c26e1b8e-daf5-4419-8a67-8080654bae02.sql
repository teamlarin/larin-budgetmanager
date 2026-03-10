
-- Insert template
INSERT INTO public.workflow_templates (id, name, description, created_by)
VALUES (
  'a1b2c3d4-0002-4000-8000-000000000001',
  'Checklist Lancio Sito Web',
  'Checklist completa per il go-live di un sito WordPress: plugin, contenuti, design, funzionalità, SEO, marketing, ecommerce, legal, hosting e email.',
  '7f687dd2-e685-4447-913f-82abc3befeb6'
);

-- PLUGIN
INSERT INTO public.workflow_task_templates (id, template_id, title, description, display_order, depends_on_task_id) VALUES
  ('c1000001-0001-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001', 'Installare e configurare WpRocket', '[PLUGIN] Installare e configurare il plugin WpRocket per la cache e le performance.', 1, NULL);

-- CONTENUTI
INSERT INTO public.workflow_task_templates (id, template_id, title, description, display_order, depends_on_task_id) VALUES
  ('c1000001-0002-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verificare testi temporanei', '[CONTENUTI] Verificare la presenza di testi temporanei (lorem ipsum) e sostituirli.', 2, NULL),
  ('c1000001-0002-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verificare immagini temporanee', '[CONTENUTI] Verificare la presenza di immagini temporanee o con watermark. Rimuovere immagini in libreria media importate da template demo.', 3, NULL),
  ('c1000001-0002-4000-8000-000000000003', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verificare pagina 404', '[CONTENUTI] Verificare la presenza e il corretto design di una pagina di errore 404.', 4, NULL),
  ('c1000001-0002-4000-8000-000000000004', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verificare redirect e motori di ricerca', '[CONTENUTI] Verificare la presenza del sito sui motori di ricerca e predisporre eventuali redirect. Vale se il sito è un rifacimento di un sito esistente sullo stesso dominio.', 5, NULL);

-- DESIGN
INSERT INTO public.workflow_task_templates (id, template_id, title, description, display_order, depends_on_task_id) VALUES
  ('c1000001-0003-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verifica cross-browser', '[DESIGN] Verificare la resa del sito sui browser maggiori: ultima versione di Chrome, Firefox, Edge.', 6, NULL),
  ('c1000001-0003-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verifica resa mobile', '[DESIGN] Verificare la resa su dispositivi mobili.', 7, NULL),
  ('c1000001-0003-4000-8000-000000000003', 'a1b2c3d4-0002-4000-8000-000000000001', 'Test compatibilità mobile', '[DESIGN] Verificare la compatibilità con dispositivi mobili. Utilizzare Google Mobile Testing Tool per un rapporto sulla compatibilità. https://search.google.com/test/mobile-friendly', 8, 'c1000001-0003-4000-8000-000000000002'),
  ('c1000001-0003-4000-8000-000000000004', 'a1b2c3d4-0002-4000-8000-000000000001', 'Ottimizzare le immagini', '[DESIGN] Verificare se sono servite immagini troppo grandi rispetto alla loro visualizzazione e ridurle se possibile.', 9, NULL),
  ('c1000001-0003-4000-8000-000000000005', 'a1b2c3d4-0002-4000-8000-000000000001', 'Aggiungere Favicon', '[DESIGN] Aggiungere una Favicon al sito.', 10, NULL),
  ('c1000001-0003-4000-8000-000000000006', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verifica logo', '[DESIGN] Verificare che il logo del cliente sia presente in header e collegato alla homepage del sito.', 11, NULL);

-- FUNZIONALITÀ
INSERT INTO public.workflow_task_templates (id, template_id, title, description, display_order, depends_on_task_id) VALUES
  ('c1000001-0004-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001', 'Test funzionamento moduli', '[FUNZIONALITÀ] Per ogni modulo presente nel sito verificare la presenza di una spunta privacy e il corretto funzionamento delle integrazioni. Verificare i messaggi di conferma ed errore.', 12, NULL),
  ('c1000001-0004-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000001', 'Inserire Re-Captcha v3', '[FUNZIONALITÀ] Inserire Re-Captcha v3 nei moduli del sito.', 13, 'c1000001-0004-4000-8000-000000000001'),
  ('c1000001-0004-4000-8000-000000000003', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verificare velocità del sito', '[FUNZIONALITÀ] Utilizzare Google Pagespeed Insights, GTMetrix e Pingdom per verificare il tempo di caricamento. Se possibile ridurlo sotto i 2 secondi.', 14, 'c1000001-0001-4000-8000-000000000001'),
  ('c1000001-0004-4000-8000-000000000004', 'a1b2c3d4-0002-4000-8000-000000000001', 'Testare condivisioni e link social', '[FUNZIONALITÀ] Testare il funzionamento delle condivisioni e link social.', 15, NULL);

-- SEO
INSERT INTO public.workflow_task_templates (id, template_id, title, description, display_order, depends_on_task_id) VALUES
  ('c1000001-0005-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001', 'Installare plugin SEO (Yoast)', '[SEO] Installare e configurare un plugin SEO (Yoast Seo).', 16, NULL),
  ('c1000001-0005-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000001', 'Impostare titolo del sito', '[SEO] Impostare correttamente il titolo del sito.', 17, 'c1000001-0005-4000-8000-000000000001'),
  ('c1000001-0005-4000-8000-000000000003', 'a1b2c3d4-0002-4000-8000-000000000001', 'Titoli e descrizioni pagine', '[SEO] Impostare il titolo e la descrizione delle pagine.', 18, 'c1000001-0005-4000-8000-000000000001'),
  ('c1000001-0005-4000-8000-000000000004', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verificare struttura permalink', '[SEO] Verificare la struttura dei permalink. Il permalink della pagina/articolo deve contenere la parola chiave principale.', 19, NULL),
  ('c1000001-0005-4000-8000-000000000005', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verificare alt immagini', '[SEO] Verificare i nomi dei file delle immagini e le loro descrizioni alt.', 20, NULL),
  ('c1000001-0005-4000-8000-000000000006', 'a1b2c3d4-0002-4000-8000-000000000001', 'Creare Sitemap e inviarla a Search Console', '[SEO] Creare la sitemap del sito con Yoast o con la sitemap interna di WordPress e inviarla a Search Console.', 21, 'c1000001-0005-4000-8000-000000000001');

-- MARKETING
INSERT INTO public.workflow_task_templates (id, template_id, title, description, display_order, depends_on_task_id) VALUES
  ('c1000001-0006-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001', 'Implementare iscrizioni newsletter', '[MARKETING] Implementare le iscrizioni alla newsletter.', 22, NULL),
  ('c1000001-0006-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000001', 'Impostare icone social', '[MARKETING] Impostare le icone social nel sito.', 23, NULL),
  ('c1000001-0006-4000-8000-000000000003', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verificare profili social collegati', '[MARKETING] Verificare i profili social collegati.', 24, 'c1000001-0006-4000-8000-000000000002');

-- ECOMMERCE
INSERT INTO public.workflow_task_templates (id, template_id, title, description, display_order, depends_on_task_id) VALUES
  ('c1000001-0007-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verificare sistemi di pagamento', '[ECOMMERCE] Verificare sistemi di pagamento (togliere sandbox).', 25, NULL),
  ('c1000001-0007-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verificare impostazioni spedizioni', '[ECOMMERCE] Verificare impostazioni spedizioni.', 26, NULL),
  ('c1000001-0007-4000-8000-000000000003', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verificare aliquote', '[ECOMMERCE] Verificare impostazioni aliquote.', 27, NULL),
  ('c1000001-0007-4000-8000-000000000004', 'a1b2c3d4-0002-4000-8000-000000000001', 'Testare aggiunta a carrello', '[ECOMMERCE] Testare aggiunta a carrello.', 28, NULL),
  ('c1000001-0007-4000-8000-000000000005', 'a1b2c3d4-0002-4000-8000-000000000001', 'Testare checkout', '[ECOMMERCE] Testare il flusso di checkout completo.', 29, 'c1000001-0007-4000-8000-000000000004'),
  ('c1000001-0007-4000-8000-000000000006', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verifica pagina conferma acquisto', '[ECOMMERCE] Verifica pagina di conferma acquisto.', 30, 'c1000001-0007-4000-8000-000000000005');

-- LEGAL
INSERT INTO public.workflow_task_templates (id, template_id, title, description, display_order, depends_on_task_id) VALUES
  ('c1000001-0008-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001', 'Dettagli azienda nel footer', '[LEGAL] Mostrare i dettagli dell''azienda nel footer, inclusa la partita IVA.', 31, NULL),
  ('c1000001-0008-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000001', 'Acquisire licenze necessarie', '[LEGAL] Se sono stati utilizzati plugin o risorse a pagamento, verificare le licenze necessarie.', 32, NULL),
  ('c1000001-0008-4000-8000-000000000003', 'a1b2c3d4-0002-4000-8000-000000000001', 'Copyright nel footer', '[LEGAL] Includere informazioni di copyright nel footer.', 33, NULL),
  ('c1000001-0008-4000-8000-000000000004', 'a1b2c3d4-0002-4000-8000-000000000001', 'Pagina Cookie Policy', '[LEGAL] Creare pagina Cookie Policy. Collegarla direttamente a Complianz se utilizzato.', 34, NULL),
  ('c1000001-0008-4000-8000-000000000005', 'a1b2c3d4-0002-4000-8000-000000000001', 'Pagina Privacy', '[LEGAL] Implementare una pagina privacy con le informazioni del cliente.', 35, NULL),
  ('c1000001-0008-4000-8000-000000000006', 'a1b2c3d4-0002-4000-8000-000000000001', 'Termini e Condizioni', '[LEGAL] Nel caso di un e-commerce aggiungere la pagina Termini e Condizioni.', 36, NULL),
  ('c1000001-0008-4000-8000-000000000007', 'a1b2c3d4-0002-4000-8000-000000000001', 'Banner cookie e GDPR (Complianz)', '[LEGAL] Implementare un banner cookie e GDPR tramite Complianz plugin.', 37, 'c1000001-0008-4000-8000-000000000004');

-- WPZEN - KINSTA
INSERT INTO public.workflow_task_templates (id, template_id, title, description, display_order, depends_on_task_id) VALUES
  ('c1000001-0009-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verificare versione PHP', '[KINSTA] Verificare la versione di PHP utilizzata. Selezionare l''ultima release stabile. https://my.kinsta.com/sites', 38, NULL),
  ('c1000001-0009-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000001', 'Verificare SSL e Force HTTPS', '[KINSTA] Verificare che SSL e Force HTTPS siano attivi.', 39, NULL),
  ('c1000001-0009-4000-8000-000000000003', 'a1b2c3d4-0002-4000-8000-000000000001', 'Rimuovere Password Protection', '[KINSTA] Rimuovere eventuale Password Protection.', 40, NULL),
  ('c1000001-0009-4000-8000-000000000004', 'a1b2c3d4-0002-4000-8000-000000000001', 'Cancellare la cache', '[KINSTA] Cancellare la cache del sito.', 41, NULL),
  ('c1000001-0009-4000-8000-000000000005', 'a1b2c3d4-0002-4000-8000-000000000001', 'Installare must-use plugin Kinsta', '[KINSTA] Installare il must-use plugin di Kinsta per gestire la cache.', 42, NULL),
  ('c1000001-0009-4000-8000-000000000006', 'a1b2c3d4-0002-4000-8000-000000000001', 'Impostare etichetta sito Kinsta', '[KINSTA] Impostare etichetta corretta nell''elenco siti.', 43, NULL);

-- WPZEN - WPUMBRELLA
INSERT INTO public.workflow_task_templates (id, template_id, title, description, display_order, depends_on_task_id) VALUES
  ('c1000001-000a-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001', 'Aggiungere sito a WpUmbrella', '[WPUMBRELLA] Aggiungere sito a WpUmbrella tramite plugin e Api key. https://app.wp-umbrella.com/projects', 44, NULL),
  ('c1000001-000a-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000001', 'Impostare etichetta WpUmbrella', '[WPUMBRELLA] Impostare etichetta nel pannello WpUmbrella.', 45, 'c1000001-000a-4000-8000-000000000001'),
  ('c1000001-000a-4000-8000-000000000003', 'a1b2c3d4-0002-4000-8000-000000000001', 'Configurare monitoraggio uptime', '[WPUMBRELLA] Impostare monitoraggio uptime.', 46, 'c1000001-000a-4000-8000-000000000001'),
  ('c1000001-000a-4000-8000-000000000004', 'a1b2c3d4-0002-4000-8000-000000000001', 'Configurare report WpUmbrella', '[WPUMBRELLA] Configurare i report automatici.', 47, 'c1000001-000a-4000-8000-000000000001'),
  ('c1000001-000a-4000-8000-000000000005', 'a1b2c3d4-0002-4000-8000-000000000001', 'Disattivare plugin di sviluppo', '[WPUMBRELLA] Disattivare o disinstallare eventuali plugin di sviluppo.', 48, NULL);

-- EMAIL
INSERT INTO public.workflow_task_templates (id, template_id, title, description, display_order, depends_on_task_id) VALUES
  ('c1000001-000b-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001', 'Configurare PostSMTP e Mandrill', '[EMAIL] Installare PostSMTP e configurare un account Mandrill (non sempre necessario).', 49, NULL);

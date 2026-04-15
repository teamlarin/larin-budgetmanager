
-- =============================================
-- PERFORMANCE PROFILES (upsert)
-- =============================================

-- 1. Jessica Borsoi
INSERT INTO performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support)
VALUES (
  '409eb142-19d5-4850-949a-e9bd6293da6b',
  'Project Manager',
  'Marketing',
  'Alessandro Di Maio',
  '2024-03-11',
  'Indeterminato',
  E'RAL: 22.930€\nCCNL: Commercio\nLivello: 5\nBuoni pasto: 6€/giorno\nBudget formazione 2026: 600€\nFringe benefit: -\nWelfare: -',
  E'settembre 2025 - aumento RAL\n\nBonus:\n2024: -\n2025: 650€ (fringe benefit + bonus)\n\nBudget formazione:\n2025: 600€',
  'Un ruolo in cui il tuo talento naturale per l''organizzazione, il presidio dei flussi e la gestione operativa diventi un asset strutturale per Larin, non solo per i singoli progetti che segui.',
  'Costruire un profilo professionale solido e riconoscibile, che sappia mettere insieme gestione e esecuzione, in cui eccellenza esecutiva e capacità di creare ordine nei sistemi diventino il tuo tratto distintivo dentro e fuori Larin.',
  E'• Affiancamento diretto con CEO su un progetto strategico interno (marketing Larin)\n• Affiancamento Head of Operations\n• Supporto al percorso di formazione e spazio concreto per applicare le competenze che stai acquisendo nel master'
) ON CONFLICT (user_id) DO UPDATE SET
  job_title = EXCLUDED.job_title, team = EXCLUDED.team, team_leader_name = EXCLUDED.team_leader_name,
  start_date = EXCLUDED.start_date, contract_type = EXCLUDED.contract_type, compensation = EXCLUDED.compensation,
  contract_history = EXCLUDED.contract_history, career_target_role = EXCLUDED.career_target_role,
  career_long_term_goal = EXCLUDED.career_long_term_goal, company_support = EXCLUDED.company_support;

-- 2. Simona Chiofalo
INSERT INTO performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support)
VALUES (
  '36fef080-2aed-4798-a3ab-e61678bb7bcd',
  'Social media & Copywriter',
  'Marketing',
  'Alessandro Di Maio',
  '2024-06-01',
  'Partita IVA',
  E'RAL/Compenso: 19.200€\nContratto: Partita IVA',
  E'01/01/2026 contratto con incremento ore',
  'Social Media Manager & Copywriter autonoma e integrata, punto di riferimento operativo affidabile per i progetti',
  'Consolidare la tua posizione come professionista su cui Larin può contare in piena autonomia, capace di gestire end-to-end i progetti social e content con qualità costante, senza bisogno di supervisione, e di essere una risorsa flessibile e presente per le esigenze del team.',
  E'• Ti affiancheremo con feedback strutturati\n• Ti coinvolgeremo progressivamente in dinamiche di team più ampie e ti supporteremo nell''adozione di strumenti AI\n• Ci impegneremo nel creare condizioni per approcciare a progetti che prevedano "UX writing"'
) ON CONFLICT (user_id) DO UPDATE SET
  job_title = EXCLUDED.job_title, team = EXCLUDED.team, team_leader_name = EXCLUDED.team_leader_name,
  start_date = EXCLUDED.start_date, contract_type = EXCLUDED.contract_type, compensation = EXCLUDED.compensation,
  contract_history = EXCLUDED.contract_history, career_target_role = EXCLUDED.career_target_role,
  career_long_term_goal = EXCLUDED.career_long_term_goal, company_support = EXCLUDED.company_support;

-- 3. Alessia Da Deppo
INSERT INTO performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support)
VALUES (
  '4677f8e0-fbf5-4a37-9957-8457c28650a3',
  'Brand & Digital Designer',
  'Marketing',
  'Alessandro Di Maio',
  NULL,
  'Indeterminato',
  E'RAL/Compenso: 27.503€\nCCNL: Commercio\nLivello: 3\nBuoni pasto: 6€/giorno\nBudget formazione: 600€\nFringe benefit: 1.000€\nWelfare: -',
  E'07/01/2025 - assunzione a tempo indeterminato',
  NULL,
  NULL,
  NULL
) ON CONFLICT (user_id) DO UPDATE SET
  job_title = EXCLUDED.job_title, team = EXCLUDED.team, team_leader_name = EXCLUDED.team_leader_name,
  start_date = EXCLUDED.start_date, contract_type = EXCLUDED.contract_type, compensation = EXCLUDED.compensation,
  contract_history = EXCLUDED.contract_history, career_target_role = EXCLUDED.career_target_role,
  career_long_term_goal = EXCLUDED.career_long_term_goal, company_support = EXCLUDED.company_support;

-- 4. Francesco Ferrari
INSERT INTO performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support)
VALUES (
  'c4d0411e-9343-4b37-a407-05281d357a71',
  'Marketing Automation',
  'Marketing',
  'Alessandro Di Maio',
  '2024-10-01',
  'Partita IVA',
  E'RAL/Compenso: 38.400€\nContratto: Partita IVA - 120h/mese',
  E'01/04/2025 - contratto\n\nBonus:\n2025: 400€',
  'Responsabile Area Automation, il riferimento tecnico e operativo dell''agenzia su tutto ciò che riguarda marketing automation, CRM, ActiveCampaign e HubSpot.',
  'Consolidarti come l''expert interno che governa l''area end-to-end: dalla consulenza al cliente, al delivery, alla gestione economica, fino al coordinamento delle risorse. Non un percorso verso il management "classico", ma verso una seniority di specializzazione.',
  E'• Inseriamo Jessica al tuo fianco con un ruolo operativo e di supporto\n• Ti affianchiamo nel presidiare la dimensione economica dell''area\n• Avrai ownership sulla crescita del portafoglio ActiveCampaign e HubSpot\n• Avrai spazio per esplorare e integrare AI nell''area automation / sales enablement'
) ON CONFLICT (user_id) DO UPDATE SET
  job_title = EXCLUDED.job_title, team = EXCLUDED.team, team_leader_name = EXCLUDED.team_leader_name,
  start_date = EXCLUDED.start_date, contract_type = EXCLUDED.contract_type, compensation = EXCLUDED.compensation,
  contract_history = EXCLUDED.contract_history, career_target_role = EXCLUDED.career_target_role,
  career_long_term_goal = EXCLUDED.career_long_term_goal, company_support = EXCLUDED.company_support;

-- 5. Deborah Graziani
INSERT INTO performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support)
VALUES (
  '626d0846-1966-4336-ad80-df6b330933da',
  'Social media & Content',
  'Marketing',
  'Alessandro Di Maio',
  '2024-07-01',
  'Indeterminato',
  E'RAL/Compenso: 15.063€\nCCNL: Commercio\nLivello: 4\nBuoni pasto: 6€/giorno\nBudget formazione: 600€\nFringe benefit: 150€\nWelfare: -',
  E'luglio 2024 (stage)\n20/01/2025 - assunzione\n\nBonus:\n2025: 250€',
  'Senior Copywriter, il riferimento interno per la qualità dei contenuti, capace di unire scrittura efficace, pensiero strategico e padronanza degli strumenti AI.',
  'Diventare la persona a cui il team si rivolge quando serve trasformare un brief in un contenuto che funziona. Non solo esecuzione, ma punto di vista: saper dire "questo non ha senso, facciamo così" con autorevolezza e dati a supporto.',
  E'• Accesso a un progetto pilota dove sperimentare in autonomia\n• Copertura e supporto quando vorrai portare una posizione forte al cliente\n• Investimento in formazione tecnica (analytics, tool AI)\n• Ti chiederemo di uscire dalla comfort zone: vogliamo sentire la tua voce nei meeting'
) ON CONFLICT (user_id) DO UPDATE SET
  job_title = EXCLUDED.job_title, team = EXCLUDED.team, team_leader_name = EXCLUDED.team_leader_name,
  start_date = EXCLUDED.start_date, contract_type = EXCLUDED.contract_type, compensation = EXCLUDED.compensation,
  contract_history = EXCLUDED.contract_history, career_target_role = EXCLUDED.career_target_role,
  career_long_term_goal = EXCLUDED.career_long_term_goal, company_support = EXCLUDED.company_support;

-- 6. Beatrice Mazza
INSERT INTO performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support)
VALUES (
  '243e4613-edac-4afb-9af7-8ee6f6278fd0',
  NULL,
  'Marketing',
  'Alessandro Di Maio',
  '2024-06-24',
  'Indeterminato',
  E'RAL/Compenso: 28.420€\nCCNL: Commercio\nLivello: 3\nBuoni pasto: 8€/giorno\nBudget formazione: 600€\nFringe benefit: -',
  E'Bonus:\n2025: 1.250€ (fringe benefit + bonus)',
  'Creative & Brand Leader della unit Marketing Services, con piena ownership sulla visione, direzione creativa e posizionamento dell''offerta branding di Larin.',
  'Fare di te il punto di riferimento interno ed esterno per il branding in Larin - chi definisce il "gusto", chi difende la qualità, chi guida le scelte creative e strategiche dei progetti.',
  E'• Inseriremo una figura con forte orientamento organizzativo e di pianificazione\n• Concentrare le energie su visione del branding, qualità dei deliverable, costruzione del track record\n• Ruolo chiave nel trasferire la cultura Larin alle nuove figure marketing\n• Spazio per esprimerti come thought leader sul branding'
) ON CONFLICT (user_id) DO UPDATE SET
  job_title = EXCLUDED.job_title, team = EXCLUDED.team, team_leader_name = EXCLUDED.team_leader_name,
  start_date = EXCLUDED.start_date, contract_type = EXCLUDED.contract_type, compensation = EXCLUDED.compensation,
  contract_history = EXCLUDED.contract_history, career_target_role = EXCLUDED.career_target_role,
  career_long_term_goal = EXCLUDED.career_long_term_goal, company_support = EXCLUDED.company_support;

-- 7. Stefano Michelis
INSERT INTO performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support)
VALUES (
  '7f687dd2-e685-4447-913f-82abc3befeb6',
  'Performance Specialist',
  'Marketing',
  'Alessandro Di Maio',
  '2024-03-01',
  'Partita IVA',
  E'Compenso annuo: 32.400€\nContratto: Partita IVA - 120h/mese',
  E'Storico variazioni: -\n\nBonus:\n2025: 300€',
  'Senior Performance Specialist',
  'Diventare il punto di riferimento interno ed esterno per il paid advertising, non solo in termini di esecuzione tecnica ma anche di metodo, misurazione e integrazione con le altre leve marketing.',
  E'Salto di qualità sul metodo: meno "smanettamento" e più struttura logica, dashboard, benchmark. Pieno supporto a livello di tool e collaborazione con altri elementi del team.\n\nMomenti di confronto periodici e maggiore proattività nel proporre, documentare e condividere.'
) ON CONFLICT (user_id) DO UPDATE SET
  job_title = EXCLUDED.job_title, team = EXCLUDED.team, team_leader_name = EXCLUDED.team_leader_name,
  start_date = EXCLUDED.start_date, contract_type = EXCLUDED.contract_type, compensation = EXCLUDED.compensation,
  contract_history = EXCLUDED.contract_history, career_target_role = EXCLUDED.career_target_role,
  career_long_term_goal = EXCLUDED.career_long_term_goal, company_support = EXCLUDED.company_support;

-- 8. Lorenzo Rossi
INSERT INTO performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support)
VALUES (
  '864771ae-c99e-436e-87ba-b336bdd04a71',
  'Content Manager / Specialist',
  'Marketing',
  'Alessandro Di Maio',
  NULL,
  'Indeterminato',
  E'RAL: 25.904€\nCCNL: Commercio\nLivello: 4\nBuoni pasto: 8€/giorno\nBudget formazione: 600€\nFringe benefit: -\nWelfare: -',
  E'15/11/2021 assunzione apprendistato\nassunzione tempo indeterminato\n01/11/2024 aumento RAL\n01/10/2025 aumento RAL e buoni pasto\n\nBonus:\n2025: 1.250€ (fringe benefit + bonus)',
  'Content Lead: il riferimento metodologico e strategico per il racconto di marca in Larin. Non un ruolo di gestione persone, ma di guida tecnica.',
  'Diventare il custode e l''evoluzionista del metodo content Larin. Costruire un approccio riconoscibile che i clienti associno a noi, che i colleghi sappiano applicare, che il mercato percepisca come distintivo.',
  E'• Verrà inserito un Team Leader Marketing per liberare tempo dalla gestione operativa\n• Percorso formativo su stili comunicativi e gestione delle relazioni professionali\n• Occasioni strutturate di confronto strategico con la direzione\n• Sarai il traino per la definizione del "metodo content" come asset aziendale'
) ON CONFLICT (user_id) DO UPDATE SET
  job_title = EXCLUDED.job_title, team = EXCLUDED.team, team_leader_name = EXCLUDED.team_leader_name,
  start_date = EXCLUDED.start_date, contract_type = EXCLUDED.contract_type, compensation = EXCLUDED.compensation,
  contract_history = EXCLUDED.contract_history, career_target_role = EXCLUDED.career_target_role,
  career_long_term_goal = EXCLUDED.career_long_term_goal, company_support = EXCLUDED.company_support;

-- =============================================
-- PERFORMANCE REVIEWS (year 2026)
-- =============================================

-- 1. Jessica Borsoi
INSERT INTO performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  '409eb142-19d5-4850-949a-e9bd6293da6b', 2026, 'Q4 2025',
  E'• Affidabilità e ownership. Presidio costante delle attività assegnate. Senso di responsabilità elevato. I progetti nelle tue mani arrivano a conclusione.\n• Eccellenza nella gestione di processi e flussi. Capacità naturale di orchestrare fornitori, scadenze, deliverable e relazioni operative.\n• Qualità della relazione con i clienti. Costruisci fiducia. I clienti si sentono ascoltati e seguiti.\n• Disciplina e standard elevati. Esigente con te stessa. Orientata a consegnare lavoro di qualità.',
  E'• Calibrazione qualità/velocità. Tendenza ad applicare lo stesso livello di cura a tutte le attività, indipendentemente dalla priorità.\n• Assertività e posizionamento del proprio punto di vista. Tendenza a trattenersi nel portare idee o obiezioni.\n• Gestione del feedback. Fatica a restituire feedback negativi o correttivi ai colleghi.\n• Visibilità e self-promotion. Tendi a non comunicare spontaneamente i tuoi "plus".\n• Dipendenza dal riconoscimento. Quando manca un riscontro positivo, tendi a lavorare in modo più frustrato.'
);

-- 2. Simona Chiofalo
INSERT INTO performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  '36fef080-2aed-4798-a3ab-e61678bb7bcd', 2026, 'Q4 2025',
  E'• Metodo e affidabilità. Lavoro solido, organizzato, costante.\n• Relazione con i clienti. Gestisci bene il rapporto con i clienti. Sai mantenere un tono professionale e positivo.\n• Atteggiamento e cultura. Sei solare, positiva, vivi con entusiasmo i valori Larin.',
  E'• Proattività e visione di team. Tendenza a focalizzarsi sul proprio perimetro di lavoro.\n• Flessibilità di processo. A volte la rigidità metodologica può diventare un limite.\n• Adozione strumenti AI. Margine di crescita nell''integrazione dell''AI nei flussi di lavoro quotidiani.'
);

-- 3. Alessia Da Deppo
INSERT INTO performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  '4677f8e0-fbf5-4a37-9957-8457c28650a3', 2026, 'Q4 2025',
  E'• Capacità di coordinamento tra team. Integri efficacemente le competenze di Creatività e Tech.\n• Voglia di imparare e applicare nuove competenze. Il percorso di master in AI dimostra curiosità e desiderio di innovare.\n• Dialogo efficace con il cliente. Comunicazione calma e professionale.\n• Ottime competenze linguistiche. Padronanza dell''inglese per progetti internazionali.',
  E'• Gestione del tempo. Migliorare in relazione a priorità e tipologia di cliente, gestendo meglio la delega.\n• Art Direction. Consolidare la maturità per diventare la guida interna sulla creatività Larin.\n• Leadership nei progetti. Far emergere la capacità di guidare progetti complessi.\n• Public speaking. Fondamentale per progredire nel ruolo.'
);

-- 4. Francesco Ferrari
INSERT INTO performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  'c4d0411e-9343-4b37-a407-05281d357a71', 2026, 'Q4 2025',
  E'• Profondità tecnica e padronanza dell''area. Competenza solida su marketing automation, HubSpot, ActiveCampaign.\n• Affidabilità e responsabilità. Consegni quello che prometti, mantieni gli impegni.\n• Capacità di gestione della relazione cliente. Sai costruire fiducia e posizionarti come consulente.\n• Visione oltre il tecnico. Ragionamenti evoluti anche lato business e posizionamento commerciale.',
  E'• Pensiero anticipatorio e proattività. Sviluppare la capacità di anticipare bisogni non esplicitati.\n• Gestione dell''ambiguità. Sviluppare maggiore comfort nel navigare contesti incerti con informazioni incomplete.'
);

-- 5. Deborah Graziani
INSERT INTO performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  '626d0846-1966-4336-ad80-df6b330933da', 2026, 'Q4 2025',
  E'• Talento creativo e passione autentica per la scrittura/content. Motivazione intrinseca per il content e il copywriting.\n• Capacità di gestire carichi di lavoro. Studio universitario e lavoro con equilibrio.\n• Recettività al feedback. Ascolti, elabori, reagisci in modo genuino.',
  E'• Proattività e ownership. Tendenza ad aspettare indicazioni piuttosto che anticipare problemi.\n• Orientamento ai dati e ai benchmark. Necessità di crescere in competenze tecniche.\n• Rischio di approccio meccanico. Sui progetti meno stimolanti, pericolo di lavorare in modalità "esecutiva".'
);

-- 6. Beatrice Mazza
INSERT INTO performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  '243e4613-edac-4afb-9af7-8ee6f6278fd0', 2026, 'Q4 2025',
  E'• Affidabilità e motivazione. Quando prendi un impegno, lo porti avanti con disciplina.\n• Capacità di motivare il team. Generi energia positiva verso il gruppo.\n• Visione creativa e sensibilità di brand. Alzi il livello del lavoro sulla direzione creativa.\n• Interprete autentica della cultura Larin. Tra le persone che meglio incarnano i valori dell''agenzia.',
  E'• Pianificazione e gestione delle priorità. Difficoltà strutturale nell''organizzare l''agenda.\n• Saper dire di no. Tendenza ad accettare richieste senza valutare l''impatto sulla pianificazione.\n• Assertività e autorevolezza nella comunicazione. Fatica a farsi ascoltare quando segnala criticità.'
);

-- 7. Stefano Michelis
INSERT INTO performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  '7f687dd2-e685-4447-913f-82abc3befeb6', 2026, 'Q4 2025',
  E'• Competenza tecnica. Padronanza consolidata delle piattaforme adv.\n• Presenza positiva nel team. Clima collaborativo, disponibilità verso colleghi e clienti.\n• Affidabilità come punto di contatto tecnico. Risposte operative e tecniche affidabili.',
  E'• Struttura logica e strategica del ragionamento. Tendenza a perdersi nei dettagli tecnici senza filo logico chiaro.\n• Approccio data-informed e reporting strutturato. Manca l''uso sistematico di dashboard, benchmark e modelli previsionali.\n• Proattività e ownership. Tendenza ad aspettare input invece di anticipare bisogni.'
);

-- 8. Lorenzo Rossi
INSERT INTO performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  '864771ae-c99e-436e-87ba-b336bdd04a71', 2026, 'Q4 2025',
  E'• Performance operativa individuale. Alto livello in autonomia su task definiti. Capacità di acquisire competenze velocemente.\n• Trasversalità culturale. Ampiezza di interessi che connette mondi diversi.\n• Potenziale creativo e di specializzazione. Predisposizione nell''area content e creativa.\n• Risposta positiva al riconoscimento. Il feedback positivo attiva energie aggiuntive.',
  E'• Gestione dell''energia e impatto sullo stile comunicativo. Nei momenti di calo tendi a diventare spigoloso.\n• Adattamento comunicativo. Tendenza a volere che gli altri ragionino come te.\n• Collaborazione e relazione con i colleghi. Funzioni meglio da solista, importante integrarsi in dinamiche di team.'
);

-- =============================================
-- PERFORMANCE OBJECTIVES
-- Now we need to link to review IDs. We use a DO block.
-- =============================================

DO $$
DECLARE
  v_review_id UUID;
BEGIN
  -- Jessica Borsoi objectives
  SELECT id INTO v_review_id FROM performance_reviews WHERE user_id = '409eb142-19d5-4850-949a-e9bd6293da6b' AND year = 2026 LIMIT 1;
  IF v_review_id IS NOT NULL THEN
    INSERT INTO performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
    (v_review_id, 'Eccellenza operativa sui progetti gestiti', E'Risultati chiave:\n• Tutti i progetti gestiti chiudono con margine ≥ target definito\n• Rating cliente positivo su tutti i progetti in gestione\n• Strutturare almeno 5 framework / template\n• Almeno 5 upselling avviati / creati', 45, 1),
    (v_review_id, 'Ordine e struttura per il marketing interno Larin', E'Risultati chiave:\n• Mappatura completa dei materiali esistenti (presentazioni, portfolio, case, tono di voce) - entro Q1\n• Creazione di almeno 5 template/framework riutilizzabili per Sales e Team entro Q2\n• Notion marketing Larin strutturato e aggiornato come "fonte unica di verità"', 35, 2),
    (v_review_id, 'Trasferimento competenze AI al team e contributo a Jarvis', E'Risultati chiave:\n• Almeno 2 sessioni di condivisione interna su quanto appreso\n• Almeno 2 processi interni Larin migliorati con applicazione AI documentata\n• Contributo attivo a Jarvis: almeno 1 progetto/cliente seguito con supporto AI strutturato entro Q2', 20, 3);
  END IF;

  -- Simona Chiofalo objectives
  SELECT id INTO v_review_id FROM performance_reviews WHERE user_id = '36fef080-2aed-4798-a3ab-e61678bb7bcd' AND year = 2026 LIMIT 1;
  IF v_review_id IS NOT NULL THEN
    INSERT INTO performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
    (v_review_id, 'Gestione autonoma dei progetti assegnati', E'Risultati attesi:\n• Portare a termine i progetti rispettando tempi e standard qualitativi senza supervisione\n• Ridurre le richieste di validazione su task operativi già definiti\n• Gestire in autonomia la relazione operativa con i clienti assegnati\n• Soddisfazione cliente (feedback positivo su almeno 90% dei progetti)', 40, 1),
    (v_review_id, 'Partecipazione attiva alla vita del team', E'Risultati attesi:\n• Rendersi disponibile per attività e task oltre il proprio perimetro progettuale\n• Partecipare attivamente a momenti di team, brainstorming, esigenze collettive\n• Proposta di idee, approfondimenti, attività, miglioramenti', 35, 2),
    (v_review_id, 'Evoluzione professionale e adozione AI', E'Risultati attesi:\n• Integrare strumenti AI nel flusso di lavoro quotidiano\n• Sviluppare maggiore flessibilità nell''applicazione dei processi', 25, 3);
  END IF;

  -- Alessia Da Deppo objectives
  SELECT id INTO v_review_id FROM performance_reviews WHERE user_id = '4677f8e0-fbf5-4a37-9957-8457c28650a3' AND year = 2026 LIMIT 1;
  IF v_review_id IS NOT NULL THEN
    INSERT INTO performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
    (v_review_id, 'Diventare il riferimento del team per l''Art Direction digitale', E'Misurazione:\n• Supervisiona e dirige almeno 4 progetti digitali strategici come Art Director\n• Crea e implementa un Digital Design Framework entro Q3\n• Aumenta la qualità media dell''output (coerenza con la strategia, approccio creativo, soddisfazione cliente)', 45, 1),
    (v_review_id, 'Coordinamento tra team creatività, Jarvis e Tech', E'Misurazione:\n• Almeno 2 sessioni formative (learning friday) su AI applicata alla creatività entro Q3\n• Feedback TL/PL ≥ 4/5 sull''efficacia nel ruolo di raccordo tra i team\n• Segue almeno 3 progetti ibridi AI + creatività entro Q3', 35, 2),
    (v_review_id, 'Guidare la crescita di Alessia Gentilini', E'Misurazione:\n• Definire obiettivi chiari con Alessia entro Q2\n• Feedback di Gentilini, Team Leader e Cristiano ≥ 4/5 sulla chiarezza, guida e qualità dell''allineamento', 20, 3);
  END IF;

  -- Francesco Ferrari objectives
  SELECT id INTO v_review_id FROM performance_reviews WHERE user_id = 'c4d0411e-9343-4b37-a407-05281d357a71' AND year = 2026 LIMIT 1;
  IF v_review_id IS NOT NULL THEN
    INSERT INTO performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
    (v_review_id, 'Crescita del portafoglio ActiveCampaign', E'Risultati attesi:\n• Raggiungere 100 contratti attivi (da ~60)\n• Mantenere churn rate sotto il 10%', 25, 1),
    (v_review_id, 'Espansione HubSpot su clienti', E'Risultati attesi:\n• Attivare almeno 5 nuovi clienti HubSpot\n• Contribuire a generare pipeline commerciale HS con almeno 10 opportunità qualificate', 30, 2),
    (v_review_id, 'Revenue e profittabilità dell''area Automation', E'Risultati attesi:\n• Incrementare la revenue di area del 20% vs 2025\n• Raggiungere margine di area positivo (≥25%)\n• Garantire progetti entro budget (max 10% sforamento medio)\n• Integrare componenti AI in almeno il 30% dei progetti automation', 35, 3),
    (v_review_id, 'Governance HubSpot aziendale', E'Risultati attesi:\n• Dati puliti: 0 duplicati, campi obbligatori compilati al 95%\n• Adoption team: 100% del team usa HS secondo processo definito\n• Processi documentati e aggiornati', 10, 4);
  END IF;

  -- Deborah Graziani objectives
  SELECT id INTO v_review_id FROM performance_reviews WHERE user_id = '626d0846-1966-4336-ad80-df6b330933da' AND year = 2026 LIMIT 1;
  IF v_review_id IS NOT NULL THEN
    INSERT INTO performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
    (v_review_id, 'Diventare una voce creativa riconosciuta nel team', E'Risultati attesi:\n• Proporre almeno 1 idea creativa originale al mese\n• Portare almeno 2 proposte all''anno al cliente in prima persona\n• Ottenere almeno 1 progetto "pilota" creativo assegnato e gestito in autonomia', 30, 1),
    (v_review_id, 'Padroneggiare dati e benchmark come base del lavoro content', E'Risultati attesi:\n• Costruire e mantenere mappa competitor per ogni cliente gestito\n• Definire benchmark di performance su ogni progetto social\n• Includere analisi dati nei report mensili con insight actionable', 25, 2),
    (v_review_id, 'Sviluppare competenze tecniche complementari', E'Risultati attesi:\n• Completare almeno 1 percorso formativo su analytics/tool tecnici\n• Saper produrre autonomamente un report di performance (primo report autonomo entro Q2)\n• Integrare almeno 1 tool AI nel workflow quotidiano\n• Partecipare allo sviluppo di analisi e costruzione di strategie', 30, 3),
    (v_review_id, 'Rafforzare presenza e comunicazione nel team', E'Risultati attesi:\n• Esprimere un punto di vista in ogni brainstorming/meeting creativo\n• Difendere almeno 2 volte una propria posizione creativa con argomentazioni strutturate\n• Chiedere proattivamente supporto/confronto quando bloccata', 15, 4);
  END IF;

  -- Beatrice Mazza objectives
  SELECT id INTO v_review_id FROM performance_reviews WHERE user_id = '243e4613-edac-4afb-9af7-8ee6f6278fd0' AND year = 2026 LIMIT 1;
  IF v_review_id IS NOT NULL THEN
    INSERT INTO performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
    (v_review_id, 'Consolidare la visione e il posizionamento della unit Branding', E'Risultati chiave:\n• Formalizzare la "bibbia" del branding/creatività Larin - documento completato entro Q1 e usata in almeno 2 kick off nel Q2\n• Costruire track record: almeno 3 casi studio completi da portfolio/premio entro Q3', 30, 1),
    (v_review_id, 'Prodottizzare l''offerta branding/creatività per aumentare marginalità', E'Risultati chiave:\n• 100% dell''offerta mappata con template e pricing entro Q2\n• Almeno 80% dei progetti branding chiude entro il budget previsto\n• Contributo al fatturato area: target +35% sul 2025', 35, 2),
    (v_review_id, 'Rafforzare la qualità media dei deliverable', E'Risultati chiave:\n• Almeno 50% dei progetti branding/creatività pubblicato nel portfolio/sito\n• Partecipazione ad almeno 1 premio di settore (almeno una candidatura)\n• Almeno 70% delle proposte creative approvate senza rework sostanziali', 25, 3),
    (v_review_id, 'Leadership e trasferimento cultura Larin', E'Risultati chiave:\n• Onboarding efficace delle nuove figure nel team Marketing - completato entro Q2\n• Piano di crescita per Alessia con milestone chiare - piano definito entro Q1\n• Delegare progressivamente la gestione operativa per concentrarsi su direzione creativa', 10, 4);
  END IF;

  -- Stefano Michelis objectives
  SELECT id INTO v_review_id FROM performance_reviews WHERE user_id = '7f687dd2-e685-4447-913f-82abc3befeb6' AND year = 2026 LIMIT 1;
  IF v_review_id IS NOT NULL THEN
    INSERT INTO performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
    (v_review_id, 'Strutturare un approccio analitico e data-informed', E'Risultati attesi:\n• Costruire e mantenere dashboard standard per tutti i clienti attivi\n• Definire benchmark interni per settore/tipologia campagna (aggiornati trimestralmente)\n• Presentare analisi strutturate (CPM → CTR → CR → risultati) in ogni proposta e review', 35, 1),
    (v_review_id, 'Consolidare la struttura Performance all''interno della Unit Marketing', E'Risultati attesi:\n• Processo standard di gestione campagne documentato e validato entro Q1\n• Integrare i flussi performance con la marketing automation\n• Almeno 2 offerte "prodottizzate" entro Q2\n• Proporre almeno 1 iniziativa/mese di attivazione clienti o miglioramento processi', 35, 2),
    (v_review_id, 'Esplorare e testare nuove piattaforme e approcci adv', E'Risultati attesi:\n• Testare almeno 2 nuove piattaforme o formati adv nell''anno\n• Proporre almeno 1 approccio innovativo per cliente strategico\n• Documentare e condividere internamente learnings - playbook con primi contenuti entro Q2', 10, 3),
    (v_review_id, 'Garantire risultati misurabili sulle campagne gestite', E'Risultati attesi:\n• Raggiungere o superare i KPI concordati su almeno l''85% delle campagne\n• Mantenere costo per risultato in linea o migliore vs benchmark\n• Zero errori critici di setup o gestione budget', 20, 4);
  END IF;

  -- Lorenzo Rossi objectives
  SELECT id INTO v_review_id FROM performance_reviews WHERE user_id = '864771ae-c99e-436e-87ba-b336bdd04a71' AND year = 2026 LIMIT 1;
  IF v_review_id IS NOT NULL THEN
    INSERT INTO performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
    (v_review_id, 'Definire e consolidare il metodo content Larin', E'Risultati attesi:\n• Formalizzare il "metodo content Larin" in un documento operativo condiviso - approvato entro fine Q1\n• Applicare il metodo su almeno 5 progetti con output misurabili\n• Costruire libreria di 10 asset riutilizzabili + integrazione Notion nella gestione CED entro Q2', 45, 1),
    (v_review_id, 'Integrare il content con Automation, AI e Performance', E'Risultati attesi:\n• Mappare almeno 3 casi d''uso content + automation da proporre ai clienti\n• Almeno 2 progetti cross-area avviati\n• Almeno 3 preventivi new business approvati con contributo content', 20, 2),
    (v_review_id, 'Generare opportunità commerciali', E'Risultati attesi:\n• 6 casi studio content formalizzati\n• 4 opportunità di upsell/cross-sell segnalate al Sales\n• Almeno 4 sessioni di knowledge sharing (learning friday) interne su temi content', 35, 3);
  END IF;
END $$;

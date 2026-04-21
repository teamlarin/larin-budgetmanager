
-- ============================================
-- PERFORMANCE PROFILES (upsert per user_id)
-- ============================================

-- Daniele Cazzato
INSERT INTO public.performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support)
VALUES ('2f31e355-3faf-456d-b9d4-955d95ed8831', 'Developer & Helpdesk', 'Tech', 'Irene Pegolo', '2023-01-01', 'Partita IVA', '900€/mese (18€/h per 50h) - Budget formazione: 600€', 'gennaio 2026: aumento compenso, aumento ore', NULL, NULL, NULL)
ON CONFLICT (user_id) DO UPDATE SET job_title=EXCLUDED.job_title, team=EXCLUDED.team, team_leader_name=EXCLUDED.team_leader_name, start_date=EXCLUDED.start_date, contract_type=EXCLUDED.contract_type, compensation=EXCLUDED.compensation, contract_history=EXCLUDED.contract_history, updated_at=now();

-- Giorgio Maria Sacchi
INSERT INTO public.performance_profiles (user_id, job_title, team, team_leader_name, contract_type, compensation)
VALUES ('e7116a8e-9926-465d-b5a6-25c9fac0409a', 'Full Stack Developer', 'Tech', 'Irene Pegolo', 'Partita IVA', 'RAL 36.000€ (3.000€/mese)')
ON CONFLICT (user_id) DO UPDATE SET job_title=EXCLUDED.job_title, team=EXCLUDED.team, team_leader_name=EXCLUDED.team_leader_name, contract_type=EXCLUDED.contract_type, compensation=EXCLUDED.compensation, updated_at=now();

-- Federico Bagato
INSERT INTO public.performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history)
VALUES ('056394d0-7226-4dfa-adac-85ee8a776f30', 'Full Stack Developer', 'Tech', 'Irene Pegolo', '2019-03-19', 'Indeterminato (società Mostaza)', 'RAL 40.217€ - Livello B3 - Ticket 6€/giorno - Budget formazione 600€ - Welfare 200€ metalmeccanica', 'gennaio 2026: passaggio a partita IVA')
ON CONFLICT (user_id) DO UPDATE SET job_title=EXCLUDED.job_title, team=EXCLUDED.team, team_leader_name=EXCLUDED.team_leader_name, start_date=EXCLUDED.start_date, contract_type=EXCLUDED.contract_type, compensation=EXCLUDED.compensation, contract_history=EXCLUDED.contract_history, updated_at=now();

-- Ennio Cecco
INSERT INTO public.performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation)
VALUES ('b6803cba-2903-4da8-9de5-197b123cb51b', 'Full Stack Developer', 'Tech', 'Irene Pegolo', '2025-10-01', 'Partita IVA', 'RAL 30.000€ (2.500€ * 80h/mese)')
ON CONFLICT (user_id) DO UPDATE SET job_title=EXCLUDED.job_title, team=EXCLUDED.team, team_leader_name=EXCLUDED.team_leader_name, start_date=EXCLUDED.start_date, contract_type=EXCLUDED.contract_type, compensation=EXCLUDED.compensation, updated_at=now();

-- Irene Pegolo
INSERT INTO public.performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support)
VALUES (
  '47c50923-1968-42e1-af6b-f8e942dab9da',
  'Team Leader Tech', 'Tech', 'Alberto Nalin', '2023-06-26',
  'CCNL Commercio - Livello 3',
  'RAL 27.906€ - Buoni pasto 6€/giorno - Budget formazione 600€ - Bonus 2025: 1.650€ (fringe benefit + bonus)',
  '01/01/2026 - passaggio livello',
  'Attestarti e rafforzarti nel ruolo di Team Leader Tech, con piena responsabilità su strategia, metodo, team e risultati economici dell''area. Non più solo coordinamento operativo, ma ownership completa: dalla definizione dell''offerta alla crescita delle persone, dalla qualità del delivery alla marginalità dei progetti.',
  'Guidare un''area Tech strutturata, profittevole e riconoscibile sul mercato. Un''area che abbia un metodo proprio, prodotti vendibili, persone che crescono e risultati economici solidi. Un''area che contribuisca attivamente alla strategia di Larin, non solo all''esecuzione. Ti chiediamo di fare un salto: passare dalla gestione perfetta dei task alla costruzione di qualcosa di più grande, portando le tue capacità organizzative al servizio della crescita di tutta Larin.',
  'Ti affianchiamo con un percorso formativo mirato (Design Management, Talent Garden) per consolidare le competenze di leadership e gestione delle persone. Attiviamo una routine di confronto più frequente con la direzione per allinearti sulle dinamiche aziendali e coinvolgerti nelle decisioni strategiche.'
)
ON CONFLICT (user_id) DO UPDATE SET job_title=EXCLUDED.job_title, team=EXCLUDED.team, team_leader_name=EXCLUDED.team_leader_name, start_date=EXCLUDED.start_date, contract_type=EXCLUDED.contract_type, compensation=EXCLUDED.compensation, contract_history=EXCLUDED.contract_history, career_target_role=EXCLUDED.career_target_role, career_long_term_goal=EXCLUDED.career_long_term_goal, company_support=EXCLUDED.company_support, updated_at=now();

-- Elena Susana
INSERT INTO public.performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support)
VALUES (
  'e4cc923f-a433-4ad5-ae7d-4a7656bcb2b3',
  'Account Manager', 'Sales', 'Alberto Nalin', '2023-06-01',
  'Apprendistato - CCNL Commercio - Livello 5',
  'RAL 23.373€ - Buoni pasto 6€/giorno - Budget formazione 600€ - Bonus 2025: 250€ / 1.008,77€',
  'marzo 2025 - aumento RAL',
  'Account Manager, con una consapevolezza completa della posizione e dei task previsti.',
  'Portarti a una completa padronanza di quello che è previsto dalla mansione.',
  'Ottimizza le ore di coaching insieme, andando a definire un percorso di potenziamento delle tue aree di miglioramento e di valorizzazione dei tuoi punti di forza.'
)
ON CONFLICT (user_id) DO UPDATE SET job_title=EXCLUDED.job_title, team=EXCLUDED.team, team_leader_name=EXCLUDED.team_leader_name, start_date=EXCLUDED.start_date, contract_type=EXCLUDED.contract_type, compensation=EXCLUDED.compensation, contract_history=EXCLUDED.contract_history, career_target_role=EXCLUDED.career_target_role, career_long_term_goal=EXCLUDED.career_long_term_goal, company_support=EXCLUDED.company_support, updated_at=now();

-- Sofia Baudino
INSERT INTO public.performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support)
VALUES (
  '1833561e-698c-4427-8691-efce0b16704d',
  'Account Manager', 'Sales', 'Alberto Nalin', '2020-11-09',
  'Indeterminato - CCNL Metalmeccanico - Livello D2',
  'RAL 25.826€ - Buoni pasto 6€/giorno - Budget formazione 600€ - Bonus/Variabile 2025: 400€ / 3.904,50€ (provv)',
  E'giugno 2025 - aumento RAL\nfebbraio 2025 - aumento RAL\ndicembre 2024 - aumento RAL\ngiugno 2024 - aumento RAL',
  'Senior Account Manager / Client Success Lead con progressiva evoluzione verso una posizione di Account Director e coordinamento di un team commerciale. Questo significa: passare dalla gestione operativa di singoli progetti alla gestione strategica di portafogli clienti, evolvere da una logica di "preventivi puntuali" a una di gestione del budget marketing complessivo, consolidare un ruolo di braccio destro della direzione commerciale, con autonomia decisionale sulle strategie account e pricing complesso.',
  'Diventare il punto di riferimento per la gestione e crescita del portafoglio clienti strategici di Larin, garantendo: retention al 95%, crescita media del fatturato per cliente anno su anno, presidio di trattative complesse, costruzione di un team account ad alta performance.',
  E'• Affiancamento diretto CEO su trattative strategiche, grandi clienti e situazioni complesse, con l''obiettivo di trasferirti metodo, posizionamento e capacità di gestione di interlocutori C-level\n• Progressivo passaggio di clienti chiave dal portfolio attuale\n• Strumenti e processi evoluti: HubSpot ottimizzato, reportistica avanzata, playbook interni\n• Opportunità di rappresentanza esterna: eventi di settore, talk, networking strategico'
)
ON CONFLICT (user_id) DO UPDATE SET job_title=EXCLUDED.job_title, team=EXCLUDED.team, team_leader_name=EXCLUDED.team_leader_name, start_date=EXCLUDED.start_date, contract_type=EXCLUDED.contract_type, compensation=EXCLUDED.compensation, contract_history=EXCLUDED.contract_history, career_target_role=EXCLUDED.career_target_role, career_long_term_goal=EXCLUDED.career_long_term_goal, company_support=EXCLUDED.company_support, updated_at=now();

-- Cristiano Maretti
INSERT INTO public.performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support)
VALUES (
  '409de83f-7d90-486c-a02c-41de9c6437f8',
  'Marketing Specialist', 'Marketing', 'Alberto Nalin a.i.', '2022-09-01',
  'CCNL Commercio - Livello 3',
  'RAL 29.474€ - Buoni pasto 6€/giorno - Budget formazione 600€ - Fringe benefit 2025: 1.000€',
  '01/10/2025 - aumento RAL',
  'Manager della "micro-azienda" AI all''interno di Larin, con piena ownership su visione strategica, go-to-market, costruzione del team e risultati economici dell''area.',
  E'Fare di Jarvis una realtà strutturata e pervasiva: non un dipartimento separato, ma un moltiplicatore che contamina e potenzia tutte le unit Larin.\n\nTu non sei "quello dell''AI", sei un marketer con un esoscheletro tecnologico avanzato, che porta visione e metodo per integrare intelligenza artificiale nel nostro modo di lavorare e nell''offerta ai clienti. Non un operativo che esegue prompt, ma un professionista che definisce direzione, costruisce processi, forma il team e rappresenta Larin sul mercato come Creative Intelligence Platform.',
  E'Ti darà autonomia operativa e strategica su Jarvis, in coordinamento con il CEO, con budget dedicato per formazione, sperimentazione e costruzione del team.\n\nLavoreremo attivamente per creare le condizioni di contaminazione strutturata tra Marketing e Tech: non lasciamo solo a te il compito.\n\nAvrai supporto diretto da leadership per sbloccare situazioni complesse, aprire porte commerciali e rappresentare Jarvis verso clienti strategici.\n\nSiamo disposti ad investire su formazione specifica (tecnica e manageriale) che ti serve per fare il salto da individual contributor a leader di una business unit.'
)
ON CONFLICT (user_id) DO UPDATE SET job_title=EXCLUDED.job_title, team=EXCLUDED.team, team_leader_name=EXCLUDED.team_leader_name, start_date=EXCLUDED.start_date, contract_type=EXCLUDED.contract_type, compensation=EXCLUDED.compensation, contract_history=EXCLUDED.contract_history, career_target_role=EXCLUDED.career_target_role, career_long_term_goal=EXCLUDED.career_long_term_goal, company_support=EXCLUDED.company_support, updated_at=now();


-- ============================================
-- PERFORMANCE REVIEWS 2026 + OBJECTIVES + Q1 NOTES
-- ============================================

DO $$
DECLARE
  v_review_id uuid;
BEGIN

-- ====== DANIELE CAZZATO ======
INSERT INTO public.performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  '2f31e355-3faf-456d-b9d4-955d95ed8831', 2026, 'Q4 2025',
  E'• Gestione autonoma e affidabile dei ticket, gentilezza riscontrata da più clienti e velocità nella gestione delle richieste\n• Serietà e impegno, approccio molto collaborativo con il team',
  E'• Rafforzare le fondamenta tecniche per arrivare a gestire autonomamente piccoli progetti di sviluppo'
) RETURNING id INTO v_review_id;

INSERT INTO public.performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
(v_review_id, 'Crescita verso autonomia nello sviluppo di piccoli-medi progetti web', 'KPI: 2 progetti nel 2026 come dev, oltre attività esistenti di inserimento contenuti, subordinato all''ingresso di nuovi clienti', 0, 1),
(v_review_id, 'Ottimizzazione della gestione dei ticket e dell''assistenza', 'KPI: ridurre i tempi di risoluzione del 30%, continuando a documentare gli interventi e mantenere una comunicazione efficiente con i clienti', 0, 2);

INSERT INTO public.performance_quarterly_notes (review_id, quarter, notes) VALUES
(v_review_id, 'Q1', E'Trimestre sfidante ma bello e motivante. ABCortina progetto completato molto motivante, anche 3cime (qui inizialmente cose che non conosceva molto da integrare nel sito, inizialmente dubbi poi si è fatto tutto e ha avuto feedback positivo dalla cliente).\n\nLato ticket tutto regolare. Progetto più difficile e intenso: adico per gestione della relazione con Mariuccia (persona difficile). Carico di lavoro ok, il fatto di avere ore in più da aprile per supporto ad altri progetti è step-up che gli ha fatto piacere, riconferma del suo valore, contento quindi dell''aumento ore.\n\nGià primo obiettivo raggiunto - azione da intraprendere: gestire anche altri progetti piccoli di sviluppo per rafforzare sempre di più le fondamenta tecniche nello sviluppo.');

-- ====== GIORGIO MARIA SACCHI ======
INSERT INTO public.performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  'e7116a8e-9926-465d-b5a6-25c9fac0409a', 2026, 'Q4 2025',
  E'• Qualità tecnica dei deliverables\n• Alta autonomia operativa',
  E'• Proattività nella ricerca di soluzioni alternative, aprendosi alla possibilità di ricercare / provare cose diverse'
) RETURNING id INTO v_review_id;

INSERT INTO public.performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
(v_review_id, 'Assumere pieno ruolo attivo di Project Leader su progetti web medio-grandi', 'KPI: gestione di 3 progetti web dall''analisi alla consegna come PL coordinando membri del team', 0, 1);

INSERT INTO public.performance_quarterly_notes (review_id, quarter, notes) VALUES
(v_review_id, 'Q1', E'Molto disponibile a fare il meglio possibile, completa disponibilità su richiesta nostra - ultimamente nel Q1 complicanza data da Latemar che ha alterato la "routine" ma attività procedono bene, non grandi cambiamenti da dicembre.\n\nCarico di lavoro ok, un po'' più scarico da questa settimana, quasi "in difetto". Rispetto agli obiettivi: gestione di MotorK, Bortoluzzi, altri in pipe.\n\nAzione concreta: orientarsi meglio lato AI e continuare a sperimentare tanto l''AI per il web (utile avere "carta bianca" su questo) per arrivare a proposta implementativa su più ampia scala.');

-- ====== FEDERICO BAGATO ======
INSERT INTO public.performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  '056394d0-7226-4dfa-adac-85ee8a776f30', 2026, 'Q4 2025',
  E'• Competenze tecniche (hard skills lato sviluppo), sei il punto di riferimento tecnico per il team e per me\n• Autonomia nello svolgimento dei progetti / task: data la tua seniority sai tranquillamente gestire altre figure junior e coordinare il loro lavoro (es amuseapp)',
  E'• Reattività lato comunicazioni email -> a volte alcune mail restano senza risposta per del tempo, perché richiedono di slottare del lavoro e metterci la testa per poter dare una risposta sensata. Proviamo a inserire risposte "placeholder" tipo "Prendiamo in carico e diamo riscontro a breve" per non far sentire il cliente "abbandonato".'
) RETURNING id INTO v_review_id;

INSERT INTO public.performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
(v_review_id, 'Ruolo attivo da PL: coordinamento tecnico dei progetti complessi', 'Prendere ownership della comunicazione come PL con clienti chiave diventando loro riferimento stabile. KPI: 2 progetti corporate [Nims, Thelios] nel 2026, subordinato a ingresso di nuovi clienti/progetti', 0, 1),
(v_review_id, 'Consolidamento delle capacità AI e loro integrazione nei progetti', 'KPI: guidare 1 iniziativa interna per aumentare la maturità AI dell''azienda, che prevede la progettazione entro il Q2 e l''implementazione entro il Q4', 0, 2),
(v_review_id, 'DevOps / ottimizzazione dei processi di sviluppo', 'KPI: definizione standard tecnici entro il Q2, implementarli entro il Q4', 0, 3);

INSERT INTO public.performance_quarterly_notes (review_id, quarter, notes) VALUES
(v_review_id, 'Q1', E'Tanta sperimentazione AI e carne al fuoco, 3 prodotti aziendali (mail AI, chatbot, OCR per estrazione dati) che segue e che usano AI.\n\nSarebbe bello poter fare più sperimentazione e meno "operatività" sui progetti vecchi - calibrare extra-effort. Carico non fuori controllo per ora, ma Med resta spina nel fianco (aiuto di Sofia come account può migliorare, come ha fatto per Sades).\n\nTracciamento ore a volte difficoltoso, perché si passa da un messaggio all''altro, si fa avanti e indietro tra progetti e non ci sono più blocchi di ore in cui fare full focus solo su una cosa.\n\nAzione concreta: riportare in primo piano tema documentazione e standard tecnici da condividere con gli altri.');

-- ====== ENNIO CECCO ======
INSERT INTO public.performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  'b6803cba-2903-4da8-9de5-197b123cb51b', 2026, 'Q4 2025',
  E'• Autonomia tecnica e capacità di gestire in sicurezza lo sviluppo di app\n• Capacità di adattarsi rapidamente ai progetti e al modo di lavorare dell''agenzia',
  E'• Gestione delle scadenze / coordinamento -> capire disponibilità a gestire picchi di lavoro come potrebbe succedere in dicembre (es. comunicare subito ritardi anche dovuti ad esigenze personali)\n• Documentare maggiormente soluzioni e decisioni tecniche -> definiamo gli standard di documentazione che ci aspettiamo nei progetti tech e lavoriamo per mantenerle sempre aggiornate'
) RETURNING id INTO v_review_id;

INSERT INTO public.performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
(v_review_id, 'Aumento dell''autonomia ed efficienza tecnica', 'KPI: rispetto della timeline di delivery prevista del 90%', 0, 1),
(v_review_id, 'Aumento dell''affidabilità e qualità nella delivery dei progetti tech', 'KPI: rispetto a tempi di turnaround delle features, diminuire del 50% il numero di revisioni / iterazioni', 0, 2);

INSERT INTO public.performance_quarterly_notes (review_id, quarter, notes) VALUES
(v_review_id, 'Q1', E'Momenti di scarico e momenti iper-carico che si sono alternati - da bilanciare. Trovato modo di adattarsi bene al nostro modo di lavorare, anche gestire il cliente (es Sades) in cui c''è stato lavoro più a tutto tondo gestito da lui. Piace anche molto il lavoro di squadra con clienti corporate, in cui non ha la comunicazione diretta e può concentrarsi di più sullo sviluppo.\n\nNon buona esperienza con eurostandard - forzatura di usare Elementor, che ha comportato una questione di immagine con il cliente - dovrebbe essere mantenuta alta sempre rispetto alla qualità del lavoro. Progetti interessanti, anche nel risistemare progetti altrui (es. Paolo). Più soddisfacenti quelli in cui ha fatto tutto da zero, con carta bianca da Fede.\n\nAzioni concrete: aggiornare con maggiore frequenza Irene sui progetti senza richiesta diretta, proattività.');

-- ====== IRENE PEGOLO ======
INSERT INTO public.performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  '47c50923-1968-42e1-af6b-f8e942dab9da', 2026, 'Q4 2025',
  E'• Affidabilità e responsabilità. Ti assumi l''ownership di ciò che fai e di ciò che fa il tuo team. Non scarichi, presidi.\n• Pianificazione. Metodica, organizzata, capace di strutturare progetti e gestirne l''avanzamento con precisione.\n• Problem solving. Di fronte ai problemi tendi ad agire, non bloccarti. Hai spirito di iniziativa e propositività.\n• Punto di riferimento. Il team sa di poter contare su di te per la gestione e il coordinamento.',
  E'• Ascolto e apertura. Tendi a centralizzare e a fidarti del tuo metodo. Allenati ad accogliere input e idee degli altri, anche quando divergono dal tuo schema.\n• Gestione del conflitto. Tendi ad evitare lo scontro, questo può portare ad accumulare tensione. Serve imparare a gestire il disallineamento in modo più continuo e diretto.\n• Approccio ai problemi. A volte percepisci i problemi come più grandi di quello che sono. Sviluppare una lettura più equilibrata, distinguendo criticità reali da percezioni amplificate.\n• Motivazione del team. Sei solida sulla parte gestionale ma meno efficace nel "gasare" il team nei momenti pressione. Lavoriamo per crescere sulla leadership motivazionale, non solo organizzativa.'
) RETURNING id INTO v_review_id;

INSERT INTO public.performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
(v_review_id, 'Formalizzare il metodo di gestione progetti Tech',
  E'Risultati chiave:\n• Documentare le 4 fasi del processo (Define, Design, Deliver, Defend) in un framework chiaro e condiviso → Documento completato entro 28/02\n• Costruire la "cassetta degli attrezzi" per il Define: template, checklist, livelli di complessità, criteri workshop → 8 template prodotti e in uso\n• Definire processo di change management (escalation, stop lavori, versioning) → Processo documentato e applicato nel 100% dei progetti Q2\n• Applicare il metodo 4D a tutti i nuovi progetti Tech → 100% dei progetti gestiti così dal Q2',
  35, 1),
(v_review_id, 'Prodottizzare l''offerta software e aumentare il fatturato',
  E'Risultati chiave:\n• Definire pacchetti software "Product Driven" con scope, pricing e materiali commerciali → Almeno 3 prodotti identificati\n• Contribuire attivamente alla vendita con supporto a preventivi e call commerciali → Almeno 3 percorsi di upsell avviati e mappati; criteri chiari di coinvolgimento discovery sales\n• Trasformare i feedback cliente in evoluzioni di processo/prodotto → Almeno 5 miglioramenti implementati da input cliente\n• Gestire direttamente la fase post-delivery (pacchetti assistenza) → 80% clienti hanno pacchetto assistenza attivo (ARR)\n• Aumentare il fatturato dell''area software rispetto al 2025 → +30% crescita fatturato YoY',
  45, 2),
(v_review_id, 'Mantenere eccellenza operativa su Define e post-delivery',
  E'Risultati chiave:\n• Presidiare direttamente la fase Define sui progetti strategici → 80% progetti strategici con Define gestito da Irene\n• Costruire la "memoria storica" dei progetti: cosa ha funzionato, cosa no, come farli funzionare → Repository documentato e aggiornato attivo da Q2\n• Standardizzare i tool del team (Figma, template, checklist) → 5 tool/template diventati standard',
  15, 3),
(v_review_id, 'Evolvere come leader e parte attiva di Larin',
  E'Risultati chiave:\n• Completare percorso Design Management → Certificato ottenuto e trasferimento al team\n• Migliorare la capacità di "umanizzare" la relazione Tech-cliente → Feedback qualitativo positivo (clienti + CEO)\n• Contribuire all''evoluzione del framework Larin (4D come base per tutti) → Proposta di coordinamento cross-team entro Q4\n• Mantenere confronto costante con CEO → Almeno 1 touchpoint mensile',
  5, 4);

-- ====== ELENA SUSANA ======
INSERT INTO public.performance_reviews (user_id, year, compilation_period, compiled_by, strengths, improvement_areas)
VALUES (
  'e4cc923f-a433-4ad5-ae7d-4a7656bcb2b3', 2026, 'Q4 2025', NULL,
  E'• Standing professionale solido. Ti presenti bene davanti al cliente, hai una buona dialettica e sai posizionarti come professionista. Questo è un asset importante per il ruolo.\n• Comprensione delle dinamiche progettuali. Il tuo background da PM ti dà una visione d''insieme sui progetti e ti aiuta a capire le complessità operative, elemento che ti distingue da molti account.\n• Capacità relazionali interne. Hai costruito un ottimo rapporto con tutto il team, cosa che facilita enormemente la collaborazione interfunzionale e l''esecuzione dei progetti.',
  E'• Transizione da PM ad Account. Tendi ancora ad agire con mindset operativo/organizzativo (es. Solidarietà Veneto) invece di mantenere il focus sulla vendita e sullo sviluppo del cliente. Il tuo valore ora sta nel far crescere il business, non nel gestire operativamente i progetti.\n• Mancanza di ossessione per la pipeline. Non hai ancora sviluppato quella fame commerciale necessaria per il ruolo. La pipeline deve diventare la tua ossessione quotidiana: nurturing, follow-up, chiusure.\n• Mindset reattivo invece che proattivo sui lead. Valuti la qualità dei lead che ricevi, ma non puoi migliorare l''iniziativa nel conquistarne di nuovi autonomamente. Devi passare da aspettare opportunità a crearle.\n• Rifugio nel linguaggio accademico. A volte ti nascondi dietro un linguaggio eccessivamente formale o accademico, sia scritto che parlato. Nel nostro lavoro serve chiarezza e concretezza, non complessità.'
) RETURNING id INTO v_review_id;

INSERT INTO public.performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
(v_review_id, 'Le tue azioni devono essere guidate da una sola metrica: quanto venduto',
  E'Risultati chiave:\n• Chiudere ogni mese di Q1 tra l''80% e il 100% del target mensile\n• Mantenere una pipeline a 15 giorni dalla chiusura del mese pari ad almeno 3x il target mensile\n• Review mensile della pipeline per identificare blocchi e azioni correttive',
  50, 1),
(v_review_id, 'Costruire un piano chiaro su quale cliente vuoi conquistare e come lo farai tuo',
  E'Risultati chiave:\n• Generare almeno 5 lead qualificate autonome per trimestre (potenziale >€5k ciascuna) attraverso attività di prospecting diretto\n• Partecipare ad almeno 2 eventi di networking per trimestre + follow-up strutturato con almeno il 50% dei contatti\n• Produrre almeno 2 post LinkedIn al mese che generino engagement con prospect in target',
  30, 2),
(v_review_id, 'Passare da "aspettare che il cliente decida" a "guidare il cliente verso la chiusura". Serve avere un piano e creare urgenza',
  E'Risultati chiave:\n• Creare un piano di closing scritto per ogni opportunità >€10k entro 48h dall''apertura, con timeline condivisa col cliente\n• Ridurre il ciclo di vendita medio a massimo 60-90 giorni entro Q2\n• Utilizzare coaching settimanale con Max per review trattative critiche e identificazione blocchi',
  20, 3);

-- ====== SOFIA BAUDINO ======
INSERT INTO public.performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  '1833561e-698c-4427-8691-efce0b16704d', 2026, 'Q4 2025',
  E'• Client management: sei in grado di seguire un cliente, pianificare le attività di progetto e gestire eventuali richieste o aggiunte/modifiche progettuali.\n• Conoscenza profonda dell''azienda e affidabilità. Con l''esperienza maturata, hai sviluppato una comprensione dell''azienda che ti permette di interpretare le dinamiche interne e agire con maggiore impatto. Sei una persona di grande fiducia, su cui l''azienda può contare per continuità e solidità nel tempo.\n• Apertura al confronto e alla crescita. Dimostri disponibilità a metterti in gioco, a trovare punti di incontro tra esigenze aziendali e personali, e ad affrontare sfide nuove. Hai la capacità di riconoscere apertamente i tuoi bisogni di crescita e di cercare attivamente confronto e chiarezza sul percorso futuro.\n• Pragmatismo e orientamento all''esecuzione. Hai un approccio concreto e orientato ai risultati. Lo si vede nella gestione dei fondimpresa, nella capacità di "lavorare su liste in modo concentrato", nel chiudere opportunità in modo efficace. Sai passare dal pensiero all''azione.\n• Ownership e senso di appartenenza all''azienda. Come hai detto tu stessa: "ogni cosa che faccio, sento che la faccio mia, e questo mi rende il lavoro più semplice".',
  E'• Leadership nella risoluzione dei problemi. Il prossimo step richiede che tu passi da "segnalare problemi" a "creare le condizioni per risolverli". Quando emerge una criticità, l''aspettativa è che tu non solo la identifichi ma proponga attivamente soluzioni operative, prenda ownership e guidi il cambiamento necessario.\n• Atteggiamento "macchina" e zero margine di esitazione. In questa fase di crescita è fondamentale che tu elimini ogni forma di esitazione. Serve un atteggiamento deciso, strutturato, "macchina": qualunque sia la strada scelta (hunter/farmer), deve essere percorsa con convinzione totale, velocità, e senza incertezze.\n• Ossessione per la pipeline e sistematicità. È importante sviluppare una maggiore costanza e disciplina nella gestione quotidiana della pipeline. La pipeline deve essere il primo pensiero dopo la colazione, lo strumento che guida ogni decisione e priorità.\n• Capacità di mentoring e guida del team. Per completare l''evoluzione verso un ruolo senior, dovrai sviluppare la capacità di affiancare, guidare e fare da esempio a figure junior (es. SDR/BDR futuri).'
) RETURNING id INTO v_review_id;

INSERT INTO public.performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
(v_review_id, 'Consolidare e far crescere il portafoglio clienti',
  E'Passare da logica reattiva/emergenziale a gestione strutturata del portafoglio, facendo crescere il valore dei clienti esistenti e riattivando opportunità dormienti.\n\nRisultati chiave:\n• Riattivare almeno €12k di business da clienti dormienti (ultimo anno senza spesa)\n• Convertire e mappare almeno 2 clienti da "preventivo spot" a "budget marketing gestito" (retainer o accordo quadro semestrale/annuale)\n• Incrementare fatturato medio per cliente attivo del 25% vs H2 2025',
  0, 1),
(v_review_id, 'Padroneggiare la pipeline come strumento quotidiano di gestione e crescita',
  E'La pipeline è lo strumento che misura la tua seniority e ti dà controllo sul business. Deve diventare un''ossessione quotidiana, non un task saltuario.\n\nRisultati chiave:\n• Aggiornare HubSpot pipeline con 100% accuratezza ogni giovedì entro le 18:00 (verificato in meeting venerdì)\n• Mantenere una pipeline "healthy" di almeno 3x il target trimestrale in ogni momento (€150k+ di opportunità attive)\n• Chiudere almeno 3 progetti finanziati tramite fondi impresa/bandi per €30k+ totali\n• Ridurre il tempo medio di chiusura deal del 20% rispetto a H2 2025',
  0, 2),
(v_review_id, 'Strutturare il ruolo per impatto strategico e ridurre l''approccio emergenziale',
  E'Evolvere da operatività tattica a gestione strategica, creando spazio per attività ad alto valore che fanno crescere te e il business.\n\nRisultati chiave:\n• Pianificare e proteggere 2h/settimana per attività strategiche (studio clienti, proposte proattive, iniziative come revisione siti web), comunicato in coaching\n• Proporre attivamente almeno 1 iniziativa strategica/mese ai top 5 clienti del portafoglio (non reattiva a loro richiesta)\n• Completare almeno 1 trattativa complessa (>€35k single deal) con gestione autonoma end-to-end entro Q3\n• Creare documentazione/playbook personale per gestione clienti (onboarding, quarterly review, upselling standard). Playbook completato e condiviso entro fine Q1',
  0, 3);

-- ====== CRISTIANO MARETTI ======
INSERT INTO public.performance_reviews (user_id, year, compilation_period, strengths, improvement_areas)
VALUES (
  '409de83f-7d90-486c-a02c-41de9c6437f8', 2026, 'Q4 2025',
  E'• Autodisciplina e affidabilità. Quando ti prendi un impegno, lo porti a termine. Mantieni l''asticella alta sulla qualità del lavoro e questo è un punto di forza raro e prezioso.\n• Creatività e pensiero laterale. Hai una capacità naturale di generare idee e vedere possibilità che altri non vedono. Quando ti lasci andare, oltre la resistenza iniziale, diventi un moltiplicatore di soluzioni.\n• Visione ibrida marketer-tecnologia. La tua capacità di integrare competenze marketing con padronanza degli strumenti AI è un asset distintivo. Non sei un "AI enthusiast" fine a se stesso: sei un marketer che usa le tecnologie migliori per ottenere risultati.\n• Umiltà e voglia di apprendere. Non ti accontenti di quello che sai. Cerchi continuamente di approfondire, formarti, capire. Questa curiosità intellettuale è una base solida per costruire expertise verticale.',
  E'• Comunicazione e gestione delle relazioni. Fatica nella gestione dei rapporti interpersonali, soprattutto con fornitori esterni e collaboratori. La tendenza a reagire con frustrazione quando le cose non vengono fatte "come dovrebbero" genera attriti evitabili.\n• Pianificazione del percorso. Sei affidabile nella delivery, meno nella pianificazione del percorso per arrivarci. Difficoltà a strutturare una roadmap chiara e a mantenerla nel tempo. Rischi di navigare a vista invece che governare la traiettoria.\n• Resistenza iniziale al cambiamento. Tendenza a un "brontolio" iniziale di fronte a nuove sfide o provocazioni. Una volta ingaggiato vai forte, ma quella fase preliminare va accorciata se vuoi avere un ruolo di leadership.\n• Empatia e ascolto attivo. Difficoltà a metterti nei panni dell''altro quando le aspettative non sono allineate. Serve lavorare sulla capacità di comprendere le ragioni altrui prima di reagire.'
) RETURNING id INTO v_review_id;

INSERT INTO public.performance_objectives (review_id, title, description, bonus_percentage, sort_order) VALUES
(v_review_id, 'Costruire le fondamenta della "micro-azienda" Jarvis',
  E'Risultati chiave:\n• Rendere autonoma l''area "strategy" nel Team Marketing (template, processi, tool ecc) → Q1\n• Formalizzare vision, posizionamento e metodo operativo Jarvis in documento strutturato ("bibbia Jarvis") da usare per onboarding team e sales → Documento completato entro Q1 2026\n• Mappare offerta 2026: servizi/prodotti con template, tempi standard, pricing di riferimento → 100% offerta mappata entro Q2\n• Definire go-to-market: target clienti, value proposition, materiali sales → Sales materials pronti entro Q2',
  20, 1),
(v_review_id, 'Rendere l''AI pervasiva in Larin',
  E'Risultati chiave:\n• Formare unit aziendali su utilizzo AI tools per productivity (con metriche di adozione) → 80% adoption rate\n• Creare processi strutturati di contaminazione Tech-Marketing per condivisione conoscenza → Almeno 2 progetti integrati Tech-Jarvis nel 2026\n• Documentare best practices interne: libreria use cases, prompt templates, workflow AI → Libreria attiva entro Q1 con almeno 10 use cases documentati, 25 entro Q2',
  30, 2),
(v_review_id, 'Costruire track record e contribuire al fatturato',
  E'Risultati chiave:\n• Almeno 4 casi studio completi e documentati da portfolio/sales\n• Contributo diretto al fatturato area Jarvis → Target: +50% rispetto al 2025 (da definire baseline)\n• Posizionamento esterno Jarvis: almeno 4 contributi thought leadership',
  35, 3),
(v_review_id, 'Pianificazione e delega',
  E'Risultati chiave:\n• Mantenere roadmap Jarvis aggiornata con milestone trimestrali e condivisa con leadership → Review trimestrale della roadmap con zero ritardi nella comunicazione\n• Delegare progressivamente attività operative a basso valore\n• Migliorare gestione relazioni: zero escalation critiche su comunicazione con fornitori/collaboratori → Zero escalation nel 2026',
  15, 4);

END $$;

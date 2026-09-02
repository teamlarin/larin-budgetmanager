import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BarChart3, FolderKanban, FileText, Briefcase, Calendar, Users, Settings, Workflow, TrendingUp, Award, AlertCircle, Wallet, ListTodo, Receipt } from 'lucide-react';

export function ManualSections() {
  return (
    <>
      <section id="manuale" className="scroll-mt-20 mb-8">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Manuale Dettagliato
        </h2>
        <p className="text-muted-foreground mb-6">Guida approfondita a tutte le funzionalità di TimeTrap.</p>
      </section>

      {/* Dashboard */}
      <section id="man-dashboard" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Dashboard</CardTitle>
            <CardDescription>La tua panoramica personalizzata su progetti, budget e team</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="dash-roles">
                <AccordionTrigger>Dashboard per ruolo</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3">
                  <p><strong>Admin Operations:</strong> Panoramica completa dei progetti attivi, ore pianificate vs consuntivate, progetti in scadenza, distribuzione workload del team. Widget dedicato ai progetti vicini alla deadline.</p>
                  <p><strong>Admin Finance:</strong> Focus su margini di profitto, fatturato, costi aggregati. Grafici con trend mensili e alert su progetti con margine critico.</p>
                  <p><strong>Account:</strong> Due tab — "Il mio Recap" con i propri progetti e attività, "Budget & Quote" con riepilogo budget e preventivi gestiti. Nessun filtro data globale per una vista più pulita.</p>
                  <p><strong>Team Leader:</strong> Vista del proprio team con ore pianificate, attività in corso per ogni membro. Dialog per dettaglio attività dei singoli membri.</p>
                  <p><strong>Finance:</strong> Metriche finanziarie: fatturato, margini medi, distribuzione costi. Accesso rapido ai preventivi.</p>
                  <p><strong>Member:</strong> "Il mio Recap" personale con pianificazione settimanale, ore lavorate nel mese, trend produttività, prossime scadenze.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="dash-kpi">
                <AccordionTrigger>KPI e metriche</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Ore pianificate vs consuntivate:</strong> confronto tra ore previste nel budget e ore effettivamente lavorate</li>
                    <li><strong>Margine medio:</strong> percentuale media di profitto su tutti i progetti attivi</li>
                    <li><strong>Progetti a rischio:</strong> progetti che superano le soglie di warning o critical</li>
                    <li><strong>Produttività:</strong> rapporto tra ore fatturabili e ore contrattuali</li>
                    <li><strong>Fatturato previsto:</strong> somma dei preventivi approvati nel periodo selezionato</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="dash-ai">
                <AccordionTrigger>AI Insights</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Il pannello AI Insights genera analisi on-demand personalizzate in base al tuo ruolo. Clicca su <strong>"Genera Insights"</strong> per ricevere un riepilogo che include:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Analisi dei progetti più critici con suggerimenti</li>
                    <li>Pattern di utilizzo delle risorse</li>
                    <li>Previsioni di sforamento budget</li>
                    <li>Suggerimenti di ottimizzazione</li>
                  </ul>
                  <p>Gli insights vengono memorizzati in <strong>cache locale</strong> per ruolo per evitare chiamate ripetute. Puoi chiuderli con il pulsante "Chiudi".</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="dash-filters">
                <AccordionTrigger>Filtri data</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  <p>I ruoli Admin, Team Leader e Finance possono filtrare i dati della dashboard per intervallo di date. 
                  Usa il selettore in alto a destra per scegliere il periodo: settimana corrente, mese corrente, trimestre, anno, o intervallo personalizzato.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Budget */}
      <section id="man-budget" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FolderKanban className="h-5 w-5 text-primary" />Budget</CardTitle>
            <CardDescription>Pianifica costi, risorse e attività del progetto</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="bud-creation">
                <AccordionTrigger>Creazione budget</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Esistono tre modi per creare un budget:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Manuale:</strong> Crea un budget vuoto e aggiungi categorie e attività una per una</li>
                    <li><strong>Da template:</strong> Seleziona un template predefinito che pre-compila categorie e attività. Puoi personalizzare tutto dopo la creazione</li>
                    <li><strong>Import da progetto esistente:</strong> Importa le attività da un altro progetto come base di partenza</li>
                  </ul>
                  <p className="mt-2"><strong>Campi principali:</strong> Nome, tipo progetto, disciplina, cliente, contatto, account responsabile, descrizione, obiettivo, link brief, cartella Google Drive, <strong>data chiusura attesa</strong>.</p>
                  <p className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
                    <strong className="text-foreground">📅 Data chiusura attesa:</strong> imposta la data prevista di approvazione/conversione del budget. Questo dato alimenta le simulazioni "what-if" sulla pianificazione delle risorse.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="bud-items">
                <AccordionTrigger>Gestione voci del budget</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Ogni budget è organizzato in <strong>categorie</strong> (es. Strategia, Creatività, Sviluppo) e <strong>attività</strong> all'interno di ciascuna categoria.</p>
                  <p>Per ogni attività puoi specificare:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Nome attività</strong></li>
                    <li><strong>Assegnatario:</strong> la risorsa che svolgerà il lavoro</li>
                    <li><strong>Livello/Tariffa oraria:</strong> determina il costo orario</li>
                    <li><strong>Ore previste:</strong> quantità di ore stimate</li>
                    <li><strong>Costo totale:</strong> calcolato automaticamente (ore × tariffa)</li>
                    <li><strong>Aliquota IVA:</strong> personalizzabile per voce</li>
                  </ul>
                  <p>Puoi anche aggiungere <strong>prodotti</strong> a prezzo fisso (es. licenze, hosting) con la spunta "Prodotto".</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="bud-products">
                <AccordionTrigger>Prodotti collegati al budget</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Dal budget puoi selezionare uno o più <strong>prodotti</strong> dal listino allineato a Fatture in Cloud. I prodotti collegati vengono riportati automaticamente nell'offerta generata dal budget.</p>
                  <p>Se applichi un <strong>modello di budget</strong> che ha già prodotti collegati, questi vengono importati insieme alle attività.</p>
                  <p className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
                    <strong className="text-foreground">ℹ️ I Servizi non esistono più:</strong> dal 2026 il catalogo è composto solo da <strong>Prodotti</strong> sincronizzati con Fatture in Cloud. I dati storici dei servizi restano nel database ma non sono più utilizzabili.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="bud-gantt">
                <AccordionTrigger>Gantt chart e timeline</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Nella vista budget è disponibile un <strong>Gantt chart</strong> che visualizza la timeline delle attività. Per ogni attività puoi impostare:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Giorno di inizio (offset):</strong> quanti giorni dopo l'inizio del progetto</li>
                    <li><strong>Durata (giorni):</strong> durata stimata dell'attività</li>
                  </ul>
                  <p>Il Gantt si aggiorna automaticamente e mostra le sovrapposizioni tra attività.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="bud-alerts">
                <AccordionTrigger>Notifiche progressive di budget</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Il sistema invia <strong>alert progressivi</strong> al raggiungimento di soglie di consumo del budget target (= costo operativo, escluse spese esterne):</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>50%</strong> – info: "metà budget consumato"</li>
                    <li><strong>75%</strong> – warning: "tre quarti consumati"</li>
                    <li><strong>90%</strong> – critical: "quasi al limite"</li>
                    <li><strong>100%</strong> – sforamento: "budget superato"</li>
                  </ul>
                  <p>In aggiunta, il sistema calcola la <strong>proiezione a fine progetto</strong> e invia warning quando lo sforamento previsto supera <strong>+10%</strong> e critical oltre <strong>+25%</strong>.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="bud-states">
                <AccordionTrigger>Stati del budget</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>In attesa (bozza):</strong> il budget è in fase di redazione, può essere modificato liberamente</li>
                    <li><strong>Approvato:</strong> il budget è stato approvato e viene creato il progetto corrispondente</li>
                    <li><strong>Rifiutato:</strong> il budget è stato rifiutato dal cliente o internamente</li>
                  </ul>
                  <p className="mt-2">Solo gli utenti con permesso <code>canChangeProjectStatus</code> possono cambiare lo stato.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="bud-dnd">
                <AccordionTrigger>Ordinamento drag-and-drop</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  <p>Le attività all'interno di ogni categoria possono essere riordinate tramite drag-and-drop. 
                  Trascina l'icona ≡ a sinistra di ogni riga per cambiare l'ordine. L'ordine viene salvato automaticamente e si riflette anche nel preventivo generato.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="bud-actions">
                <AccordionTrigger>Azioni budget</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Duplica:</strong> crea una copia completa del budget (utile per varianti)</li>
                    <li><strong>Elimina:</strong> rimuove il budget (solo ruoli con permesso)</li>
                    <li><strong>Import attività:</strong> importa attività da un template o da un altro progetto</li>
                  </ul>
                  <p className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
                    <strong className="text-foreground">🆕 Niente più "Genera preventivo":</strong> ogni budget ha già la sua <strong>offerta in bozza</strong>, con attività e prodotti collegati. Lavora direttamente in <strong>Finanza → Offerte</strong>.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Offerte */}
      <section id="man-offerte" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Offerte</CardTitle>
            <CardDescription>Il documento commerciale unico: sostituisce i vecchi Preventivi</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="off-intro">
                <AccordionTrigger>Dai Preventivi alle Offerte</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>La vecchia sezione <strong>Preventivi</strong> è stata dismessa: tutti i documenti commerciali vivono ora in <strong>Finanza → Offerte</strong>. Ogni budget genera automaticamente un'<strong>offerta in bozza</strong> con attività, prodotti, importi e piano di pagamento.</p>
                  <p>Rispetto ai preventivi, le offerte sono <strong>versionate</strong>, condivisibili con un link pubblico, firmabili dal cliente e collegate a Fatture in Cloud.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="off-header">
                <AccordionTrigger>Titolo e numero offerta</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Il <strong>titolo</strong> viene precompilato dal budget ed è modificabile inline sia in elenco che nel dettaglio.</p>
                  <p>Il <strong>numero</strong> è progressivo automatico ma può essere corretto a mano: il sistema verifica che non esista già un'altra offerta con lo stesso numero.</p>
                  <p>Quando l'offerta viene accettata, il numero viene riportato nel campo <strong>numero preventivo</strong> del progetto collegato.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="off-products">
                <AccordionTrigger>Righe prodotto</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Ogni riga dell'offerta parte sempre da un <strong>prodotto del listino</strong> (con campo di ricerca nel selettore). Da lì puoi personalizzare:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Titolo</strong> della riga (precompilato dal nome prodotto)</li>
                    <li><strong>Descrizione</strong> (precompilata dalla scheda prodotto)</li>
                    <li><strong>Categoria di ricavo</strong>: selezione tra quelle disponibili, di default quella del prodotto</li>
                    <li>Quantità, prezzo, sconto e IVA</li>
                  </ul>
                  <p className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
                    <strong className="text-foreground">📊 Statistiche:</strong> anche se modifichi titolo o descrizione, il riferimento per il cruscotto "prodotti venduti" resta sempre il <strong>prodotto originale</strong> selezionato.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="off-status">
                <AccordionTrigger>Stati ed esito manuale</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Bozza:</strong> generata dal budget, liberamente modificabile</li>
                    <li><strong>Inviata:</strong> condivisa col cliente tramite link pubblico</li>
                    <li><strong>Accettata / Rifiutata:</strong> esito registrato dalla firma online oppure inserito manualmente</li>
                  </ul>
                  <p>Per le offerte firmate fuori dalla piattaforma usa <strong>"Registra esito manuale"</strong>: puoi indicare data e note della decisione senza passare dal link pubblico.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="off-public">
                <AccordionTrigger>Link pubblico, PDF e firma</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Dall'offerta puoi generare un <strong>link pubblico</strong> che mostra al cliente il documento impaginato, scaricabile in PDF, con pulsanti di accettazione o rifiuto.</p>
                  <p>La firma del cliente viene tracciata con data, IP e nominativo, e aggiorna automaticamente lo stato dell'offerta.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="off-automation">
                <AccordionTrigger>Cosa succede quando l'offerta viene accettata</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Viene creato (o aggiornato) il <strong>progetto</strong> collegato</li>
                    <li>Le <strong>attività del budget</strong> vengono copiate nel progetto</li>
                    <li>Viene creata la <strong>cartella Google Drive</strong> con il formato <code>{'{anno}'} | {'{numero offerta}'} - {'{nome progetto}'}</code></li>
                    <li>Il <strong>numero offerta</strong> viene scritto nel campo numero preventivo del progetto</li>
                    <li>Parte la notifica Slack di nuovo progetto</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="off-payments">
                <AccordionTrigger>Piano di pagamento e Fatture in Cloud</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Puoi suddividere il totale in più tranche con modalità e termini di pagamento ereditati dal cliente; la somma delle percentuali deve essere 100%.</p>
                  <p>Con l'integrazione FiC attiva puoi inviare l'offerta come documento su Fatture in Cloud: token OAuth rinnovato con buffer di 5 minuti, mappatura di cliente, righe e split di pagamento, ID FiC salvato sull'offerta.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="off-margins">
                <AccordionTrigger>Margini, sconti e simulatore</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Margine (%):</strong> Prezzo = Costo / (1 − Margine%). <strong>Sconto (%):</strong> riduzione sul prezzo finale. <strong>IVA:</strong> per riga, default 22%.</p>
                  <p>Il <strong>simulatore bidirezionale</strong> ricalcola il margine se modifichi il prezzo finale, e il prezzo se modifichi il margine target (riferimento: 30% di margine factory sui prezzi netti).</p>
                  <p>Gli importi in elenco sono sempre <strong>netti</strong> (dopo sconto, IVA esclusa). Solo i ruoli con <code>canEditFinancialFields</code> possono modificare margine e sconto.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Finanza */}
      <section id="man-finanza" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" />Finanza</CardTitle>
            <CardDescription>Cruscotto, offerte, gare, fatture, abbonamenti e costo personale</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="fin-menu">
                <AccordionTrigger>Il menu Finanza</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Le voci commerciali e amministrative sono raggruppate nel menu <strong>Finanza</strong>, nell'ordine: <strong>Cruscotto, Offerte, Gare, Fatture, Abbonamenti, Costo personale</strong>.</p>
                  <p>Il menu è visibile solo ai ruoli <strong>Admin, Account e Finance</strong>; la voce <strong>Costo personale</strong> è riservata ad Admin e Finance.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="fin-dashboard">
                <AccordionTrigger>Cruscotto vendite</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Il cruscotto raccoglie l'andamento commerciale: offerte emesse, accettate e perse, valore della pipeline, fatturato per periodo e <strong>prodotti venduti</strong> (aggregati sul prodotto di listino selezionato nelle righe offerta).</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="fin-invoices">
                <AccordionTrigger>Fatture</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>La coda fatture elenca i documenti da emettere a partire dalle offerte accettate e dalle tranche di pagamento previste. L'emissione avviene tramite l'integrazione con Fatture in Cloud, che riporta stato e riferimento del documento.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="fin-subscriptions">
                <AccordionTrigger>Abbonamenti e siti WpZen</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Gestisce i servizi ricorrenti (canoni, hosting, licenze) con periodicità, importo e prossima scadenza. All'interno della pagina trovi anche il monitor dei <strong>siti WpZen</strong>, spostato qui dalla vecchia dashboard Finance.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="fin-tenders">
                <AccordionTrigger>Gare</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Registro delle gare e dei bandi a cui l'agenzia partecipa: ente, scadenza, importo a base d'asta, stato di partecipazione ed esito, con collegamento all'eventuale offerta.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="fin-staff-cost">
                <AccordionTrigger>Costo personale</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>La sezione (ex "HR" in dashboard) mostra il costo del personale con dati contrattuali e compensi. È accessibile <strong>solo ad Admin e Finance</strong>: le colonne di compenso sono protette lato database.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Progetti */}
      <section id="man-progetti" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" />Progetti</CardTitle>
            <CardDescription>Gestisci i progetti approvati e monitora l'avanzamento</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="proj-conversion">
                <AccordionTrigger>Da budget a progetto</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Quando un budget viene <strong>approvato</strong>, il sistema crea automaticamente un progetto corrispondente. Tutte le attività, categorie, assegnatari e impostazioni vengono copiate nel progetto.</p>
                  <p>Puoi anche creare progetti <strong>manuali</strong> senza passare dal budget, per lavori interni o non preventivabili.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="proj-leader">
                <AccordionTrigger>Project Leader unificato</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Il <strong>Project Leader</strong> è un'assegnazione specifica (campo <code>project_leader_id</code>) che <strong>supersede</strong> i normali vincoli di membership: anche se non è nel team del progetto, il Leader può vederlo, modificarlo e gestirne lo stato.</p>
                  <p>Quando un Member viene assegnato come Project Leader, riceve automaticamente accesso completo al canvas e può aggiornare il progresso.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="proj-canvas">
                <AccordionTrigger>Canvas progetto</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Il Canvas è la scheda completa del progetto e include:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Informazioni generali:</strong> nome, cliente, date, stato, descrizione, obiettivi</li>
                    <li><strong>Team:</strong> project leader e membri assegnati</li>
                    <li><strong>Metriche budget:</strong> ore previste vs consuntivate, margine, costi, <strong>Budget Target = 70% del costo attività</strong></li>
                    <li><strong>Attività:</strong> lista completa con stato e progresso</li>
                    <li><strong>Timesheet:</strong> ore registrate per utente/attività con maggiorazioni</li>
                    <li><strong>Costi aggiuntivi:</strong> spese extra non previste nel budget iniziale</li>
                    <li><strong>Progress updates:</strong> aggiornamenti sulla percentuale di avanzamento con note</li>
                    <li><strong>Audit log:</strong> storico di tutte le modifiche al progetto</li>
                    <li><strong>Link brief / Cartella Drive</strong></li>
                  </ul>
                  <a href="https://app.guidde.com/share/playbooks/5MjJfubvLvvzV67J4o4HVb?origin=e2FFLZOVcCRiKGqWvRRvpENEsBJ2" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline">
                    Video guida: i progetti →
                  </a>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="proj-target">
                <AccordionTrigger>Budget Target (70%)</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Il <strong>Budget Target</strong> nel Project Canvas rappresenta il <strong>70% del totale dei soli costi delle attività</strong> (esclusi prodotti e costi esterni fissi). È il riferimento operativo per misurare la marginalità reale del progetto.</p>
                  <p>Le notifiche progressive di budget (50/75/90/100%) si calcolano su questo valore.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="proj-adjustments">
                <AccordionTrigger>Maggiorazioni timesheet</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Nel canvas progetto puoi applicare <strong>maggiorazioni percentuali</strong> alle ore registrate, configurabili per:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Utente specifico:</strong> es. +15% per uno sviluppatore senior</li>
                    <li><strong>Categoria attività:</strong> es. +25% per "Sviluppo Backend" su un certo cliente</li>
                  </ul>
                  <p>Le maggiorazioni vengono moltiplicate sulle ore base e modificano costo e margine. Solo Admin, Project Leader e ruoli con accesso scrittura possono gestirle.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="proj-progress">
                <AccordionTrigger>Progress automatico (recurring/pack)</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Per progetti di tipo <strong>recurring</strong> o <strong>pack</strong>, la percentuale di avanzamento è calcolata <strong>automaticamente</strong>:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Recurring:</strong> % = mesi trascorsi / mesi totali contrattuali</li>
                    <li><strong>Pack:</strong> % = ore consuntivate / ore pacchetto</li>
                  </ul>
                  <p>Il ricalcolo massivo (funzione DB) ignora i progetti già in stato "completato" per non sovrascrivere chiusure manuali.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="proj-status">
                <AccordionTrigger>Stati del progetto</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>In partenza:</strong> progetto approvato ma non ancora avviato</li>
                    <li><strong>Aperto:</strong> progetto in corso d'opera</li>
                    <li><strong>Da fatturare:</strong> lavoro completato, in attesa di fatturazione</li>
                    <li><strong>Completato:</strong> progetto chiuso definitivamente. Quando un progetto passa a "completato" tutte le attività future vengono marcate completate e i carichi residui del team azzerati.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="proj-costs">
                <AccordionTrigger>Costi aggiuntivi</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Nella sezione "Costi Aggiuntivi" del Canvas puoi registrare spese non previste nel budget iniziale:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Nome e descrizione del costo</li>
                    <li>Importo</li>
                    <li>Fornitore associato (opzionale)</li>
                  </ul>
                  <p>Questi costi vengono inclusi nel calcolo del margine effettivo del progetto.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="proj-audit">
                <AccordionTrigger>Audit log</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  <p>Ogni modifica al progetto viene registrata nell'audit log con: utente, azione, campo modificato, valore precedente e nuovo valore, data e ora. 
                  Questo garantisce la tracciabilità completa di tutte le operazioni.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Task di progetto */}
      <section id="man-task" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListTodo className="h-5 w-5 text-primary" />Task di progetto</CardTitle>
            <CardDescription>Lavoro operativo con scadenze, priorità e assegnatari</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="task-what">
                <AccordionTrigger>Com'è fatta una task</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Titolo</strong> e <strong>descrizione rich-text</strong> (formattazione, immagini, tabelle, blocchi di codice)</li>
                    <li><strong>Assegnatari multipli</strong></li>
                    <li><strong>Date</strong> di inizio e scadenza, con tempo tracciato collegato</li>
                    <li><strong>Stato:</strong> Da fare, In corso, In revisione, Completato</li>
                    <li><strong>Priorità:</strong> Alta, Normale, Bassa</li>
                    <li><strong>Attività prevista collegata (obbligatoria):</strong> ogni task deve essere agganciata a una voce del budget del progetto</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="task-where">
                <AccordionTrigger>Dove si gestiscono</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Canvas progetto → Task:</strong> lista, board e vista Agenda del progetto</li>
                    <li><strong>Dashboard personale → Le mie task:</strong> le task assegnate a te, ordinate per scadenza</li>
                    <li><strong>Pulsante rapido nell'header:</strong> crea una task da qualsiasi pagina, con opzione "Crea un'altra" per inserimenti in sequenza</li>
                    <li><strong>Calendario:</strong> le task si pianificano come le attività (anche via drag &amp; drop)</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="task-dnd">
                <AccordionTrigger>Drag &amp; drop e ricorrenze</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Trascinando una task puoi cambiarne <strong>scadenza, priorità o stato</strong>, a seconda della vista in cui ti trovi.</p>
                  <p>Le task possono essere <strong>ricorrenti</strong>: alla creazione scegli la frequenza e l'ambito delle modifiche (solo questa occorrenza oppure l'intera serie).</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Progetti Approvati */}
      <section id="man-approved-projects" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-primary" />Progetti Approvati</CardTitle>
            <CardDescription>Monitor delle criticità sui progetti in corso</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="ap-overview">
                <AccordionTrigger>A cosa serve la pagina</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>La pagina <code>/approved-projects</code> raccoglie tutti i progetti in stato <strong>Aperto</strong> o <strong>In partenza</strong> e li classifica in base alla criticità, così puoi intervenire prima che la situazione degeneri.</p>
                  <p>In alto trovi delle <strong>summary card</strong> con il conteggio dei progetti per livello di criticità (OK / Warning / Critical).</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="ap-flags">
                <AccordionTrigger>Indicatori di criticità</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Un progetto è classificato <strong>Critical</strong> se almeno una di queste condizioni è vera:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Budget consumato <strong>&gt;85%</strong> (costo operativo vs Budget Target)</li>
                    <li><strong>Meno di 7 giorni</strong> alla deadline</li>
                    <li><strong>Margine basso</strong> rispetto alla soglia configurata</li>
                  </ul>
                  <p>Il livello <strong>Warning</strong> scatta su soglie intermedie (consumo 70-85%, deadline 7-14gg). Un semaforo visivo affianca ogni riga per identificazione immediata.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="ap-actions">
                <AccordionTrigger>Azioni rapide</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  <p>Da ogni riga puoi aprire direttamente il <strong>Canvas progetto</strong>, vedere il timesheet, o aggiornare lo stato. La pagina è ottimizzata per un controllo settimanale rapido da parte di Admin, Team Leader e Project Leader.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Calendario */}
      <section id="man-calendario" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" />Calendario e Timesheet</CardTitle>
            <CardDescription>Pianifica e traccia il lavoro quotidiano</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="cal-views">
                <AccordionTrigger>Viste calendario</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Vista giornaliera:</strong> slot orari dalle 8:00 alle 20:00, ideale per pianificazione dettagliata</li>
                    <li><strong>Vista settimanale:</strong> panoramica dei 5 giorni lavorativi</li>
                    <li><strong>Vista multi-utente:</strong> (Admin/Team Leader) visualizza i calendari di più membri del team fianco a fianco, con possibilità di selezione multipla e filtri per area</li>
                  </ul>
                  <a href="https://app.guidde.com/share/playbooks/biYFCxNTJpMCeugo4EuLgk?origin=e2FFLZOVcCRiKGqWvRRvpENEsBJ2" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline">
                    Video guida: il calendario →
                  </a>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cal-planning">
                <AccordionTrigger>Pianificazione attività</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Per pianificare un'attività:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Clicca su uno slot orario nel calendario</li>
                    <li>Seleziona progetto e attività dal dialog (vengono mostrati solo progetti in stato <strong>Aperto</strong> di cui sei leader o membro)</li>
                    <li>Imposta orario di inizio e fine</li>
                    <li>Aggiungi note opzionali</li>
                    <li>Per attività ricorrenti, imposta la ripetizione (giornaliera, settimanale)</li>
                  </ol>
                  <p className="mt-2">Le attività pianificate vengono visualizzate con colori diversi per progetto e mostrano il tempo rimanente rispetto al budget.</p>
                  <p className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
                    <strong className="text-foreground">🔁 Eliminazione ricorrenze:</strong> eliminando un evento ricorrente, il sistema promuove automaticamente l'occorrenza successiva a parent della serie, evitando di cancellare l'intera ricorrenza per errore.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cal-google">
                <AccordionTrigger>Integrazione Google Calendar</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>TimeTrap si integra con Google Calendar per una sincronizzazione bidirezionale:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Gli eventi Google Calendar vengono mostrati nel calendario TimeTrap</li>
                    <li>Puoi scegliere quali calendari sincronizzare</li>
                    <li>Le attività TimeTrap possono essere visualizzate in Google Calendar</li>
                    <li>L'auth OAuth conserva il <strong>redirect-path</strong> nello state, riportandoti esattamente alla pagina di partenza</li>
                  </ul>
                  <p>Configura l'integrazione in <strong>Impostazioni → Google Calendar</strong>.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cal-timesheet">
                <AccordionTrigger>Timesheet, import e timesheet pubblica</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Il sistema traccia automaticamente le ore dalle attività pianificate nel calendario. Puoi anche:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Import timesheet (CSV/Excel):</strong> supporta delimitatore virgola o punto e virgola, formati orario HH:MM e DD/MM/YY HH:MM, mapping automatico colonne con soglia di similarità 0.6 (LCS)</li>
                    <li><strong>Timesheet pubblica v3:</strong> genera un link condivisibile con <strong>token a scadenza</strong> e flag per nascondere i dettagli finanziari (es. solo ore aggregate per stakeholder esterni)</li>
                    <li><strong>Export:</strong> esporta le ore in formato Excel per report</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cal-planner">
                <AccordionTrigger>Planner settimanale</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Il <strong>Planner</strong> è la vista settimanale di pianificazione: una riga per attività, una colonna per giorno, con le ore previste in ogni cella.</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Pianifica con <strong>"Aggiungi attività"</strong> oppure trascinando un'attività o una task dalla <strong>sidebar</strong></li>
                    <li>Sposta una riga già pianificata nella <strong>settimana precedente o successiva</strong> trascinandola sulle apposite aree</li>
                    <li><strong>Conferma le ore</strong> direttamente dal Planner, senza passare dalla vista giornaliera</li>
                    <li>Modifica o elimina gli slot pianificati e controlla le <strong>sovrapposizioni</strong>: il sistema blocca i conflitti di orario</li>
                  </ul>
                  <p>Il <strong>riepilogo per progetto</strong> mostra tre colonne: <strong>pianificate totali</strong>, <strong>pianificate settimana</strong> e <strong>confermate settimana</strong>, confrontate con le ore a budget.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cal-tasks">
                <AccordionTrigger>Task nel calendario e sincronizzazione realtime</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Oltre alle attività di budget puoi pianificare le <strong>task</strong> sia in vista giornaliera che nel Planner; nel dialog "Nuova attività manuale" trovi il campo <strong>Task</strong> (facoltativo) con le task aperte dell'attività e il pulsante <strong>"Nuova task"</strong>.</p>
                  <p>Il calendario è <strong>sincronizzato in tempo reale</strong>: le modifiche fatte da altri utenti (o in un'altra scheda) compaiono senza ricaricare la pagina.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Workload */}
      <section id="man-workload" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Workload</CardTitle>
            <CardDescription>Analisi del carico di lavoro del team</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>La sezione Workload mostra una panoramica del carico di lavoro di tutti i membri del team:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Ore contrattuali vs pianificate:</strong> confronto tra le ore previste dal contratto e quelle effettivamente pianificate</li>
              <li><strong>Saturazione:</strong> percentuale di utilizzo della capacità disponibile</li>
              <li><strong>Distribuzione per progetto:</strong> come le ore di ogni risorsa sono distribuite tra i progetti</li>
              <li><strong>Filtri temporali:</strong> analisi per settimana, mese o intervallo personalizzato</li>
            </ul>
            <p className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
              <strong className="text-foreground">💡 Best Practice:</strong> Controlla il Workload settimanalmente per evitare sovraccarichi e bilanciare le risorse.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Workflows */}
      <section id="man-workflows" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5 text-primary" />Workflows</CardTitle>
            <CardDescription>Automatizza i flussi di lavoro ripetitivi</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="wf-basics">
                <AccordionTrigger>Template e flussi attivi</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Template:</strong> definisci un modello di flusso con step predefiniti</li>
                    <li><strong>Flussi attivi:</strong> istanzia un template per un progetto specifico</li>
                    <li><strong>Stato task:</strong> traccia l'avanzamento di ogni step (da fare, in corso, completato)</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="wf-deps">
                <AccordionTrigger>Dipendenze tra task (dependsOn)</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Ogni task può dipendere da uno o più task precedenti tramite il campo <code>dependsOn</code>:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Un task <strong>bloccato</strong> non può essere completato finché tutti i suoi predecessori non sono completati</li>
                    <li>Le dipendenze formano <strong>catene</strong>: se sblocchi un task a monte, tutti i discendenti diventano disponibili in cascata</li>
                    <li>Se <strong>deselezioni</strong> un task già completato, anche tutti i discendenti vengono riportati indietro automaticamente (cascade uncheck)</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="wf-deadlines">
                <AccordionTrigger>Scadenze individuali e commenti</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Ogni task supporta:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Scadenza individuale</strong> (separata dalla scadenza del flusso)</li>
                    <li><strong>Assegnatario</strong> dedicato</li>
                    <li><strong>Commenti contestuali</strong>: una sezione di chat per discutere il task con gli altri partecipanti del flusso</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Performance Reviews */}
      <section id="man-performance" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" />Performance Reviews</CardTitle>
            <CardDescription>Schede personali di crescita professionale</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="perf-overview">
                <AccordionTrigger>Cos'è la scheda performance</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>La sezione <strong>Performance</strong> nel Profilo è la tua scheda annuale di crescita professionale. Contiene:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Profilo professionale:</strong> ruolo, team, team leader, tipo contratto, data inizio, compenso, obiettivo di lungo termine, ruolo target di carriera</li>
                    <li><strong>Scheda annuale:</strong> punti di forza, aree di miglioramento, supporto richiesto all'azienda</li>
                    <li><strong>Obiettivi:</strong> goal per l'anno con eventuale <strong>bonus % associato</strong> (per ruoli leadership/sales)</li>
                    <li><strong>Note trimestrali:</strong> feedback Q1/Q2/Q3/Q4 raccolti durante i one-to-one</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="perf-access">
                <AccordionTrigger>Chi vede cosa</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Utente:</strong> vede solo la propria scheda</li>
                    <li><strong>Team Leader:</strong> vede le schede dei membri della propria area</li>
                    <li><strong>Admin:</strong> gestisce tutte le schede da Impostazioni → Performance Review Management</li>
                  </ul>
                  <p>Le RLS sul database garantiscono che nessuno possa accedere alle schede di colleghi al di fuori della propria area di competenza.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="perf-objectives">
                <AccordionTrigger>Obiettivi e bonus %</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Per ogni obiettivo annuale puoi specificare titolo, descrizione (KPI), ordine e una <strong>percentuale di bonus</strong>. Per ruoli leadership e sales la somma delle percentuali rappresenta il peso massimo del bonus a obiettivi.</p>
                  <p>Solo gli Admin possono creare/modificare obiettivi e note trimestrali.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Banca Ore */}
      <section id="man-hours-bank" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" />Banca Ore</CardTitle>
            <CardDescription>Saldo, riporti e previsionale delle ore</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="hb-balance">
                <AccordionTrigger>Saldo annuale (YTD)</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>La <strong>Banca Ore</strong> nel Profilo mostra il saldo annuale Year-To-Date calcolato come:</p>
                  <p className="font-mono bg-muted p-2 rounded text-xs">Saldo = (ore confermate + rettifiche) − ore attese − ore recuperate</p>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li><strong>Ore confermate:</strong> tutto il tempo confermato nel periodo (incluse le attività Larin OFF e di banca ore)</li>
                    <li><strong>Rettifiche:</strong> correzioni manuali mensili (+/−) inserite dall'admin</li>
                    <li><strong>Ore attese:</strong> ore dovute da contratto e periodi contrattuali, al netto delle chiusure aziendali</li>
                    <li><strong>Ore recuperate:</strong> ore già prese come recupero banca ore (progetto "Larin OFF")</li>
                  </ul>
                  <p className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
                    <strong className="text-foreground">Attenzione ai termini:</strong> le <strong>ore attese</strong> sono quelle dovute da contratto e non vanno confuse con le <strong>ore pianificate</strong> a calendario, che non entrano nel saldo.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="hb-forecast">
                <AccordionTrigger>Previsionale mensile</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Il <strong>previsionale</strong> mostra il saldo proiettato a fine mese corrente, sommando al saldo attuale le ore <strong>pianificate a calendario</strong> nei giorni rimanenti (non le ore attese da contratto). Ti permette di capire in anticipo se chiuderai il mese in positivo o in deficit.</p>

                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="hb-detail">
                <AccordionTrigger>Dettaglio mensile e contratti dinamici</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Il dettaglio mese-per-mese visualizza ore confermate, attese, saldo e riporto progressivo. Le ore attese si basano sui <strong>periodi contrattuali</strong> (<code>user_contract_periods</code>): se cambi tipo contratto o ore settimanali a metà anno, il calcolo si adegua automaticamente.</p>
                  <p>I saldi negativi vengono formattati correttamente preservando il segno (es. <code>-2:30</code> per "due ore e mezza in deficit").</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="hb-recovery">
                <AccordionTrigger>Recuperi e Larin OFF</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Le assenze e i recuperi ore vengono tracciati tramite il progetto speciale <strong>Larin OFF</strong>: registra qui ferie, permessi, malattia e recuperi banca ore. Il sistema scala automaticamente le ore dal saldo attivo.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Impostazioni */}
      <section id="man-impostazioni" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" />Impostazioni</CardTitle>
            <CardDescription>Configura l'applicazione secondo le tue esigenze</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="set-users">
                <AccordionTrigger>Gestione utenti e contratti</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Solo gli <strong>Admin</strong> possono gestire gli utenti:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Approvare nuovi utenti registrati</li>
                    <li>Assegnare ruoli (Admin, Account, Finance, Team Leader, Coordinator, Member, External)</li>
                    <li>Impostare area, tariffa oraria, ore contrattuali, tipo contratto</li>
                    <li>Gestire <strong>periodi contrattuali dinamici</strong>: se un utente cambia ore o tipologia nel tempo, registra il periodo con date di validità — il sistema usa il periodo corretto per ogni calcolo</li>
                    <li>Definire le aree di competenza per i Team Leader</li>
                    <li><strong>Simulare un ruolo</strong> per testare i permessi (la simulazione è solo visuale, le azioni mantengono il tuo ruolo reale)</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="set-external">
                <AccordionTrigger>External users</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Gli utenti con ruolo <strong>External</strong> sono collaboratori esterni gestiti da una sezione dedicata in Impostazioni:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Accesso tramite <strong>magic link</strong> (no password)</li>
                    <li>Accesso limitato ai progetti esplicitamente assegnati (<code>external_project_access</code>)</li>
                    <li>Possono assegnare attività solo agli utenti consentiti (<code>external_visible_users</code>)</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="set-clients">
                <AccordionTrigger>Clienti, contatti e contatti multi-azienda</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Gestisci l'anagrafica dei clienti con dati aziendali, account responsabile, livello strategico, termini di pagamento, split di pagamento, cartella Drive.</p>
                  <p>I <strong>contatti</strong> sono gestiti con relazione molti-a-molti tramite <code>client_contact_clients</code>: un singolo contatto (es. un freelance) può essere associato a più clienti contemporaneamente.</p>
                  <p>Supportato l'import da Excel e la sincronizzazione HubSpot.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="set-products">
                <AccordionTrigger>Prodotti (listino Fatture in Cloud)</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Prodotti:</strong> il listino è allineato a Fatture in Cloud. Ogni prodotto ha codice, nome, descrizione, prezzo netto/lordo, <strong>categoria di ricavo</strong> e split di pagamento; è collegabile ai budget e usato nelle righe delle offerte.</p>
                  <p>Una <strong>sincronizzazione notturna</strong> (03:15 UTC) aggiorna automaticamente il catalogo prodotti da Fatture in Cloud.</p>
                  <p className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
                    <strong className="text-foreground">ℹ️ Servizi dismessi:</strong> la vecchia anagrafica Servizi non è più utilizzata: budget e offerte lavorano solo con i Prodotti.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="set-levels">
                <AccordionTrigger>Livelli, aree e tariffe</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>I livelli definiscono le tariffe orarie per la fatturazione (es. Junior €50/h, Senior €90/h, Director €120/h). Ogni livello è associato a una o più <strong>aree</strong>: Marketing, Tech, Branding, Sales, Jarvis, Struttura, Interno.</p>
                  <p>Le aree filtrano automaticamente categorie e livelli pertinenti nei budget.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="set-categories">
                <AccordionTrigger>Categorie e mapping discipline</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Categorie attività:</strong> raggruppamenti per le attività del budget (es. Strategy, Creative, Development, PM). Ogni categoria può essere associata a specifiche aree.</p>
                  <p><strong>Mapping discipline:</strong> collega le discipline (es. Digital, Brand, Social) alle aree disponibili, per filtrare automaticamente le categorie e i livelli pertinenti.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="set-integrations">
                <AccordionTrigger>Integrazioni</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3">
                  <p><strong>HubSpot:</strong> sincronizza clienti e contatti con il CRM HubSpot. Configura le mappature dei campi e collega gli owner HubSpot agli utenti TimeTrap.</p>
                  <p><strong>Google Calendar:</strong> sincronizza eventi bidirezionalmente con redirect-path conservato durante l'OAuth.</p>
                  <p><strong>Google Sheet sync:</strong>
                    <br />• Clienti/contatti ogni 6 ore da Google Sheet con mapping HubSpot Owner
                    <br />• Trattative draft 3 volte al giorno da Foglio 3 (gid=1562960313) verso budget in stato "in attesa"
                  </p>
                  <p><strong>Fatture in Cloud:</strong> integrazione OAuth con buffer di 5 minuti, gestione token unificata, invio offerte, emissione fatture e <strong>sincronizzazione notturna del listino prodotti</strong>. Solo Admin può configurare/scollegare.</p>
                  <p><strong>Slack:</strong> notifiche su nuovo progetto, aggiornamenti progresso e completamento, più il <strong>report settimanale ore per team</strong> del lunedì mattina su <code>#larin-teamleader</code>.</p>
                  <p><strong>Make webhook:</strong> trigger al completamento di un progetto e trigger trimestrali automatici per i progetti continuativi (recurring).</p>
                  <p><strong>API pubblica e MCP:</strong> endpoint REST protetti da API Key per integrare TimeTrap con strumenti esterni e server MCP per collegare assistenti come Claude (progetti, attività, ore, utenti).</p>
                  <p><strong>Google Drive:</strong> creazione automatica della cartella progetto e copia dei transcript Meet nella sottocartella Meeting.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="set-payments">
                <AccordionTrigger>Modalità e termini di pagamento</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Modalità di pagamento:</strong> tipi di pagamento disponibili (Bonifico, Carta di credito, ecc.). Gestisci l'ordine e lo stato attivo/inattivo.</p>
                  <p><strong>Termini di pagamento:</strong> tempistiche di pagamento (A vista, 30gg, 60gg, 90gg, ecc.). Usati nei preventivi e nelle configurazioni dei clienti.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="set-global">
                <AccordionTrigger>Impostazioni globali</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  <p>Configurazioni a livello di sistema: soglie di allarme margine, giorni di chiusura aziendale, 
                  impostazioni predefinite per nuovi budget, target di produttività e altro.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BarChart3, FolderKanban, FileText, Briefcase, Calendar, Users, Settings, Workflow, TrendingUp } from 'lucide-react';

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
                  <p>Il pannello AI Insights genera analisi on-demand dei tuoi dati. Clicca su <strong>"Genera Insights"</strong> per ricevere un riepilogo intelligente che include:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Analisi dei progetti più critici con suggerimenti</li>
                    <li>Pattern di utilizzo delle risorse</li>
                    <li>Previsioni di sforamento budget</li>
                    <li>Suggerimenti di ottimizzazione</li>
                  </ul>
                  <p>Gli insights vengono memorizzati in cache per evitare chiamate ripetute. Puoi chiuderli con il pulsante "Chiudi".</p>
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
                  <p className="mt-2"><strong>Campi principali:</strong> Nome, tipo progetto, disciplina, cliente, contatto, account responsabile, descrizione, obiettivo, link brief, cartella Google Drive.</p>
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
                    <li><strong>Genera preventivo:</strong> crea il preventivo PDF dal budget</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Preventivi */}
      <section id="man-preventivi" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Preventivi</CardTitle>
            <CardDescription>Genera e gestisci le offerte per i clienti</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="quote-gen">
                <AccordionTrigger>Generazione PDF</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Dalla pagina del budget, clicca su <strong>"Genera Preventivo"</strong>. Il sistema crea un PDF professionale con:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Header con logo aziendale e dati cliente</li>
                    <li>Tabella dettagliata delle voci (categorie, attività, ore, costi)</li>
                    <li>Riepilogo con subtotale, margine, sconto e totale</li>
                    <li>Modalità e termini di pagamento</li>
                    <li>Numerazione automatica progressiva</li>
                  </ul>
                  <p>Ogni preventivo generato viene salvato e puoi accedere allo storico dalla sezione <strong>Preventivi</strong>.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="quote-margins">
                <AccordionTrigger>Margini e sconti</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Margine (%):</strong> Viene applicato al costo totale per calcolare il prezzo di vendita. Formula: Prezzo = Costo / (1 - Margine%)</p>
                  <p><strong>Sconto (%):</strong> Riduzione applicata al prezzo di vendita finale. Lo sconto viene mostrato chiaramente nel preventivo.</p>
                  <p><strong>IVA:</strong> Calcolata per voce con aliquota personalizzabile (default 22%).</p>
                  <p className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
                    <strong className="text-foreground">⚠️ Nota:</strong> Solo i ruoli con permesso <code>canEditFinancialFields</code> possono modificare margine e sconto.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="quote-payments">
                <AccordionTrigger>Split pagamento</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Puoi definire <strong>split di pagamento</strong> per suddividere il totale in più tranche:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Seleziona la <strong>modalità di pagamento</strong> (bonifico, carta, ecc.)</li>
                    <li>Seleziona i <strong>termini di pagamento</strong> (30gg, 60gg, ecc.)</li>
                    <li>Imposta la <strong>percentuale</strong> per ogni tranche</li>
                    <li>La somma delle percentuali deve essere 100%</li>
                  </ul>
                  <p>Gli split vengono ereditati dalle impostazioni del cliente, ma puoi personalizzarli per ogni preventivo.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="quote-status">
                <AccordionTrigger>Stati del preventivo</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Bozza:</strong> preventivo generato ma non ancora inviato</li>
                    <li><strong>Inviato:</strong> preventivo inviato al cliente</li>
                    <li><strong>Approvato:</strong> il cliente ha accettato l'offerta</li>
                    <li><strong>Rifiutato:</strong> l'offerta non è stata accettata</li>
                  </ul>
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
              <AccordionItem value="proj-canvas">
                <AccordionTrigger>Canvas progetto</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Il Canvas è la scheda completa del progetto e include:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Informazioni generali:</strong> nome, cliente, date, stato, descrizione, obiettivi</li>
                    <li><strong>Team:</strong> project leader e membri assegnati</li>
                    <li><strong>Metriche budget:</strong> ore previste vs consuntivate, margine, costi</li>
                    <li><strong>Attività:</strong> lista completa con stato e progresso</li>
                    <li><strong>Timesheet:</strong> ore registrate per utente/attività</li>
                    <li><strong>Costi aggiuntivi:</strong> spese extra non previste nel budget iniziale</li>
                    <li><strong>Progress updates:</strong> aggiornamenti sulla percentuale di avanzamento con note</li>
                    <li><strong>Audit log:</strong> storico di tutte le modifiche al progetto</li>
                    <li><strong>Link brief:</strong> collegamento al documento brief del progetto</li>
                    <li><strong>Cartella Drive:</strong> collegamento alla cartella Google Drive del progetto</li>
                  </ul>
                  <a href="https://app.guidde.com/share/playbooks/5MjJfubvLvvzV67J4o4HVb?origin=e2FFLZOVcCRiKGqWvRRvpENEsBJ2" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline">
                    Video guida: i progetti →
                  </a>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="proj-status">
                <AccordionTrigger>Stati del progetto</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>In partenza:</strong> progetto approvato ma non ancora avviato</li>
                    <li><strong>Aperto:</strong> progetto in corso d'opera</li>
                    <li><strong>Da fatturare:</strong> lavoro completato, in attesa di fatturazione</li>
                    <li><strong>Completato:</strong> progetto chiuso definitivamente</li>
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
                    <li><strong>Vista multi-utente:</strong> (Admin/Team Leader) visualizza i calendari di più membri del team fianco a fianco</li>
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
                    <li>Seleziona progetto e attività dal dialog</li>
                    <li>Imposta orario di inizio e fine</li>
                    <li>Aggiungi note opzionali</li>
                    <li>Per attività ricorrenti, imposta la ripetizione (giornaliera, settimanale)</li>
                  </ol>
                  <p className="mt-2">Le attività pianificate vengono visualizzate con colori diversi per progetto e mostrano il tempo rimanente rispetto al budget.</p>
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
                  </ul>
                  <p>Configura l'integrazione in <strong>Impostazioni → Google Calendar</strong>.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cal-timesheet">
                <AccordionTrigger>Timesheet e import</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Il sistema traccia automaticamente le ore dalle attività pianificate nel calendario. Puoi anche:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Import timesheet:</strong> importa ore da file Excel per registrazioni massive</li>
                    <li><strong>Timesheet pubblica:</strong> genera un link condivisibile per la timesheet di un progetto (utile per stakeholder esterni)</li>
                    <li><strong>Export:</strong> esporta le ore in formato Excel per report</li>
                  </ul>
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
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>I Workflows permettono di definire flussi di lavoro automatizzati:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Template:</strong> definisci un modello di flusso con step predefiniti</li>
              <li><strong>Flussi attivi:</strong> istanzia un template per un progetto specifico</li>
              <li><strong>Step:</strong> ogni step può avere assegnatari, scadenze e dipendenze</li>
              <li><strong>Stato:</strong> traccia l'avanzamento di ogni step (da fare, in corso, completato)</li>
            </ul>
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
                <AccordionTrigger>Gestione utenti</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Solo gli <strong>Admin</strong> possono gestire gli utenti:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Approvare nuovi utenti registrati</li>
                    <li>Assegnare ruoli (Admin, Account, Finance, Team Leader, Coordinator, Member)</li>
                    <li>Impostare area, tariffa oraria, ore contrattuali, tipo contratto</li>
                    <li>Gestire periodi contrattuali (contract periods)</li>
                    <li>Definire le aree di competenza per i Team Leader</li>
                    <li>Simulare un ruolo per testare i permessi</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="set-clients">
                <AccordionTrigger>Clienti e contatti</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>Gestisci l'anagrafica dei clienti con:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Dati aziendali (nome, email, telefono)</li>
                    <li>Account responsabile</li>
                    <li>Livello strategico (1-5)</li>
                    <li>Termini di pagamento predefiniti</li>
                    <li>Split di pagamento personalizzati</li>
                    <li>Contatti associati (nome, ruolo, email, telefono)</li>
                    <li>Cartella Google Drive associata</li>
                    <li>Import da file Excel e sincronizzazione HubSpot</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="set-products">
                <AccordionTrigger>Prodotti e servizi</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Prodotti:</strong> articoli a prezzo fisso (es. licenze, hosting, tool). Ogni prodotto ha codice, nome, prezzo netto/lordo, categoria e split di pagamento.</p>
                  <p><strong>Servizi:</strong> tipologie di servizio offerte (es. Consulenza, Sviluppo Web). I servizi vengono associati a budget e progetti per categorizzare le attività.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="set-levels">
                <AccordionTrigger>Livelli e tariffe</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  <p>I livelli definiscono le tariffe orarie per la fatturazione al cliente (es. Junior €50/h, Senior €90/h, Director €120/h). 
                  Ogni livello può essere associato a una o più aree. Le tariffe dei livelli vengono usate per calcolare il costo di vendita nel budget e nel preventivo.</p>
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
                  <p><strong>HubSpot:</strong> sincronizza clienti e contatti con il CRM HubSpot. Configura le mappature dei campi per allineare i dati.</p>
                  <p><strong>Google Calendar:</strong> sincronizza eventi bidirezionalmente. Vedi sezione Calendario per dettagli.</p>
                  <p><strong>Google Sheets:</strong> esporta dati su fogli Google per report personalizzati.</p>
                  <p><strong>Fatture in Cloud:</strong> integrazione per la fatturazione elettronica. Collegati con OAuth e configura la sincronizzazione.</p>
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

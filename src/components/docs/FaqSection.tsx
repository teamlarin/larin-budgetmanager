import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 mb-12">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <HelpCircle className="h-6 w-6 text-primary" />
        Domande Frequenti
      </h2>

      <Card variant="static">
        <CardContent className="pt-6">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="faq-1">
              <AccordionTrigger>Come posso modificare un budget già approvato?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Una volta che un budget viene approvato e convertito in progetto, le modifiche strutturali sono limitate per mantenere la coerenza. Tuttavia puoi:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Aggiungere costi aggiuntivi nella sezione dedicata del progetto</li>
                  <li>Creare attività manuali per lavori extra</li>
                  <li>Duplicare il budget originale e creare una variante per una nuova offerta</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-2">
              <AccordionTrigger>Come funziona il calcolo dei margini?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Il sistema calcola i margini confrontando:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Ricavo previsto:</strong> totale dell'offerta accettata</li>
                  <li><strong>Costo effettivo:</strong> ore lavorate × tariffa oraria del collaboratore + costi aggiuntivi</li>
                  <li><strong>Margine:</strong> (Ricavo - Costo) / Ricavo × 100</li>
                </ul>
                <p>Configura le soglie di allarme nelle Impostazioni per ricevere notifiche quando un progetto rischia di andare in perdita.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-3">
              <AccordionTrigger>Posso esportare i dati in Excel?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Sì! Diverse sezioni supportano l'esportazione:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Timesheet:</strong> esporta le ore lavorate in formato Excel</li>
                  <li><strong>Progetti:</strong> scarica il riepilogo con margini e costi</li>
                  <li><strong>Offerte:</strong> PDF pubblico e link firma da inviare al cliente</li>
                </ul>
                <p>Cerca l'icona di download o esportazione nelle rispettive sezioni.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-4">
              <AccordionTrigger>Come gestisco i permessi degli utenti?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Gli admin possono modificare i ruoli in <strong>Impostazioni → Gestione Utenti</strong>. Consulta la sezione "Ruoli e Permessi" per la matrice completa.</p>
                <p>Puoi anche simulare un ruolo per testare come appare l'interfaccia per un altro utente.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-5">
              <AccordionTrigger>Come collego Google Calendar?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Vai su <strong>Impostazioni → Integrazioni → Google Calendar</strong></li>
                  <li>Clicca su "Connetti" e autorizza l'accesso</li>
                  <li>Seleziona i calendari da sincronizzare</li>
                  <li>Gli eventi appariranno automaticamente nella vista calendario</li>
                </ol>
                <p>La sincronizzazione è bidirezionale: le attività create in TimeTrap possono essere visualizzate anche in Google Calendar.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-6">
              <AccordionTrigger>Come creo un progetto manuale senza budget?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Nella sezione <strong>Progetti</strong>, clicca su <strong>"Nuovo Progetto Manuale"</strong>. Questo crea un progetto senza budget associato, utile per:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Lavori interni (es. formazione, R&D)</li>
                  <li>Progetti non fatturabili</li>
                  <li>Attività di supporto/manutenzione</li>
                </ul>
                <p>Puoi comunque aggiungere attività manuali e tracciare le ore nel calendario.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-7">
              <AccordionTrigger>Come funziona la timesheet pubblica?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Puoi generare un <strong>link pubblico</strong> per la timesheet di un progetto con token a scadenza:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Apri il Canvas del progetto</li>
                  <li>Vai alla sezione Timesheet</li>
                  <li>Clicca su "Genera link pubblico" e configura scadenza e visibilità dettagli finanziari</li>
                  <li>Condividi il link con stakeholder esterni</li>
                </ol>
                <p>Il link mostra una vista di sola lettura delle ore registrate. Con il flag "nascondi dettagli" puoi mostrare solo le ore aggregate senza informazioni economiche.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-8">
              <AccordionTrigger>Posso importare clienti da un file Excel?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                <p>Sì, nella sezione <strong>Impostazioni → Clienti</strong> trovi il pulsante "Importa". Prepara un file Excel con le colonne: Nome, Email, Telefono, Note. 
                Il sistema mapperà automaticamente le colonne e ti mostrerà un'anteprima prima dell'importazione.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-9">
              <AccordionTrigger>Come funzionano le notifiche?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>TimeTrap invia notifiche tramite due canali:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>In-app:</strong> icona campana in alto a destra, con badge per le non lette</li>
                  <li><strong>Email:</strong> notifiche inviate all'indirizzo del tuo account</li>
                </ul>
                <p>Puoi personalizzare le preferenze per ogni tipo di notifica dal tuo Profilo.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-10">
              <AccordionTrigger>Come funziona il Gantt chart nel budget?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Il Gantt chart visualizza la timeline delle attività del budget:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Ogni attività è rappresentata da una barra orizzontale</li>
                  <li>La posizione dipende dal <strong>giorno di inizio (offset)</strong> rispetto all'inizio progetto</li>
                  <li>La lunghezza dipende dalla <strong>durata in giorni</strong></li>
                  <li>I colori raggruppano le attività per categoria</li>
                </ul>
                <p>Imposta offset e durata nei dettagli di ogni attività del budget.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-11">
              <AccordionTrigger>Come funzionano le schede performance?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Nel <strong>Profilo</strong> trovi la tua scheda Performance annuale: profilo professionale (ruolo, team, contratto), punti di forza, aree di miglioramento, obiettivi annuali (con eventuale bonus %) e note trimestrali Q1-Q4.</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Vedi solo la <strong>tua</strong> scheda</li>
                  <li>I <strong>Team Leader</strong> vedono le schede dei membri della propria area</li>
                  <li>Solo gli <strong>Admin</strong> possono creare/modificare obiettivi e note trimestrali (Impostazioni → Performance Reviews)</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-12">
              <AccordionTrigger>Cos'è la banca ore e come si legge il previsionale?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>La <strong>Banca Ore</strong> nel Profilo mostra il saldo annuale calcolato come <strong>(ore confermate + rettifiche) − ore attese − ore recuperate</strong>. Le <strong>ore attese</strong> sono quelle dovute da contratto (in base ai periodi contrattuali registrati), le <strong>rettifiche</strong> sono le correzioni manuali mensili dell'admin e le <strong>ore recuperate</strong> sono quelle già prese come recupero su Larin OFF.</p>
                <p>Il <strong>previsionale</strong> proietta il saldo a fine mese sommando le ore già <strong>pianificate a calendario</strong> nei giorni rimanenti (attenzione: le ore pianificate non sono le ore attese e non entrano nel saldo) — utile per capire in anticipo se chiuderai il mese in positivo o negativo.</p>

                <p>Le ferie/recuperi vanno registrati sul progetto speciale <strong>Larin OFF</strong>.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-13">
              <AccordionTrigger>Come si attivano le notifiche Slack/email?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Le notifiche <strong>Slack</strong> sono configurate a livello di sistema (admin) e si attivano automaticamente per: nuovo progetto, aggiornamenti progresso, completamento progetto.</p>
                <p>Le notifiche <strong>email/in-app</strong> personali sono gestite dal tuo Profilo → Notifiche: puoi attivare/disattivare ogni tipo (margini, scadenze, budget, reminder timesheet, ecc.) per ciascun canale.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-14">
              <AccordionTrigger>Come funziona la simulazione ruolo?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Solo gli <strong>Admin</strong> possono simulare un ruolo:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Vai in <strong>Impostazioni → Gestione Utenti</strong></li>
                  <li>Clicca sull'icona di simulazione accanto a un utente</li>
                  <li>Un banner in alto mostra il ruolo simulato; l'interfaccia si adatta ai permessi corrispondenti</li>
                  <li>Clicca "Termina simulazione" per tornare al tuo ruolo</li>
                </ol>
                <p className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <strong className="text-foreground">⚠️ Importante:</strong> la simulazione è solo <strong>visuale</strong>. Le azioni eseguite mantengono i permessi del tuo ruolo reale, per motivi di sicurezza.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-15">
              <AccordionTrigger>Cosa significa "Progetto Approvato critico"?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Nella pagina <strong>Progetti Approvati</strong> un progetto è marcato <strong>critico</strong> quando si verifica almeno una di queste condizioni:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Budget consumato <strong>oltre l'85%</strong> rispetto al Budget Target</li>
                  <li><strong>Meno di 7 giorni</strong> alla deadline</li>
                  <li>Margine effettivo sotto la soglia di allarme configurata</li>
                </ul>
                <p>Usa questa pagina per intervenire prima che la criticità degeneri (es. rinegoziare scope, aggiungere risorse, parlare col cliente).</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-16">
              <AccordionTrigger>Dove sono finiti i Preventivi?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>La sezione Preventivi è stata dismessa: tutti i documenti commerciali sono ora <strong>Offerte</strong>, in <strong>Finanza → Offerte</strong>.</p>
                <p>Ogni budget genera automaticamente un'offerta in bozza, quindi il pulsante "Genera preventivo" non esiste più. I documenti storici restano consultabili dalle offerte migrate.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-17">
              <AccordionTrigger>Ho firmato un'offerta fuori dalla piattaforma: come la approvo?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Apri l'offerta e usa <strong>"Registra esito manuale"</strong>: puoi impostare Accettata o Rifiutata indicando data e note, senza passare dal link pubblico.</p>
                <p>All'accettazione partono comunque le automazioni: creazione progetto, copia attività, cartella Drive e numero offerta sul progetto.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-18">
              <AccordionTrigger>Posso modificare nome e descrizione di un prodotto nell'offerta?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Sì. Ogni riga parte da un prodotto del listino ma titolo, descrizione e prezzo sono modificabili; la <strong>categoria di ricavo</strong> si seleziona tra quelle disponibili ed è precompilata dal prodotto.</p>
                <p>Le statistiche del cruscotto restano collegate al <strong>prodotto originale</strong>, quindi le personalizzazioni non falsano i dati sui prodotti venduti.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-19">
              <AccordionTrigger>Come funziona il Planner settimanale?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Nel Calendario scegli la vista <strong>Planner</strong>: pianifichi le ore per giorno trascinando attività e task dalla sidebar, oppure con "Aggiungi attività".</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Trascina una riga sulle aree "settimana precedente/successiva" per spostare la pianificazione</li>
                  <li><strong>Conferma le ore</strong> direttamente dal Planner</li>
                  <li>Il riepilogo per progetto mostra pianificate totali, pianificate settimana e confermate settimana</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-20">
              <AccordionTrigger>Perché una task richiede sempre un'attività prevista?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Il collegamento a una voce di budget è <strong>obbligatorio</strong> così le ore lavorate sulle task confluiscono nel consuntivo del progetto e nel calcolo del margine.</p>
                <p>Se l'attività giusta non esiste, aggiungila prima nel canvas del progetto e poi crea la task.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </section>
  );
}

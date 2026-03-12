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
                  <li>Duplicare il budget originale e creare una variante per un nuovo preventivo</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-2">
              <AccordionTrigger>Come funziona il calcolo dei margini?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Il sistema calcola i margini confrontando:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Ricavo previsto:</strong> totale del preventivo approvato</li>
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
                  <li><strong>Preventivi:</strong> genera PDF professionali</li>
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
                <p>Puoi generare un <strong>link pubblico</strong> per la timesheet di un progetto:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Apri il Canvas del progetto</li>
                  <li>Vai alla sezione Timesheet</li>
                  <li>Clicca su "Genera link pubblico"</li>
                  <li>Condividi il link con stakeholder esterni</li>
                </ol>
                <p>Il link mostra una vista di sola lettura delle ore registrate, senza rivelare informazioni finanziarie sensibili.</p>
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
          </Accordion>
        </CardContent>
      </Card>
    </section>
  );
}

import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertTriangle } from 'lucide-react';

export function TroubleshootingSection() {
  return (
    <section id="troubleshooting" className="scroll-mt-20 mb-12">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <AlertTriangle className="h-6 w-6 text-primary" />
        Troubleshooting
      </h2>

      <Card variant="static">
        <CardContent className="pt-6">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="ts-1">
              <AccordionTrigger>Non riesco ad accedere dopo la registrazione</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>Causa probabile:</strong> Il tuo account non è ancora stato approvato da un amministratore.</p>
                <p><strong>Soluzione:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Verifica di aver confermato l'email (controlla spam/promozioni)</li>
                  <li>Contatta un amministratore per richiedere l'approvazione</li>
                  <li>Se hai dimenticato la password, usa "Password dimenticata" nella pagina di login</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ts-2">
              <AccordionTrigger>Non vedo tutte le sezioni del menu</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>Causa probabile:</strong> Il tuo ruolo non ha accesso a quelle sezioni.</p>
                <p><strong>Soluzione:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Verifica il tuo ruolo nella sezione Profilo</li>
                  <li>Consulta la tabella "Ruoli e Permessi" in questa documentazione</li>
                  <li>Se ritieni che il tuo ruolo sia errato, contatta un amministratore</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ts-3">
              <AccordionTrigger>Google Calendar non si sincronizza</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>Soluzioni possibili:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Verifica che l'integrazione sia ancora connessa in Impostazioni → Google Calendar</li>
                  <li>Prova a disconnettere e riconnettere l'account Google</li>
                  <li>Verifica di aver selezionato almeno un calendario da sincronizzare</li>
                  <li>Controlla che il tuo account Google non abbia revocato i permessi dell'app</li>
                  <li>Attendi qualche minuto: la sincronizzazione potrebbe avere un breve ritardo</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ts-4">
              <AccordionTrigger>Il preventivo PDF non si genera correttamente</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>Soluzioni possibili:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Verifica che il budget abbia almeno un'attività con ore e tariffa compilate</li>
                  <li>Controlla che il cliente sia stato assegnato al budget</li>
                  <li>Se il PDF è vuoto, prova a ricaricare la pagina e rigenerare</li>
                  <li>Verifica che il browser non stia bloccando i popup (il PDF si apre in una nuova scheda)</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ts-5">
              <AccordionTrigger>I dati della dashboard non si aggiornano</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>Soluzioni possibili:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Verifica il filtro date selezionato: potresti star visualizzando un periodo diverso</li>
                  <li>Ricarica la pagina (F5 o Ctrl+R)</li>
                  <li>Verifica la connessione internet</li>
                  <li>Se il problema persiste, esci e rientra nell'applicazione</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ts-6">
              <AccordionTrigger>Non riesco a modificare un progetto</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>Cause possibili:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Permessi insufficienti:</strong> Il tuo ruolo potrebbe non avere il permesso <code>canEditProjects</code></li>
                  <li><strong>Progetto completato:</strong> Alcuni campi non sono modificabili dopo la chiusura del progetto</li>
                  <li><strong>Non sei nel team:</strong> I Member possono modificare solo i progetti a cui sono assegnati (o di cui sono Project Leader)</li>
                </ul>
                <p>Contatta un Admin o il Project Leader per assistenza.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ts-7">
              <AccordionTrigger>Le ore nel calendario non corrispondono alla timesheet</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>Spiegazione:</strong> La timesheet calcola le ore dalla differenza tra orario di inizio e fine registrati. Se le attività nel calendario hanno orari diversi da quelli effettivamente lavorati:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Verifica che l'orario di inizio e fine delle attività sia corretto</li>
                  <li>Modifica l'attività nel calendario per correggere gli orari</li>
                  <li>Se hai importato ore da Excel, verifica il formato del file</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ts-8">
              <AccordionTrigger>HubSpot non sincronizza i clienti</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>Soluzioni possibili:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Verifica che il token HubSpot sia valido in Impostazioni → HubSpot</li>
                  <li>Controlla le mappature dei campi: i campi obbligatori devono essere mappati</li>
                  <li>Verifica che gli owner HubSpot siano correttamente collegati agli utenti TimeTrap</li>
                  <li>Controlla i log della sincronizzazione per eventuali errori</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ts-9">
              <AccordionTrigger>Non ricevo più notifiche email/in-app</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>Soluzioni possibili:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Vai su <strong>Profilo → Preferenze Notifiche</strong> e verifica che il tipo di notifica e il canale (email/in-app) siano abilitati</li>
                  <li>Per le email: controlla la cartella spam/promozioni — il mittente è <code>noreply@timetrap.it</code></li>
                  <li>Verifica che la tua email nel Profilo sia corretta e attiva</li>
                  <li>Se sei un nuovo utente, ricorda che Supabase Auth ha un <strong>rate limit</strong> di 1 email al minuto per mittente</li>
                  <li>Per i reminder automatici (timesheet, pianificazione): contatta un Admin per verificare che i cron job siano attivi</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ts-10">
              <AccordionTrigger>Non vedo il mio progetto nel dialog "Nuova attività"</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>Spiegazione:</strong> Il dialog mostra solo i progetti che soddisfano <strong>entrambe</strong> le condizioni:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Stato del progetto = <strong>Aperto</strong> (sono esclusi "in partenza", "da fatturare" e "completato")</li>
                  <li>Sei <strong>Project Leader</strong> oppure <strong>membro del team</strong> di quel progetto</li>
                </ul>
                <p><strong>Soluzioni:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Verifica lo stato del progetto: se è in "in partenza", chiedi all'Admin/Leader di passarlo ad "Aperto"</li>
                  <li>Verifica di essere nel team: chiedi al Project Leader o a un Admin di aggiungerti</li>
                  <li>Se sei il Project Leader, dovresti vedere il progetto anche senza essere nel team — controlla che <code>project_leader_id</code> sia impostato correttamente</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ts-11">
              <AccordionTrigger>Le ore della Banca Ore sembrano sbagliate</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>Cose da controllare:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Periodi contrattuali:</strong> se hai cambiato ore o tipo contratto durante l'anno, verifica che i <code>user_contract_periods</code> siano configurati correttamente con date di validità</li>
                  <li><strong>Larin OFF:</strong> ferie, permessi e recuperi devono essere registrati sul progetto speciale "Larin OFF". Se hai inserito assenze su un progetto normale, il calcolo del saldo sarà errato</li>
                  <li><strong>Ore confermate:</strong> includono <em>tutto</em> il tempo tracciato (anche le attività di banca ore stessa). Se vedi un saldo gonfiato, verifica di non aver duplicato registrazioni</li>
                  <li><strong>Saldi negativi:</strong> sono normali a inizio mese; controlla il previsionale per la proiezione finale</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ts-12">
              <AccordionTrigger>Sync Google Sheet/HubSpot non aggiorna</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>Cose da controllare:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Frequenza:</strong> il sync clienti gira ogni <strong>6 ore</strong>, il sync trattative draft <strong>3 volte al giorno</strong>. Aspetta il prossimo ciclo</li>
                  <li><strong>Mapping HubSpot Owner:</strong> verifica in Impostazioni → HubSpot che gli owner siano collegati agli utenti TimeTrap, altrimenti i record vengono saltati</li>
                  <li><strong>Foglio sorgente:</strong> verifica che il Google Sheet sia ancora condiviso col service account e che i nomi delle colonne corrispondano</li>
                  <li><strong>Cron jobs:</strong> contatta un Admin per controllare i log delle Edge Functions e l'autenticazione <code>CRON_SECRET</code></li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </section>
  );
}

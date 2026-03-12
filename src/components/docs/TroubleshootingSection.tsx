import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
                  <li><strong>Non sei nel team:</strong> I Member possono modificare solo i progetti a cui sono assegnati</li>
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
          </Accordion>
        </CardContent>
      </Card>
    </section>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Rocket, UserCheck, Layout, FolderKanban, Calendar } from 'lucide-react';

export function QuickStartSection() {
  return (
    <>
      <section id="quick-start" className="scroll-mt-20 mb-12">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Rocket className="h-6 w-6 text-primary" />
          Quick Start
        </h2>
        <p className="text-muted-foreground mb-8">
          Inizia a usare TimeTrap in 4 passaggi. Questa guida rapida ti accompagna dalla registrazione alla prima pianificazione.
        </p>
      </section>

      {/* Step 1 – Primo accesso */}
      <section id="qs-primo-accesso" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Badge className="h-8 w-8 rounded-full flex items-center justify-center text-lg font-bold shrink-0">1</Badge>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                Primo accesso
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>Registrazione:</strong> Clicca su "Registrati" nella pagina di login. Inserisci nome, cognome, email aziendale e una password sicura.
            </p>
            <p>
              <strong>Conferma email:</strong> Riceverai un'email di conferma. Clicca sul link per verificare il tuo account.
            </p>
            <p>
              <strong>Approvazione admin:</strong> Dopo la conferma, il tuo account deve essere approvato da un amministratore. 
              Riceverai una notifica quando l'accesso sarà abilitato.
            </p>
            <p>
              <strong>Primo login:</strong> Una volta approvato, accedi con le tue credenziali. Verrai indirizzato alla Dashboard personalizzata in base al tuo ruolo.
            </p>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
              <strong className="text-foreground">💡 Suggerimento:</strong> Completa subito il tuo profilo (Impostazioni → Profilo) inserendo la tua tariffa oraria e le ore contrattuali. 
              Questo permette calcoli accurati di margini e produttività.
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Step 2 – Panoramica */}
      <section id="qs-panoramica" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Badge className="h-8 w-8 rounded-full flex items-center justify-center text-lg font-bold shrink-0">2</Badge>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5 text-primary" />
                Panoramica interfaccia
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>L'interfaccia è organizzata in sezioni accessibili dalla sidebar di navigazione. Ogni ruolo vede un set diverso di menu:</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="border rounded-lg p-3 space-y-1">
                <p className="font-medium text-foreground">Admin</p>
                <p>Dashboard (Operations + Finance), Budget, Preventivi, Progetti, Calendario, Workload, Workflows, Impostazioni complete</p>
              </div>
              <div className="border rounded-lg p-3 space-y-1">
                <p className="font-medium text-foreground">Account</p>
                <p>Dashboard (Recap + Budget & Quote), Budget, Preventivi, Progetti (sola lettura), Calendario, Impostazioni parziali</p>
              </div>
              <div className="border rounded-lg p-3 space-y-1">
                <p className="font-medium text-foreground">Team Leader</p>
                <p>Dashboard Team, Budget, Progetti, Calendario, Workload, Impostazioni parziali</p>
              </div>
              <div className="border rounded-lg p-3 space-y-1">
                <p className="font-medium text-foreground">Member</p>
                <p>Dashboard personale, Calendario, Progetti assegnati (sola lettura)</p>
              </div>
              <div className="border rounded-lg p-3 space-y-1">
                <p className="font-medium text-foreground">Finance</p>
                <p>Dashboard Finance, Preventivi, Progetti (campi finanziari)</p>
              </div>
              <div className="border rounded-lg p-3 space-y-1">
                <p className="font-medium text-foreground">Coordinator</p>
                <p>Budget (modifica), Progetti (modifica), Calendario, Impostazioni parziali</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Step 3 – Primo budget */}
      <section id="qs-primo-budget" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Badge className="h-8 w-8 rounded-full flex items-center justify-center text-lg font-bold shrink-0">3</Badge>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-primary" />
                Crea il primo budget
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li>Vai alla sezione <strong>Budget</strong> dal menu laterale</li>
              <li>Clicca su <strong>"Nuovo Budget"</strong> in alto a destra</li>
              <li>Compila i campi obbligatori: nome progetto, tipo progetto, disciplina</li>
              <li>Seleziona un <strong>cliente</strong> (o creane uno nuovo)</li>
              <li>Opzionale: seleziona un <strong>template</strong> per pre-compilare le attività</li>
              <li>Clicca <strong>"Crea Budget"</strong></li>
            </ol>
            <p className="mt-3">
              Una volta creato, si apre la scheda di dettaglio del budget. Da qui puoi:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Aggiungere <strong>categorie</strong> e <strong>attività</strong></li>
              <li>Assegnare <strong>risorse</strong> con livello e tariffa oraria</li>
              <li>Impostare <strong>ore previste</strong> per ogni attività</li>
              <li>Aggiungere <strong>prodotti</strong> con prezzo fisso</li>
              <li>Definire <strong>margine</strong> e <strong>sconto</strong></li>
              <li>Generare il <strong>preventivo PDF</strong></li>
            </ul>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
              <strong className="text-foreground">💡 Workflow completo:</strong> Budget (bozza) → Genera Preventivo → Approva budget → Si crea il Progetto automaticamente.
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Step 4 – Calendario */}
      <section id="qs-calendario" className="scroll-mt-20 mb-10">
        <Card variant="static">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Badge className="h-8 w-8 rounded-full flex items-center justify-center text-lg font-bold shrink-0">4</Badge>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Pianifica nel calendario
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li>Vai alla sezione <strong>Calendario</strong></li>
              <li>Seleziona la vista <strong>giornaliera</strong> o <strong>settimanale</strong></li>
              <li>Clicca su uno slot orario per creare una nuova attività</li>
              <li>Seleziona il <strong>progetto</strong> e l'<strong>attività</strong> da pianificare</li>
              <li>Imposta <strong>data</strong>, <strong>ora inizio</strong> e <strong>ora fine</strong></li>
              <li>Le ore vengono automaticamente tracciate e confrontate col budget</li>
            </ol>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
              <strong className="text-foreground">💡 Google Calendar:</strong> Puoi integrare Google Calendar dalle Impostazioni per sincronizzare gli eventi.
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

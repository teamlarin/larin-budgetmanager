import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot, BrainCircuit, Bell, Mail, MessageSquare, Webhook, AlertTriangle } from 'lucide-react';

export function AiAutomationsSection() {
  return (
    <section id="ai-automazioni" className="scroll-mt-20 mb-12">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Bot className="h-6 w-6 text-primary" />
        AI e Automazioni
      </h2>

      <div className="space-y-6">
        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" />Chat AI</CardTitle>
            <CardDescription>Interroga i tuoi dati con il linguaggio naturale</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Il widget Chat AI (icona in basso a destra) ti permette di fare domande sui tuoi dati in linguaggio naturale. Esempi:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>"Quali progetti hanno un margine sotto il 20%?"</li>
              <li>"Quante ore ha lavorato Marco questa settimana?"</li>
              <li>"Mostrami i budget in attesa per il cliente XYZ"</li>
              <li>"Qual è il fatturato previsto per questo trimestre?"</li>
            </ul>
            <p>L'AI esegue solo query in <strong>sola lettura</strong> con sanitizzazione SQL, garantendo che non possa modificare dati.</p>
          </CardContent>
        </Card>

        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" />AI Insights Panel</CardTitle>
            <CardDescription>Analisi intelligente personalizzata per ruolo</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Nella Dashboard, il pannello AI Insights genera analisi on-demand <strong>specifiche per il tuo ruolo</strong> (Admin, Team Leader, Account, Member):</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Clicca <strong>"Genera Insights"</strong> per ricevere un riepilogo intelligente</li>
              <li>L'analisi include: progetti critici, pattern di utilizzo risorse, previsioni sforamento</li>
              <li>I risultati vengono memorizzati in <strong>cache locale per ruolo</strong> per evitare chiamate ripetute</li>
              <li>Clicca <strong>"Chiudi"</strong> per nascondere il pannello</li>
            </ul>
          </CardContent>
        </Card>

        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Riepilogo settimanale AI</CardTitle>
            <CardDescription>Ogni lunedì alle 09:00</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Ogni lunedì mattina alle 09:00 il sistema invia automaticamente un riepilogo via email generato dall'AI con:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Panoramica dei progetti attivi e il loro stato</li>
              <li>Progetti con margine critico o in ritardo</li>
              <li>Riepilogo ore lavorate dal team</li>
              <li>Suggerimenti e azioni da intraprendere</li>
            </ul>
          </CardContent>
        </Card>

        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-primary" />Notifiche progressive di budget</CardTitle>
            <CardDescription>Alert automatici 50/75/90/100% + proiezione</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Il sistema monitora costantemente il consumo del Budget Target (= 70% costo attività) e invia notifiche progressive:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>50%</strong> consumato → info</li>
              <li><strong>75%</strong> consumato → warning</li>
              <li><strong>90%</strong> consumato → critical</li>
              <li><strong>100%</strong> superato → sforamento</li>
            </ul>
            <p>In più, il sistema calcola la <strong>proiezione</strong> a fine progetto basandosi sul ritmo di consumo:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>&gt;+10%</strong> proiezione vs target → warning</li>
              <li><strong>&gt;+25%</strong> proiezione vs target → critical</li>
            </ul>
          </CardContent>
        </Card>

        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Promemoria automatici</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Cron job autenticati via <code>CRON_SECRET</code> inviano periodicamente:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Reminder timesheet:</strong> ultimo giorno del mese, per gli utenti che non hanno ancora compilato</li>
              <li><strong>Reminder pianificazione settimanale:</strong> ogni venerdì, per pianificare la settimana successiva</li>
              <li><strong>Margini critici:</strong> alert quando un progetto scende sotto la soglia configurata</li>
              <li><strong>Scadenze progetti:</strong> alert quando un progetto si avvicina alla deadline</li>
              <li><strong>Aggiornamenti budget:</strong> notifica quando un budget viene approvato/rifiutato</li>
            </ul>
            <p>Puoi configurare le preferenze di notifica (in-app e email) dal tuo profilo.</p>
          </CardContent>
        </Card>

        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" />Notifiche Slack</CardTitle>
            <CardDescription>Integrazione su 3 scenari</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>L'edge function <code>send-slack-notification</code> invia messaggi su canali Slack dedicati per:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Nuovo progetto:</strong> avviso quando un budget viene approvato e diventa progetto</li>
              <li><strong>Aggiornamenti progresso:</strong> notifica quando un Project Leader pubblica un progress update</li>
              <li><strong>Completamento progetto:</strong> messaggio quando un progetto passa allo stato "completato"</li>
            </ul>
            <p>Il routing dei canali (es. nuovo progetto vs aggiornamenti) è configurato lato server.</p>
          </CardContent>
        </Card>

        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5 text-primary" />Webhook Make su completamento progetto</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Quando un progetto passa allo stato <strong>completato</strong>, il sistema invia automaticamente un payload a un webhook Make (Integromat) con tutti i dati del progetto: cliente, ore, costi, margine, team, date.</p>
            <p>Utile per innescare automazioni esterne: aggiornamento CRM, generazione fattura, archiviazione documenti, comunicazioni cliente.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

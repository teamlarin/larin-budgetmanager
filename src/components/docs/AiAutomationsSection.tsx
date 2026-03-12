import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot, BrainCircuit, Bell, Mail } from 'lucide-react';

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
            <p>L'AI ha accesso ai dati dei tuoi progetti, budget, timesheet e metriche per fornirti risposte accurate e contestualizzate.</p>
          </CardContent>
        </Card>

        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" />AI Insights Panel</CardTitle>
            <CardDescription>Analisi intelligente automatica</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Nella Dashboard, il pannello AI Insights genera analisi on-demand dei tuoi dati:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Clicca <strong>"Genera Insights"</strong> per ricevere un riepilogo intelligente</li>
              <li>L'analisi include: progetti critici, pattern di utilizzo risorse, previsioni sforamento</li>
              <li>I risultati vengono memorizzati in <strong>cache</strong> per evitare chiamate ripetute</li>
              <li>Clicca <strong>"Chiudi"</strong> per nascondere il pannello</li>
            </ul>
          </CardContent>
        </Card>

        <Card variant="static">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Riepilogo settimanale AI</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Ogni settimana il sistema invia automaticamente un riepilogo via email generato dall'AI con:</p>
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
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Notifiche e automazioni</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Il sistema invia notifiche automatiche per eventi importanti:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Scadenze progetti:</strong> alert quando un progetto si avvicina alla deadline</li>
              <li><strong>Margine critico:</strong> notifica quando il margine scende sotto la soglia configurata</li>
              <li><strong>Aggiornamenti budget:</strong> notifica quando un budget viene approvato/rifiutato</li>
              <li><strong>Reminder timesheet:</strong> promemoria mensile per la compilazione delle ore</li>
              <li><strong>Reminder pianificazione:</strong> promemoria settimanale per pianificare la settimana</li>
            </ul>
            <p>Puoi configurare le preferenze di notifica (in-app e email) dal tuo profilo.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

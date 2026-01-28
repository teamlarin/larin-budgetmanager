import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { 
  FolderKanban, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  Users, 
  Clock, 
  TrendingUp,
  HelpCircle,
  Rocket,
  Target,
  BarChart3
} from "lucide-react";

const Help = () => {
  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-2 mb-4">
          <HelpCircle className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Centro Assistenza</h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Benvenuto nella guida di TimeTrap. Qui troverai tutto ciò che ti serve per gestire 
          budget, progetti e preventivi in modo efficiente.
        </p>
      </div>

      {/* Introduzione */}
      <section className="mb-12">
        <Card variant="static" className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Cos'è TimeTrap?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              TimeTrap è una piattaforma completa per la gestione dei progetti e del budget aziendale. 
              Ti permette di creare preventivi, tracciare le ore lavorate, monitorare i margini di profitto 
              e gestire le attività del team in un'unica interfaccia intuitiva. Ideale per agenzie, studi 
              professionali e team che vogliono ottimizzare la gestione delle risorse.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Guida Rapida */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          <Rocket className="h-6 w-6 text-primary" />
          Guida Rapida
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader variant="compact">
              <div className="flex items-center gap-3">
                <Badge className="h-8 w-8 rounded-full flex items-center justify-center text-lg font-bold">1</Badge>
                <CardTitle className="text-lg">Crea un Budget</CardTitle>
              </div>
            </CardHeader>
            <CardContent variant="compact">
              <p className="text-sm text-muted-foreground">
                Vai alla sezione <strong>Budget</strong> e clicca su "Nuovo Budget". 
                Inserisci il nome del progetto, seleziona il cliente e definisci le attività con ore e costi.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader variant="compact">
              <div className="flex items-center gap-3">
                <Badge className="h-8 w-8 rounded-full flex items-center justify-center text-lg font-bold">2</Badge>
                <CardTitle className="text-lg">Genera il Preventivo</CardTitle>
              </div>
            </CardHeader>
            <CardContent variant="compact">
              <p className="text-sm text-muted-foreground">
                Dalla pagina del budget, clicca su "Genera Preventivo". 
                Potrai personalizzare margini, sconti e modalità di pagamento prima di esportare il PDF.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader variant="compact">
              <div className="flex items-center gap-3">
                <Badge className="h-8 w-8 rounded-full flex items-center justify-center text-lg font-bold">3</Badge>
                <CardTitle className="text-lg">Traccia le Ore</CardTitle>
              </div>
            </CardHeader>
            <CardContent variant="compact">
              <p className="text-sm text-muted-foreground">
                Usa il <strong>Calendario</strong> per pianificare le attività. 
                Le ore vengono tracciate automaticamente e confrontate con il budget previsto.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Funzionalità Principali */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Funzionalità Principali
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FolderKanban className="h-5 w-5 text-primary" />
                Gestione Budget
              </CardTitle>
              <CardDescription>
                Pianifica e controlla i costi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Crea budget dettagliati con categorie e attività</li>
                <li>• Assegna risorse e tariffe orarie personalizzate</li>
                <li>• Monitora in tempo reale ore consumate vs previste</li>
                <li>• Usa template predefiniti per velocizzare la creazione</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-secondary" />
                Preventivi e Quote
              </CardTitle>
              <CardDescription>
                Genera documenti professionali
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Genera preventivi PDF dal budget in un click</li>
                <li>• Applica margini e sconti personalizzati</li>
                <li>• Gestisci modalità e termini di pagamento</li>
                <li>• Traccia lo stato: bozza, inviato, approvato, rifiutato</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-accent-foreground" />
                Calendario e Timesheet
              </CardTitle>
              <CardDescription>
                Pianifica e traccia il lavoro
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Visualizza attività in calendario giornaliero/settimanale</li>
                <li>• Integrazione con Google Calendar</li>
                <li>• Tracciamento ore automatico per progetto</li>
                <li>• Vista multi-utente per coordinare il team</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Analisi e Margini
              </CardTitle>
              <CardDescription>
                Monitora la redditività
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Dashboard con KPI e metriche chiave</li>
                <li>• Calcolo automatico margini di profitto</li>
                <li>• Alert su progetti a rischio sforamento</li>
                <li>• Report esportabili per l'analisi finanziaria</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-primary" />
          Domande Frequenti
        </h2>
        <Card variant="static">
          <CardContent className="pt-6">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>
                  Come posso modificare un budget già approvato?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground">
                    Una volta che un budget viene approvato e convertito in progetto, le modifiche 
                    strutturali sono limitate per mantenere la coerenza dei dati. Tuttavia, puoi:
                  </p>
                  <ul className="list-disc list-inside mt-2 text-muted-foreground">
                    <li>Aggiungere costi aggiuntivi nella sezione dedicata del progetto</li>
                    <li>Creare attività manuali per lavori extra</li>
                    <li>Se necessario, duplicare il budget originale e creare una variante</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger>
                  Come funziona il calcolo dei margini?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground">
                    Il sistema calcola automaticamente i margini confrontando:
                  </p>
                  <ul className="list-disc list-inside mt-2 text-muted-foreground">
                    <li><strong>Ricavo previsto:</strong> totale del preventivo approvato</li>
                    <li><strong>Costo effettivo:</strong> ore lavorate × tariffa oraria del collaboratore + costi aggiuntivi</li>
                    <li><strong>Margine:</strong> (Ricavo - Costo) / Ricavo × 100</li>
                  </ul>
                  <p className="mt-2 text-muted-foreground">
                    Puoi configurare soglie di allarme nelle Impostazioni per ricevere notifiche 
                    quando un progetto rischia di andare in perdita.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger>
                  Posso esportare i dati in Excel?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground">
                    Sì! Diverse sezioni dell'applicazione supportano l'esportazione:
                  </p>
                  <ul className="list-disc list-inside mt-2 text-muted-foreground">
                    <li><strong>Timesheet:</strong> esporta le ore lavorate in formato Excel</li>
                    <li><strong>Progetti:</strong> scarica il riepilogo con margini e costi</li>
                    <li><strong>Preventivi:</strong> genera PDF professionali</li>
                  </ul>
                  <p className="mt-2 text-muted-foreground">
                    Cerca l'icona di download o esportazione nelle rispettive sezioni.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger>
                  Come gestisco i permessi degli utenti?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground">
                    TimeTrap utilizza un sistema di ruoli per gestire i permessi:
                  </p>
                  <ul className="list-disc list-inside mt-2 text-muted-foreground">
                    <li><strong>Admin:</strong> accesso completo a tutte le funzionalità</li>
                    <li><strong>Account:</strong> gestione budget, preventivi e clienti</li>
                    <li><strong>Team Leader:</strong> supervisione progetti e team</li>
                    <li><strong>Member:</strong> visualizzazione calendario e inserimento ore</li>
                  </ul>
                  <p className="mt-2 text-muted-foreground">
                    Gli admin possono modificare i ruoli in Impostazioni → Gestione Utenti. 
                    È anche possibile simulare un ruolo per testare i permessi.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5">
                <AccordionTrigger>
                  Come collego Google Calendar?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground">
                    Per sincronizzare il tuo Google Calendar:
                  </p>
                  <ol className="list-decimal list-inside mt-2 text-muted-foreground">
                    <li>Vai su Impostazioni → Integrazioni → Google Calendar</li>
                    <li>Clicca su "Connetti" e autorizza l'accesso</li>
                    <li>Seleziona i calendari da sincronizzare</li>
                    <li>Gli eventi appariranno automaticamente nella tua vista calendario</li>
                  </ol>
                  <p className="mt-2 text-muted-foreground">
                    La sincronizzazione è bidirezionale: le attività create in TimeTrap 
                    possono essere visualizzate anche in Google Calendar.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Footer Help */}
      <section className="text-center py-8 border-t">
        <p className="text-muted-foreground">
          Non hai trovato quello che cercavi? Scrivi nel channel Slack <span className="font-semibold text-primary">#larin-timetrap</span>
        </p>
      </section>
    </div>
  );
};

export default Help;

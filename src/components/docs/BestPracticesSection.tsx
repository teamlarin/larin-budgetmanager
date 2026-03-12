import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star } from 'lucide-react';

export function BestPracticesSection() {
  return (
    <section id="best-practices" className="scroll-mt-20 mb-12">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Star className="h-6 w-6 text-primary" />
        Best Practices
      </h2>

      <div className="space-y-6">
        <Card variant="static">
          <CardHeader><CardTitle className="text-lg">Struttura budget ottimale</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Usa categorie coerenti:</strong> Mantieni un set standard di categorie (es. Strategy, Creative, Development, PM, Media) per confrontare i budget tra progetti diversi</li>
              <li><strong>Granularità attività:</strong> Non essere troppo generico né troppo dettagliato. Ogni attività dovrebbe corrispondere a un deliverable misurabile</li>
              <li><strong>Assegna sempre le risorse:</strong> Collegare ogni attività a un assegnatario aiuta il tracciamento e la pianificazione</li>
              <li><strong>Usa i template:</strong> Crea template per tipologie di progetto ricorrenti (es. "Campagna Social", "Restyling Brand") per velocizzare la creazione</li>
              <li><strong>Prodotti separati:</strong> Usa la funzionalità "Prodotto" per costi fissi (licenze, tool) anziché stimarli come ore</li>
            </ul>
          </CardContent>
        </Card>

        <Card variant="static">
          <CardHeader><CardTitle className="text-lg">Naming conventions</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Budget/Progetti:</strong> [Cliente] – [Tipo progetto] – [Breve descrizione] (es. "Acme Corp – Social Campaign – Q1 2026")</li>
              <li><strong>Attività:</strong> Usa nomi chiari e actionable (es. "Creazione concept grafico", non "Grafica")</li>
              <li><strong>Categorie:</strong> Nomi brevi e standardizzati. Evita abbreviazioni ambigue</li>
              <li><strong>Template:</strong> Includi la disciplina nel nome (es. "Template Digital – Campagna Social")</li>
            </ul>
          </CardContent>
        </Card>

        <Card variant="static">
          <CardHeader><CardTitle className="text-lg">Gestione margini</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Margine realistico:</strong> Imposta margini coerenti con il mercato e il tipo di cliente (es. 25-35% per progetti standard)</li>
              <li><strong>Monitora in tempo reale:</strong> Controlla regolarmente il margine effettivo nella Dashboard e nel Canvas del progetto</li>
              <li><strong>Soglie di allarme:</strong> Configura le soglie warning (es. 20%) e critical (es. 10%) nelle impostazioni di ogni progetto</li>
              <li><strong>Costi aggiuntivi:</strong> Registra tempestivamente ogni spesa extra per avere margini accurati</li>
            </ul>
          </CardContent>
        </Card>

        <Card variant="static">
          <CardHeader><CardTitle className="text-lg">Pianificazione team</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Pianifica settimanalmente:</strong> All'inizio di ogni settimana, verifica il Workload e pianifica le attività nel calendario</li>
              <li><strong>Non superare l'80%:</strong> Lascia un buffer del 20% delle ore contrattuali per imprevisti e attività non pianificabili</li>
              <li><strong>Usa la vista multi-utente:</strong> I Team Leader dovrebbero usare la vista multi-utente per bilanciare il carico tra i membri</li>
              <li><strong>Aggiorna i progress:</strong> Invita il team a compilare gli aggiornamenti di progresso regolarmente per avere una visione accurata</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

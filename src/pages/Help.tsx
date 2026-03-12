import { HelpCircle, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocSidebar } from '@/components/docs/DocSidebar';
import { ChangelogSection } from '@/components/docs/ChangelogSection';
import { QuickStartSection } from '@/components/docs/QuickStartSection';
import { ManualSections } from '@/components/docs/ManualSections';
import { RolesPermissionsSection } from '@/components/docs/RolesPermissionsSection';
import { AiAutomationsSection } from '@/components/docs/AiAutomationsSection';
import { BestPracticesSection } from '@/components/docs/BestPracticesSection';
import { FaqSection } from '@/components/docs/FaqSection';
import { TroubleshootingSection } from '@/components/docs/TroubleshootingSection';

const Help = () => {
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-2 mb-4">
          <HelpCircle className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Documentazione TimeTrap</h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Guida completa per gestire budget, progetti e preventivi in modo efficiente.
        </p>
      </div>

      {/* Intro card */}
      <div className="mb-12">
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
      </div>

      {/* Two-column layout */}
      <div className="flex gap-8">
        <DocSidebar />

        <main className="flex-1 min-w-0">
          <QuickStartSection />
          <ManualSections />
          <RolesPermissionsSection />
          <AiAutomationsSection />
          <BestPracticesSection />
          <FaqSection />
          <TroubleshootingSection />

          {/* Footer */}
          <section className="text-center py-8 border-t">
            <p className="text-muted-foreground">
              Non hai trovato quello che cercavi? Scrivi nel channel Slack{' '}
              <span className="font-semibold text-primary">#larin-timetrap</span>
            </p>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Help;

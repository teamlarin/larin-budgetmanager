import { useEffect, useState } from 'react';
import { HelpCircle, Target, Sparkles, Download, FileText, FileType2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { DocSidebar } from '@/components/docs/DocSidebar';
import { DocSearch } from '@/components/docs/DocSearch';
import { ChangelogSection } from '@/components/docs/ChangelogSection';
import { QuickStartSection } from '@/components/docs/QuickStartSection';
import { ManualSections } from '@/components/docs/ManualSections';
import { RolesPermissionsSection } from '@/components/docs/RolesPermissionsSection';
import { AiAutomationsSection } from '@/components/docs/AiAutomationsSection';
import { BestPracticesSection } from '@/components/docs/BestPracticesSection';
import { FaqSection } from '@/components/docs/FaqSection';
import { TroubleshootingSection } from '@/components/docs/TroubleshootingSection';
import { ReadingProgress } from '@/components/docs/ReadingProgress';
import { CompactToc } from '@/components/docs/CompactToc';
import { FeedbackButtons } from '@/components/docs/FeedbackButtons';
import { exportDocsToMarkdownWithAudit, downloadMarkdownFile } from '@/lib/exportDocsToMarkdown';
import { exportDocsToPdfWithAudit, downloadBlob } from '@/lib/exportDocsToPdf';

const HIGHLIGHT_CLASS = 'doc-search-highlight';

const Help = () => {
  const [exporting, setExporting] = useState<null | 'pdf' | 'md'>(null);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number; label: string } | null>(null);

  const openAi = () => {
    window.dispatchEvent(new CustomEvent('open-ai-chat'));
  };

  const todayStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const notifyMissing = (missing: string[], format: 'PDF' | 'Markdown') => {
    if (missing.length === 0) return;
    toast.warning(
      `${format}: ${missing.length} sezione/i non inclusa/e`,
      { description: missing.join(', ') },
    );
  };

  const handleDownloadMarkdown = async () => {
    setExporting('md');
    try {
      const { markdown, missingSectionIds } = exportDocsToMarkdownWithAudit();
      downloadMarkdownFile(markdown, `TimeTrap-Guida_${todayStr()}.md`);
      notifyMissing(missingSectionIds, 'Markdown');
      toast.success('Guida scaricata in Markdown');
    } catch (err) {
      console.error(err);
      toast.error('Errore durante il download Markdown');
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadPdf = async () => {
    setExporting('pdf');
    setPdfProgress({ current: 0, total: 0, label: 'Preparazione...' });
    toast.info('Generazione PDF in corso, può richiedere qualche secondo...');
    try {
      const { blob, missingSectionIds } = await exportDocsToPdfWithAudit(
        (current, total, label) => setPdfProgress({ current, total, label }),
      );
      downloadBlob(blob, `TimeTrap-Guida_${todayStr()}.pdf`);
      notifyMissing(missingSectionIds, 'PDF');
      toast.success('Guida scaricata in PDF');
    } catch (err) {
      console.error('PDF export failed, fallback to Markdown:', err);
      toast.error('Generazione PDF fallita: scaricato Markdown come fallback');
      try {
        const { markdown } = exportDocsToMarkdownWithAudit();
        downloadMarkdownFile(markdown, `TimeTrap-Guida_${todayStr()}.md`);
      } catch {
        /* noop */
      }
    } finally {
      setExporting(null);
      setPdfProgress(null);
    }
  };

  // Auto-scroll + highlight when arriving with a hash (e.g. /help#man-budget from feedback page)
  useEffect(() => {
    const id = window.location.hash.replace('#', '');
    if (!id) return;
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add(HIGHLIGHT_CLASS);
      setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), 1800);
    }, 250);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl doc-page">
      <ReadingProgress />

      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <HelpCircle className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Documentazione TimeTrap</h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Guida completa per gestire budget, progetti e preventivi in modo efficiente.
        </p>
      </div>

      {/* Search bar + Ask AI + Download */}
      <div className="sticky top-2 z-30 mb-10" data-doc-export-skip>
        <div className="bg-background/80 backdrop-blur-md rounded-xl p-3 border shadow-sm">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <DocSearch />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button onClick={openAi} variant="default" className="gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Chiedi all'assistente</span>
                <span className="sm:hidden">AI</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2" disabled={exporting !== null}>
                    {exporting !== null ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">
                      {exporting === 'pdf' && pdfProgress && pdfProgress.total > 0
                        ? `PDF ${pdfProgress.current}/${pdfProgress.total}`
                        : 'Scarica'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleDownloadPdf} disabled={exporting !== null}>
                    <FileType2 className="h-4 w-4 mr-2 text-primary" />
                    <div className="flex flex-col">
                      <span>PDF (completa)</span>
                      <span className="text-xs text-muted-foreground">Impaginata, con indice</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadMarkdown} disabled={exporting !== null}>
                    <FileText className="h-4 w-4 mr-2 text-primary" />
                    <div className="flex flex-col">
                      <span>Markdown</span>
                      <span className="text-xs text-muted-foreground">Leggero, per Slack/Notion</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Intro card */}
      <div className="mb-8">
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

      {/* Compact TOC (utile su mobile, dove la sidebar non c'è) */}
      <CompactToc />

      {/* Two-column layout */}
      <div className="flex gap-8">
        <DocSidebar />

        <main className="flex-1 min-w-0">
          <ChangelogSection />
          <QuickStartSection />
          <ManualSections />

          {/* Feedback inline al termine del manuale */}
          <section className="mb-10 doc-section-feedback" data-doc-export-skip>
            <div className="rounded-lg border bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground">
                Hai trovato utile questa parte del manuale?
              </p>
              <FeedbackButtons
                source="search"
                context="manual_inline"
                entityId="manuale"
                entityType="doc_section"
              />
            </div>
          </section>

          <RolesPermissionsSection />
          <AiAutomationsSection />
          <BestPracticesSection />
          <FaqSection />
          <TroubleshootingSection />

          {/* Footer */}
          <section className="text-center py-8 border-t" data-doc-export-skip>
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

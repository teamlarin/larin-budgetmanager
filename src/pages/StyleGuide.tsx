import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const StyleGuide = () => {
  const [copiedClass, setCopiedClass] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedClass(text);
    toast.success(`Copiato: ${text}`);
    setTimeout(() => setCopiedClass(null), 2000);
  };

  const ClassItem = ({ className, description }: { className: string; description: string }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="stack-xs">
        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">.{className}</code>
        <p className="helper-text">{description}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => copyToClipboard(className)}
        className="h-8 w-8 p-0"
      >
        {copiedClass === className ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );

  const PreviewBox = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`p-4 border rounded-lg bg-muted/30 ${className}`}>
      {children}
    </div>
  );

  return (
    <div className="page-container stack-lg">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Design System</h1>
        <p className="page-subtitle">
          Documentazione delle classi CSS riutilizzabili del design system
        </p>
      </div>

      {/* Typography Section */}
      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>Classi per la tipografia</CardDescription>
        </CardHeader>
        <CardContent className="stack-md">
          {/* Page Typography */}
          <div className="stack-sm">
            <h3 className="section-title">Page Typography</h3>
            <div className="grid-cards-sm">
              <ClassItem className="page-title" description="Titolo principale della pagina (1.875rem, bold)" />
              <ClassItem className="page-subtitle" description="Sottotitolo della pagina (sm, muted)" />
            </div>
            <PreviewBox>
              <h1 className="page-title">Esempio Page Title</h1>
              <p className="page-subtitle">Esempio page subtitle con descrizione</p>
            </PreviewBox>
          </div>

          <Separator />

          {/* Section Typography */}
          <div className="stack-sm">
            <h3 className="section-title">Section Typography</h3>
            <div className="grid-cards-sm">
              <ClassItem className="section-title" description="Titolo sezione (xl, semibold)" />
              <ClassItem className="section-subtitle" description="Sottotitolo sezione (sm, muted)" />
            </div>
            <PreviewBox>
              <h2 className="section-title">Esempio Section Title</h2>
              <p className="section-subtitle">Esempio section subtitle</p>
            </PreviewBox>
          </div>

          <Separator />

          {/* Card Typography */}
          <div className="stack-sm">
            <h3 className="section-title">Card Typography</h3>
            <div className="grid-cards-sm">
              <ClassItem className="card-title" description="Titolo card personalizzato (lg, semibold)" />
              <ClassItem className="card-description" description="Descrizione card (sm, muted)" />
            </div>
          </div>

          <Separator />

          {/* Labels & Captions */}
          <div className="stack-sm">
            <h3 className="section-title">Labels & Captions</h3>
            <div className="grid-cards-sm">
              <ClassItem className="label-text" description="Etichetta form (sm, medium)" />
              <ClassItem className="helper-text" description="Testo di aiuto (xs, muted)" />
              <ClassItem className="caption" description="Didascalia (xs, muted)" />
              <ClassItem className="meta-text" description="Metadati (xs, muted)" />
            </div>
            <PreviewBox className="stack-sm">
              <span className="label-text">Label Text</span>
              <span className="helper-text">Helper text per form</span>
              <span className="caption">Caption per immagini</span>
              <span className="meta-text">Meta: 2 ore fa</span>
            </PreviewBox>
          </div>

          <Separator />

          {/* Data Display */}
          <div className="stack-sm">
            <h3 className="section-title">Data Display</h3>
            <div className="grid-cards-sm">
              <ClassItem className="data-label" description="Label per dati (sm, muted)" />
              <ClassItem className="data-value" description="Valore dati (sm, medium)" />
              <ClassItem className="data-value-lg" description="Valore grande (2xl, bold)" />
            </div>
            <PreviewBox className="row-lg">
              <div className="stack-xs">
                <span className="data-label">Totale ore</span>
                <span className="data-value">42.5h</span>
              </div>
              <div className="stack-xs">
                <span className="data-label">Budget</span>
                <span className="data-value-lg">€12,500</span>
              </div>
            </PreviewBox>
          </div>

          <Separator />

          {/* Links */}
          <div className="stack-sm">
            <h3 className="section-title">Links</h3>
            <div className="grid-cards-sm">
              <ClassItem className="link-text" description="Link primario con hover" />
              <ClassItem className="link-muted" description="Link muted con hover" />
            </div>
            <PreviewBox className="row-md">
              <span className="link-text">Link primario</span>
              <span className="link-muted">Link muted</span>
            </PreviewBox>
          </div>
        </CardContent>
      </Card>

      {/* Layout Section */}
      <Card>
        <CardHeader>
          <CardTitle>Layout</CardTitle>
          <CardDescription>Classi per container, spacing e griglie</CardDescription>
        </CardHeader>
        <CardContent className="stack-md">
          {/* Containers */}
          <div className="stack-sm">
            <h3 className="section-title">Containers</h3>
            <div className="grid-cards-sm">
              <ClassItem className="page-container" description="Container pagina standard (p-6)" />
              <ClassItem className="page-container-sm" description="Container piccolo (max-w-4xl)" />
              <ClassItem className="page-container-lg" description="Container grande (max-w-7xl)" />
              <ClassItem className="page-container-full" description="Container full width" />
            </div>
          </div>

          <Separator />

          {/* Page Headers */}
          <div className="stack-sm">
            <h3 className="section-title">Page Headers</h3>
            <div className="grid-cards-sm">
              <ClassItem className="page-header" description="Header pagina (mb-6)" />
              <ClassItem className="page-header-lg" description="Header grande (mb-8)" />
              <ClassItem className="page-header-with-actions" description="Header con azioni (flex justify-between)" />
            </div>
          </div>

          <Separator />

          {/* Stacks (Vertical Spacing) */}
          <div className="stack-sm">
            <h3 className="section-title">Stacks (Vertical Spacing)</h3>
            <div className="grid-cards-sm">
              <ClassItem className="stack-xs" description="Stack extra small (space-y-1)" />
              <ClassItem className="stack-sm" description="Stack small (space-y-2)" />
              <ClassItem className="stack-md" description="Stack medium (space-y-4)" />
              <ClassItem className="stack-lg" description="Stack large (space-y-6)" />
              <ClassItem className="stack-xl" description="Stack extra large (space-y-8)" />
            </div>
            <PreviewBox>
              <div className="stack-md">
                <div className="p-2 bg-primary/20 rounded">Item 1</div>
                <div className="p-2 bg-primary/20 rounded">Item 2</div>
                <div className="p-2 bg-primary/20 rounded">Item 3</div>
              </div>
            </PreviewBox>
          </div>

          <Separator />

          {/* Rows (Horizontal Spacing) */}
          <div className="stack-sm">
            <h3 className="section-title">Rows (Horizontal Spacing)</h3>
            <div className="grid-cards-sm">
              <ClassItem className="row-xs" description="Row extra small (gap-1)" />
              <ClassItem className="row-sm" description="Row small (gap-2)" />
              <ClassItem className="row-md" description="Row medium (gap-4)" />
              <ClassItem className="row-lg" description="Row large (gap-6)" />
            </div>
            <PreviewBox>
              <div className="row-md">
                <div className="p-2 bg-primary/20 rounded">Item 1</div>
                <div className="p-2 bg-primary/20 rounded">Item 2</div>
                <div className="p-2 bg-primary/20 rounded">Item 3</div>
              </div>
            </PreviewBox>
          </div>

          <Separator />

          {/* Grids */}
          <div className="stack-sm">
            <h3 className="section-title">Grids</h3>
            <div className="grid-cards-sm">
              <ClassItem className="grid-cards" description="Grid cards responsive (2-3 cols)" />
              <ClassItem className="grid-cards-sm" description="Grid piccola (2 cols)" />
              <ClassItem className="grid-cards-lg" description="Grid grande (2-4 cols)" />
              <ClassItem className="grid-stats" description="Grid statistiche (2-4 cols)" />
            </div>
            <PreviewBox>
              <div className="grid-stats">
                <div className="stat-card">
                  <div className="stat-value">1,234</div>
                  <div className="stat-label">Utenti</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">567</div>
                  <div className="stat-label">Progetti</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">89</div>
                  <div className="stat-label">Attivi</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">€45k</div>
                  <div className="stat-label">Revenue</div>
                </div>
              </div>
            </PreviewBox>
          </div>

          <Separator />

          {/* Sections */}
          <div className="stack-sm">
            <h3 className="section-title">Sections</h3>
            <div className="grid-cards-sm">
              <ClassItem className="section" description="Sezione standard (py-6)" />
              <ClassItem className="section-sm" description="Sezione piccola (py-4)" />
              <ClassItem className="section-lg" description="Sezione grande (py-8)" />
              <ClassItem className="section-divider" description="Sezione con divider (border-t)" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Components Section */}
      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
          <CardDescription>Pattern comuni per componenti</CardDescription>
        </CardHeader>
        <CardContent className="stack-md">
          {/* Empty States */}
          <div className="stack-sm">
            <h3 className="section-title">Empty States</h3>
            <div className="grid-cards-sm">
              <ClassItem className="empty-state" description="Container stato vuoto (center, py-12)" />
              <ClassItem className="empty-state-icon" description="Icona stato vuoto (h-12, centered)" />
              <ClassItem className="empty-state-text" description="Testo stato vuoto (muted)" />
            </div>
            <PreviewBox>
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <p className="empty-state-text">Nessun elemento trovato</p>
              </div>
            </PreviewBox>
          </div>

          <Separator />

          {/* Stat Cards */}
          <div className="stack-sm">
            <h3 className="section-title">Stat Cards</h3>
            <div className="grid-cards-sm">
              <ClassItem className="stat-card" description="Card statistica base" />
              <ClassItem className="stat-value" description="Valore statistica (2xl, bold)" />
              <ClassItem className="stat-label" description="Label statistica (sm, muted)" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Section */}
      <Card>
        <CardHeader>
          <CardTitle>Status Indicators</CardTitle>
          <CardDescription>Colori e sfondi per stati</CardDescription>
        </CardHeader>
        <CardContent className="stack-md">
          {/* Text Colors */}
          <div className="stack-sm">
            <h3 className="section-title">Text Colors</h3>
            <div className="grid-cards-sm">
              <ClassItem className="status-success" description="Testo successo (green)" />
              <ClassItem className="status-warning" description="Testo warning (yellow)" />
              <ClassItem className="status-error" description="Testo errore (red)" />
              <ClassItem className="status-info" description="Testo info (blue)" />
            </div>
            <PreviewBox className="row-lg">
              <span className="status-success">Successo</span>
              <span className="status-warning">Attenzione</span>
              <span className="status-error">Errore</span>
              <span className="status-info">Info</span>
            </PreviewBox>
          </div>

          <Separator />

          {/* Background Colors */}
          <div className="stack-sm">
            <h3 className="section-title">Background Colors</h3>
            <div className="grid-cards-sm">
              <ClassItem className="bg-status-success" description="Sfondo successo" />
              <ClassItem className="bg-status-warning" description="Sfondo warning" />
              <ClassItem className="bg-status-error" description="Sfondo errore" />
              <ClassItem className="bg-status-info" description="Sfondo info" />
            </div>
            <PreviewBox className="row-md">
              <span className="bg-status-success px-3 py-1 rounded">Successo</span>
              <span className="bg-status-warning px-3 py-1 rounded">Attenzione</span>
              <span className="bg-status-error px-3 py-1 rounded">Errore</span>
              <span className="bg-status-info px-3 py-1 rounded">Info</span>
            </PreviewBox>
          </div>
        </CardContent>
      </Card>

      {/* Color Palette */}
      <Card>
        <CardHeader>
          <CardTitle>Color Palette</CardTitle>
          <CardDescription>Colori del design system</CardDescription>
        </CardHeader>
        <CardContent className="stack-md">
          <div className="grid-cards-lg">
            <div className="stack-xs">
              <div className="h-16 rounded-lg bg-primary" />
              <span className="label-text">Primary</span>
              <span className="helper-text">--primary</span>
            </div>
            <div className="stack-xs">
              <div className="h-16 rounded-lg bg-secondary" />
              <span className="label-text">Secondary</span>
              <span className="helper-text">--secondary</span>
            </div>
            <div className="stack-xs">
              <div className="h-16 rounded-lg bg-muted" />
              <span className="label-text">Muted</span>
              <span className="helper-text">--muted</span>
            </div>
            <div className="stack-xs">
              <div className="h-16 rounded-lg bg-accent" />
              <span className="label-text">Accent</span>
              <span className="helper-text">--accent</span>
            </div>
            <div className="stack-xs">
              <div className="h-16 rounded-lg bg-destructive" />
              <span className="label-text">Destructive</span>
              <span className="helper-text">--destructive</span>
            </div>
            <div className="stack-xs">
              <div className="h-16 rounded-lg bg-card border" />
              <span className="label-text">Card</span>
              <span className="helper-text">--card</span>
            </div>
            <div className="stack-xs">
              <div className="h-16 rounded-lg bg-background border" />
              <span className="label-text">Background</span>
              <span className="helper-text">--background</span>
            </div>
            <div className="stack-xs">
              <div className="h-16 rounded-lg bg-foreground" />
              <span className="label-text">Foreground</span>
              <span className="helper-text">--foreground</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StyleGuide;

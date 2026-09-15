/**
 * Traduce i "motivi" del focus settimanale in un livello di gravità,
 * così i chip non sono tutti rossi e la gerarchia resta leggibile.
 */
export type FocusSeverity = 'high' | 'medium' | 'info';

export const focusReasonSeverity = (reason: string): FocusSeverity => {
  const r = reason.toLowerCase();

  // Scadenze già superate o odierne
  if (r.includes('scaduto') || r.includes('in ritardo') || r.includes('scade oggi')) return 'high';

  // Scadenze imminenti entro la settimana
  if (r.includes('scade')) return 'medium';

  // Budget: oltre il 100% è grave, sopra soglia è da tenere d'occhio
  const budgetMatch = r.match(/budget al (\d+)%/);
  if (budgetMatch) return Number(budgetMatch[1]) >= 100 ? 'high' : 'medium';

  if (r.includes('priorità alta')) return 'medium';

  // Tutto il resto è informativo (ore pianificate, nessun aggiornamento, fermo da…)
  return 'info';
};

const SEVERITY_WEIGHT: Record<FocusSeverity, number> = { high: 0, medium: 1, info: 2 };

export const focusSeverityClasses: Record<FocusSeverity, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-warning/10 text-warning-foreground border-warning/40',
  info: 'bg-muted text-muted-foreground border-border',
};

/** Ordina i motivi per gravità e restituisce i primi `limit` più il resto contato. */
export const topFocusReasons = (reasons: string[], limit = 2) => {
  const sorted = [...reasons].sort(
    (a, b) => SEVERITY_WEIGHT[focusReasonSeverity(a)] - SEVERITY_WEIGHT[focusReasonSeverity(b)]
  );
  return { visible: sorted.slice(0, limit), hiddenCount: Math.max(0, sorted.length - limit) };
};

import { docSections } from '@/components/docs/docSections';

/**
 * Restituisce tutti gli ID di sezione attesi nella guida `/help`,
 * leggendo la struttura dichiarata in `docSections`.
 *
 * Include sia i top-level che i `children`.
 */
export function getExpectedSectionIds(): string[] {
  const ids: string[] = [];
  docSections.forEach((s) => {
    ids.push(s.id);
    s.children?.forEach((c) => ids.push(c.id));
  });
  return ids;
}

export interface ExportSectionsAudit {
  /** Tutti gli ID dichiarati in docSections. */
  expected: string[];
  /** ID effettivamente trovati come `<section id="...">` nel DOM. */
  found: string[];
  /** ID dichiarati ma assenti dal DOM (potenzialmente non esportati). */
  missing: string[];
  /** ID presenti nel DOM ma non dichiarati (informativo, non blocca l'export). */
  extra: string[];
  /** ID esclusi tramite `data-doc-export-skip`. */
  skipped: string[];
}

/**
 * Confronta gli ID dichiarati con quelli realmente presenti nel `<main>` della
 * guida e segnala mancanti / extra. Utile per garantire che l'esportazione
 * (PDF o Markdown) copra effettivamente tutto il manuale.
 *
 * Nota: i top-level senza una `<section id>` corrispondente nel DOM (perché
 * il loro contenuto è suddiviso in soli children) NON vengono segnalati come
 * mancanti se almeno un loro child è presente.
 */
export function auditDocSectionsInDom(root: ParentNode | null): ExportSectionsAudit {
  const expected = getExpectedSectionIds();
  const allSections = root
    ? Array.from(root.querySelectorAll<HTMLElement>('section[id]'))
    : [];
  const found = allSections
    .filter((s) => !s.hasAttribute('data-doc-export-skip'))
    .map((s) => s.id);
  const skipped = allSections
    .filter((s) => s.hasAttribute('data-doc-export-skip'))
    .map((s) => s.id)
    .filter(Boolean);

  const foundSet = new Set(found);

  // Determina i top-level "virtuali" (senza section dedicata ma con children renderizzati).
  const virtualParents = new Set<string>();
  docSections.forEach((s) => {
    if (!s.children?.length) return;
    if (foundSet.has(s.id)) return;
    const anyChildPresent = s.children.some((c) => foundSet.has(c.id));
    if (anyChildPresent) virtualParents.add(s.id);
  });

  const missing = expected.filter((id) => !foundSet.has(id) && !virtualParents.has(id));
  const extra = found.filter((id) => !expected.includes(id));

  return { expected, found, missing, extra, skipped };
}

/**
 * Stampa un report leggibile della validazione su `console`.
 * Restituisce true se non ci sono sezioni mancanti.
 */
export function logSectionsAudit(audit: ExportSectionsAudit, label = 'Docs export'): boolean {
  const ok = audit.missing.length === 0;
  const summary = `[${label}] ${audit.found.length}/${audit.expected.length} sezioni esportate`;
  if (ok) {
    console.info(summary);
  } else {
    console.warn(summary, {
      missing: audit.missing,
      extra: audit.extra,
      skipped: audit.skipped,
    });
  }
  return ok;
}
